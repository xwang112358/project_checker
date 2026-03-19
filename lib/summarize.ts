import { prisma } from "./db";
import { generateSummaryText, isAzureConfigured } from "./azure-openai";
import {
  getWeekStart,
  getMonthStart,
  getPrevWeekStart,
  getPrevMonthStart,
  calcActivityScore,
  calcTrend,
} from "./utils";

interface SummaryInput {
  projectId: string;
  projectName: string;
  repoOwner: string;
  repoName: string;
  branches?: string[];
}

function buildPrompt(
  input: SummaryInput,
  periodLabel: string,
  periodStart: Date,
  periodEnd: Date,
  commits: { message: string; date: Date }[],
  mergedPRs: { title: string; mergedAt: Date | null }[],
  openedPRs: { title: string; openedAt: Date }[],
  closedIssues: { title: string; closedAt: Date | null; openedAt: Date }[]
): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const fmtShort = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const listOrNone = (
    items: { label: string; date: Date }[]
  ) => {
    if (items.length === 0) return "none";
    return items
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 15)
      .map((i) => `[${fmtShort(i.date)}] "${i.label}"`)
      .join(", ");
  };

  const branchLine =
    input.branches && input.branches.length > 0
      ? `Branches (${input.branches.length}): ${input.branches.slice(0, 10).join(", ")}`
      : "";

  return `Project: ${input.projectName} (${input.repoOwner}/${input.repoName})
Period: ${periodLabel} (${fmt(periodStart)} to ${fmt(periodEnd)})
${branchLine}
Commits (${commits.length}): ${listOrNone(commits.map((c) => ({ label: c.message, date: c.date })))}
PRs merged (${mergedPRs.length}): ${listOrNone(mergedPRs.map((p) => ({ label: p.title, date: p.mergedAt ?? new Date(0) })))}
PRs opened (${openedPRs.length}): ${listOrNone(openedPRs.map((p) => ({ label: p.title, date: p.openedAt })))}
Issues closed (${closedIssues.length}): ${listOrNone(closedIssues.map((i) => ({ label: i.title, date: i.closedAt ?? i.openedAt })))}

Write a structured summary using exactly this format:

**What changed**
- **Mon DD** [one-sentence description of what changed]

Rules:
- Up to 4 bullets, sorted from most recent to earliest.
- Start each bullet with the date in bold, e.g. **Mar 10**.
- Be concise. One short sentence per bullet.`;
}

function buildRuleBasedSummary(
  commitCount: number,
  prMergedCount: number,
  issueClosedCount: number,
  trendLabel: string
): string {
  if (commitCount === 0 && prMergedCount === 0 && issueClosedCount === 0) {
    return "**What changed**\n- No GitHub activity during this period.";
  }

  const changed: string[] = [];
  if (commitCount > 0) changed.push(`${commitCount} commit${commitCount !== 1 ? "s" : ""} pushed`);
  if (prMergedCount > 0) changed.push(`${prMergedCount} PR${prMergedCount !== 1 ? "s" : ""} merged`);
  if (issueClosedCount > 0)
    changed.push(`${issueClosedCount} issue${issueClosedCount !== 1 ? "s" : ""} closed`);

  const trendStr =
    trendLabel === "increasing"
      ? "Activity is trending up compared to the prior period."
      : trendLabel === "declining"
        ? "Activity has slowed compared to the prior period."
        : "Activity is at a steady pace.";

  const changedBlock = changed.map((s) => `- ${s}`).join("\n");
  return `**What changed**\n${changedBlock}`;
}

