"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Settings, BookOpen } from "lucide-react";
import SyncBar from "@/components/SyncBar";
import ProjectCard from "@/components/ProjectCard";
import { useAutoSync } from "@/hooks/useAutoSync";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface Summary {
  id: string;
  periodType: string;
  commitCount: number;
  prOpenedCount: number;
  prMergedCount: number;
  issueOpenedCount: number;
  issueClosedCount: number;
  generatedSummary: string | null;
  summarySource: string;
  trendLabel: string;
}

interface Project {
  id: string;
  name: string;
  repoOwner: string;
  repoName: string;
  description: string | null;
  visibility: string;
  status: string;
  statusErrorMessage: string | null;
  lastActivityAt: string | null;
  lastSyncedAt: string | null;
  summaries: Summary[];
}

function SortableCard({
  project,
  onRegenerate,
}: {
  project: Project;
  onRegenerate: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 right-3 z-10 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <GripVertical size={16} />
      </div>
      <ProjectCard project={project} onRegenerate={onRegenerate} />
    </div>
  );
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const { lastSynced, isSyncing, countdown, triggerSync } = useAutoSync(loadProjects);

  const handleSync = async () => {
    await triggerSync();
    await loadProjects();
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(projects, oldIndex, newIndex);
    setProjects(reordered);
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map((p, i) => ({ id: p.id, sortOrder: i })) }),
    });
  };

  const statusCounts = {
    active: projects.filter((p) => p.status === "active").length,
    slow: projects.filter((p) => p.status === "slow").length,
    stalled: projects.filter((p) => p.status === "stalled").length,
  };

  const mostActiveWeek = projects
    .map((p) => ({
      p,
      score: (p.summaries.find((s) => s.periodType === "weekly")?.commitCount ?? 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.p;

  const mostActiveMonth = projects
    .map((p) => ({
      p,
      score: (p.summaries.find((s) => s.periodType === "monthly")?.commitCount ?? 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.p;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
            Project{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              Checker
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">PhD research progress tracker</p>
        </div>
        <div className="flex items-center gap-3">
          <SyncBar
            lastSynced={lastSynced}
            isSyncing={isSyncing}
            countdown={countdown}
            onSync={handleSync}
          />
          <Link
            href="/setup"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Settings / Setup"
          >
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* Section A: Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total projects", value: projects.length, color: "text-gray-900" },
          { label: "Active", value: statusCounts.active, color: "text-green-600" },
          { label: "Slow", value: statusCounts.slow, color: "text-yellow-600" },
          { label: "Stalled", value: statusCounts.stalled, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Section B+C: This week / This month highlights */}
      {projects.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen size={14} /> This week
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              {mostActiveWeek && (
                <p>
                  Most active:{" "}
                  <Link href={`/projects/${mostActiveWeek.id}`} className="font-medium text-blue-600 hover:underline">
                    {mostActiveWeek.name}
                  </Link>
                </p>
              )}
              <p>
                Inactive projects:{" "}
                <span className="font-medium">
                  {projects.filter((p) => {
                    const ws = p.summaries.find((s) => s.periodType === "weekly");
                    return (ws?.commitCount ?? 0) === 0;
                  }).length}
                </span>
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen size={14} /> This month
            </h3>
            <div className="space-y-2 text-sm text-gray-600">
              {mostActiveMonth && (
                <p>
                  Most active:{" "}
                  <Link href={`/projects/${mostActiveMonth.id}`} className="font-medium text-blue-600 hover:underline">
                    {mostActiveMonth.name}
                  </Link>
                </p>
              )}
              <p>
                Stalled projects:{" "}
                <span className="font-medium text-red-600">{statusCounts.stalled}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">
            <Link href="/setup" className="text-blue-600 hover:underline">
              Go to setup
            </Link>{" "}
            to add your GitHub repos.
          </p>
        </div>
      )}

      {/* Project cards */}
      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading…</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={projects.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <SortableCard key={project.id} project={project} onRegenerate={loadProjects} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
