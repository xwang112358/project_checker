import { NextResponse } from "next/server";
import { prisma, setSetting } from "@/lib/db";
import { fetchCommitsAllBranches, fetchPRsSince, fetchIssuesSince, getRepoInfo } from "@/lib/github";
import { generateAndStoreSummary } from "@/lib/summarize";
import { deriveProjectStatus } from "@/lib/utils";

export async function POST() {
  const projects = await prisma.project.findMany();
  const results: { id: string; name: string; status: string; error?: string }[] = [];

  for (const project of projects) {
    try {
      await syncProject(project.id, project.repoOwner, project.repoName, project.lastSyncedAt);
      results.push({ id: project.id, name: project.name, status: "ok" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.project.update({
        where: { id: project.id },
        data: { status: "error", statusErrorMessage: message },
      });
      results.push({ id: project.id, name: project.name, status: "error", error: message });
    }
  }

  await setSetting("last_global_sync_at", new Date().toISOString());
  return NextResponse.json({ ok: true, results });
}

export async function GET() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, status: true, lastSyncedAt: true, statusErrorMessage: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(projects);
}

export async function syncProject(
  projectId: string,
  owner: string,
  repo: string,
  lastSyncedAt: Date | null
) {
  // Update repo metadata
  const repoInfo = await getRepoInfo(owner, repo);

  // Fetch new activity across all branches
  const [{ commits, branches }, prs, issues] = await Promise.all([
    fetchCommitsAllBranches(owner, repo, lastSyncedAt),
    fetchPRsSince(owner, repo, lastSyncedAt),
    fetchIssuesSince(owner, repo, lastSyncedAt),
  ]);

  // Upsert commits
  for (const c of commits) {
    await prisma.commit.upsert({
      where: { projectId_sha: { projectId, sha: c.sha } },
      update: {},
      create: { projectId, ...c },
    });
  }

  // Upsert PRs
  for (const pr of prs) {
    await prisma.pullRequest.upsert({
      where: { projectId_githubPrId: { projectId, githubPrId: pr.githubPrId } },
      update: { title: pr.title, status: pr.status, mergedAt: pr.mergedAt, closedAt: pr.closedAt },
      create: { projectId, ...pr },
    });
  }

  // Upsert issues
  for (const issue of issues) {
    await prisma.issue.upsert({
      where: { projectId_githubIssueId: { projectId, githubIssueId: issue.githubIssueId } },
      update: { title: issue.title, status: issue.status, closedAt: issue.closedAt },
      create: { projectId, ...issue },
    });
  }

  // Determine last activity
  const mostRecentCommit = await prisma.commit.findFirst({
    where: { projectId },
    orderBy: { date: "desc" },
  });
  const lastActivityAt = mostRecentCommit?.date ?? (repoInfo.pushedAt ? new Date(repoInfo.pushedAt) : null);
  const status = deriveProjectStatus(lastActivityAt);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      visibility: repoInfo.visibility,
      description: repoInfo.description ?? undefined,
      status,
      statusErrorMessage: null,
      lastActivityAt,
      lastSyncedAt: new Date(),
    },
  });

  // Generate summaries
  const summaryInput = {
    projectId,
    projectName: repo,
    repoOwner: owner,
    repoName: repo,
    branches,
  };
  await Promise.all([
    generateAndStoreSummary(summaryInput, "weekly"),
    generateAndStoreSummary(summaryInput, "monthly"),
  ]);
}
