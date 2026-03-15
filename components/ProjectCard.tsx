"use client";

import Link from "next/link";
import { Lock, Globe, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { relativeTime } from "@/lib/utils";
import SummaryBlock from "./SummaryBlock";

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

const statusStyles: Record<string, { badge: string; label: string }> = {
  active: { badge: "bg-green-100 text-green-700", label: "Active" },
  slow: { badge: "bg-yellow-100 text-yellow-700", label: "Slow" },
  stalled: { badge: "bg-red-100 text-red-700", label: "Stalled" },
  error: { badge: "bg-gray-100 text-gray-500", label: "Error" },
  unknown: { badge: "bg-gray-100 text-gray-400", label: "Unknown" },
};

interface Props {
  project: Project;
  onRegenerate?: () => void;
}

export default function ProjectCard({ project, onRegenerate }: Props) {
  const weeklySummary = project.summaries.find((s) => s.periodType === "weekly");
  const monthlySummary = project.summaries.find((s) => s.periodType === "monthly");
  const style = statusStyles[project.status] ?? statusStyles.unknown;
  const repoUrl = `https://github.com/${project.repoOwner}/${project.repoName}`;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="text-base font-semibold text-gray-900 hover:text-blue-600 truncate block"
          >
            {project.name}
          </Link>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mt-0.5"
          >
            {project.visibility === "private" ? (
              <Lock size={10} />
            ) : (
              <Globe size={10} />
            )}
            {project.repoOwner}/{project.repoName}
          </a>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", style.badge)}>
            {style.label}
          </span>
        </div>
      </div>

      {/* Last activity */}
      <div className="text-xs text-gray-400">
        Last activity: {relativeTime(project.lastActivityAt)}
      </div>

      {/* Error state */}
      {project.status === "error" && project.statusErrorMessage && (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{project.statusErrorMessage}</span>
        </div>
      )}

      {/* Weekly summary */}
      {project.status !== "error" && (
        <>
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Last Week
            </h4>
            <SummaryBlock
              summary={weeklySummary}
              projectId={project.id}
              periodType="weekly"
              onRegenerate={onRegenerate}
            />
          </div>

          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Last Month
            </h4>
            <SummaryBlock
              summary={monthlySummary}
              projectId={project.id}
              periodType="monthly"
              onRegenerate={onRegenerate}
            />
          </div>
        </>
      )}
    </div>
  );
}