export async function generateAndStoreSummary(
  input: SummaryInput,
  periodType: "weekly" | "monthly"
): Promise<void> {
  const now = new Date();
  const periodStart = periodType === "weekly" ? getWeekStart(now) : getMonthStart(now);
  const periodEnd = now;

  const prevStart = periodType === "weekly" ? getPrevWeekStart(now) : getPrevMonthStart(now);
  const prevEnd = periodStart;

  // Fetch current period data from DB
  const [commits, allPRs, issues, prevCommits, prevPRs, prevIssues] = await Promise.all([
    prisma.commit.findMany({
      where: { projectId: input.projectId, date: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.pullRequest.findMany({
      where: {
        projectId: input.projectId,
        OR: [
          { openedAt: { gte: periodStart, lte: periodEnd } },
          { mergedAt: { gte: periodStart, lte: periodEnd } },
        ],
      },
    }),
    prisma.issue.findMany({
      where: { projectId: input.projectId, openedAt: { gte: periodStart, lte: periodEnd } },
    }),
    // Previous period for trend
    prisma.commit.findMany({
      where: { projectId: input.projectId, date: { gte: prevStart, lte: prevEnd } },
    }),
    prisma.pullRequest.findMany({
      where: {
        projectId: input.projectId,
        OR: [
          { openedAt: { gte: prevStart, lte: prevEnd } },
          { mergedAt: { gte: prevStart, lte: prevEnd } },
        ],
      },
    }),
    prisma.issue.findMany({
      where: { projectId: input.projectId, openedAt: { gte: prevStart, lte: prevEnd } },
    }),
  ]);

  const mergedPRs = allPRs.filter((p) => p.status === "merged");
  const openedPRs = allPRs.filter((p) => p.status === "open");
  const closedIssues = issues.filter((i) => i.status === "closed");

  const commitCount = commits.length;
  const prOpenedCount = allPRs.filter((p) => p.openedAt >= periodStart).length;
  const prMergedCount = mergedPRs.length;
  const issueOpenedCount = issues.filter((i) => i.openedAt >= periodStart).length;
  const issueClosedCount = closedIssues.length;

  // Trend calculation
  const currentScore = calcActivityScore(commitCount, prMergedCount, issueClosedCount);
  const prevScore = calcActivityScore(
    prevCommits.length,
    prevPRs.filter((p) => p.status === "merged").length,
    prevIssues.filter((i) => i.status === "closed").length
  );
  const trendLabel = calcTrend(currentScore, prevScore);

  // Generate summary text
  let generatedSummary: string;
  let summarySource: "llm" | "rule" = "rule";

  if (await isAzureConfigured() && commitCount + prMergedCount + issueClosedCount > 0) {
    try {
      const periodLabel = periodType === "weekly" ? "Last 7 days" : "Last 30 days";
      const prompt = buildPrompt(
        input,
        periodLabel,
        periodStart,
        periodEnd,
        commits.map((c) => ({ message: c.message, date: c.date })),
        mergedPRs.map((p) => ({ title: p.title, mergedAt: p.mergedAt })),
        openedPRs.map((p) => ({ title: p.title, openedAt: p.openedAt })),
        closedIssues.map((i) => ({ title: i.title, closedAt: i.closedAt, openedAt: i.openedAt }))
      );
      generatedSummary = await generateSummaryText(prompt);
      summarySource = "llm";
    } catch {
      generatedSummary = buildRuleBasedSummary(
        commitCount,
        prMergedCount,
        issueClosedCount,
        trendLabel
      );
    }
  } else {
    generatedSummary = buildRuleBasedSummary(
      commitCount,
      prMergedCount,
      issueClosedCount,
      trendLabel
    );
  }

  await prisma.summary.upsert({
    where: {
      projectId_periodType_periodStart: {
        projectId: input.projectId,
        periodType,
        periodStart,
      },
    },
    update: {
      periodEnd,
      commitCount,
      prOpenedCount,
      prMergedCount,
      issueOpenedCount,
      issueClosedCount,
      generatedSummary,
      summarySource,
      trendLabel,
    },
    create: {
      projectId: input.projectId,
      periodType,
      periodStart,
      periodEnd,
      commitCount,
      prOpenedCount,
      prMergedCount,
      issueOpenedCount,
      issueClosedCount,
      generatedSummary,
      summarySource,
      trendLabel,
    },
  });
}
