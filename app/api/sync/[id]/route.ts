import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncProject } from "../route";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await syncProject(project.id, project.repoOwner, project.repoName, project.lastSyncedAt);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
