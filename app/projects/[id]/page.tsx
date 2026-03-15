"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Lock, Globe, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import SummaryBlock from "@/components/SummaryBlock";
import ActivityTimeline from "@/components/ActivityTimeline";
import ManualNoteEditor from "@/components/ManualNoteEditor";
import { relativeTime } from "@/lib/utils";

const statusStyles: Record<string, { badge: string; label: string }> = {
  active: { badge: "bg-green-100 text-green-700", label: "Active" },
  slow: { badge: "bg-yellow-100 text-yellow-700", label: "Slow" },
  stalled: { badge: "bg-red-100 text-red-700", label: "Stalled" },
  error: { badge: "bg-gray-100 text-gray-500", label: "Error" },
  unknown: { badge: "bg-gray-100 text-gray-400", label: "Unknown" },
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [project, setProject] = useState<ReturnType<typeof mapProject> | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) { router.push("/"); return; }
    const data = await res.json();
    setProject(mapProject(data));
    setLoading(false);
  }, [id, router]);

  useEffect(() => { loadProject(); }, [loadProject]);

  const handleSync = async () => {
    setSyncing(true);
    await fetch(`/api/sync/${id}`, { method: "POST" });
    await loadProject();
    setSyncing(false);
  };

  const handleDelete = async () => {
    if (!confirm("Remove this project? All synced data will be deleted.")) return;
    setDeleting(true);
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!project) return null;

  const style = statusStyles[project.status] ?? statusStyles.unknown;
  const repoUrl = `https://github.com/${project.repoOwner}/${project.repoName}`;
  const weeklySummary = project.summaries.find((s) => s.periodType === "weekly");
  const monthlySummary = project.summaries.find((s) => s.periodType === "monthly");
  const currentNote = project.manualNotes[0];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={14} /> Dashboard
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mt-1"
            >
              {project.visibility === "private" ? <Lock size={12} /> : <Globe size={12} />}
              {project.repoOwner}/{project.repoName}
              <ExternalLink size={11} />
            </a>
            {project.description && (
              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className={clsx("text-sm font-medium px-3 py-1 rounded-full", style.badge)}>
              {style.label}
            </span>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={clsx(syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-sm text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <Trash2 size={13} />
              Remove
            </button>
          </div>
        </div>

        <div className="flex gap-6 mt-4 text-xs text-gray-400">
          <span>Last activity: {relativeTime(project.lastActivityAt)}</span>
          <span>Synced: {relativeTime(project.lastSyncedAt)}</span>
        </div>
      </div>

      {/* Summary blocks + timeline */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Summaries + notes */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Last Week</h3>
            <SummaryBlock
              summary={weeklySummary}
              projectId={project.id}
              periodType="weekly"
              onRegenerate={loadProject}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Last Month</h3>
            <SummaryBlock
              summary={monthlySummary}
              projectId={project.id}
              periodType="monthly"
              onRegenerate={loadProject}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Weekly Notes</h3>
            <ManualNoteEditor
              projectId={project.id}
              initialNote={currentNote}
              onSaved={loadProject}
            />
          </div>
        </div>

        {/* Right: Activity timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Activity Timeline</h3>
          <ActivityTimeline
            commits={project.commits}
            pullRequests={project.pullRequests}
            issues={project.issues}
            manualNotes={project.manualNotes}
          />
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(data: any) {
  return {
    ...data,
    lastActivityAt: data.lastActivityAt ? new Date(data.lastActivityAt) : null,
    lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : null,
    commits: data.commits ?? [],
    pullRequests: data.pullRequests ?? [],
    issues: data.issues ?? [],
    manualNotes: data.manualNotes ?? [],
    summaries: data.summaries ?? [],
    milestones: data.milestones ?? [],
  };
}
