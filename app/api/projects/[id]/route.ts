import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      summaries: { orderBy: { periodStart: "desc" } },
      commits: { orderBy: { date: "desc" }, take: 50 },
      pullRequests: { orderBy: { openedAt: "desc" }, take: 30 },
      issues: { orderBy: { openedAt: "desc" }, take: 30 },
      manualNotes: { orderBy: { weekStart: "desc" }, take: 10 },
      milestones: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const allowed = ["name", "description", "latestMilestone"];
  const data = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  const project = await prisma.project.update({ where: { id: params.id }, data });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
