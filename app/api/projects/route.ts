import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRepoInfo } from "@/lib/github";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: {
      summaries: {
        orderBy: { createdAt: "desc" },
        take: 4,
      },
    },
  });
  return NextResponse.json(projects);
}

export async function PATCH(req: NextRequest) {
  const { order } = await req.json() as { order: { id: string; sortOrder: number }[] };
  if (!Array.isArray(order)) {
    return NextResponse.json({ error: "order must be an array" }, { status: 400 });
  }
  await Promise.all(
    order.map(({ id, sortOrder }) =>
      prisma.project.update({ where: { id }, data: { sortOrder } })
    )
  );
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const { owner, repo, name } = await req.json();
  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo are required" }, { status: 400 });
  }

  // Check if already tracked
  const existing = await prisma.project.findUnique({
    where: { repoOwner_repoName: { repoOwner: owner, repoName: repo } },
  });
  if (existing) {
    return NextResponse.json({ error: "Repo already tracked" }, { status: 409 });
  }

  // Validate repo is accessible and get metadata
  let repoInfo;
  try {
    repoInfo = await getRepoInfo(owner, repo);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("Not Found") ? 404 : message.includes("Unauthorized") ? 401 : 403;
    return NextResponse.json({ error: `Cannot access repo: ${message}` }, { status });
  }

  const project = await prisma.project.create({
    data: {
      name: name || repo,
      repoOwner: owner,
      repoName: repo,
      description: repoInfo.description,
      visibility: repoInfo.visibility,
    },
  });

  return NextResponse.json(project, { status: 201 });
}
