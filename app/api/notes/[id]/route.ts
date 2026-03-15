import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getWeekStart } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const notes = await prisma.manualNote.findMany({
    where: { projectId: params.id },
    orderBy: { weekStart: "desc" },
    take: 10,
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { outsideProgressNote, nextStepNote } = await req.json();
  const weekStart = getWeekStart();

  const note = await prisma.manualNote.upsert({
    where: {
      projectId_weekStart: {
        projectId: params.id,
        weekStart,
      },
    },
    update: { outsideProgressNote, nextStepNote },
    create: {
      projectId: params.id,
      weekStart,
      outsideProgressNote,
      nextStepNote,
    },
  });

  return NextResponse.json(note);
}
