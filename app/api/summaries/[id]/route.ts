import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAndStoreSummary } from "@/lib/summarize";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const summaries = await prisma.summary.findMany({
    where: { projectId: params.id },
    orderBy: { periodStart: "desc" },
    take: 6,
  });
  return NextResponse.json(summaries);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { periodType } = await req.json();
  if (periodType !== "weekly" && periodType !== "monthly") {
    return NextResponse.json({ error: "periodType must be weekly or monthly" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete cached summary to force LLM regeneration
  const { getWeekStart, getMonthStart } = await import("@/lib/utils");
  const now = new Date();
  const periodStart = periodType === "weekly" ? getWeekStart(now) : getMonthStart(now);
  await prisma.summary.deleteMany({
    where: { projectId: params.id, periodType, periodStart },
  });

  await generateAndStoreSummary(
    {
      projectId: project.id,
      projectName: project.name,
      repoOwner: project.repoOwner,
      repoName: project.repoName,
    },
    periodType
  );

  const summary = await prisma.summary.findFirst({
    where: { projectId: params.id, periodType, periodStart },
  });
  return NextResponse.json(summary);
}
