"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import clsx from "clsx";

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

interface Props {
  summary: Summary | null | undefined;
  projectId: string;
  periodType: "weekly" | "monthly";
  onRegenerate?: () => void;
}

const trendColor: Record<string, string> = {
  increasing: "text-green-600",
  steady: "text-blue-600",
  declining: "text-orange-500",
  none: "text-gray-400",
};

const trendLabel: Record<string, string> = {
  increasing: "↑ Trending up",
  steady: "→ Steady",
  declining: "↓ Slowing",
  none: "—",
};

export default function SummaryBlock({ summary, projectId, periodType, onRegenerate }: Props) {
  const [regenerating, setRegenerating] = useState(false);

  if (!summary) {
    return (
      <div className="text-sm text-gray-400 italic">
        No data yet — sync to generate summary.
      </div>
    );
  }

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await fetch(`/api/summaries/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodType }),
      });
      onRegenerate?.();
    } finally {
      setRegenerating(false);
    }
  };

  const hasActivity =
    summary.commitCount + summary.prMergedCount + summary.issueClosedCount > 0;

  return (
    <div className="space-y-2">
      {/* Stats row */}
      <div className="flex flex-wrap gap-3 text-sm text-gray-600">
        {summary.commitCount > 0 && (
          <span>{summary.commitCount} commit{summary.commitCount !== 1 ? "s" : ""}</span>
        )}
        {summary.prMergedCount > 0 && (
          <span>{summary.prMergedCount} PR{summary.prMergedCount !== 1 ? "s" : ""} merged</span>
        )}
        {summary.prOpenedCount > summary.prMergedCount && (
          <span>{summary.prOpenedCount - summary.prMergedCount} PR{summary.prOpenedCount - summary.prMergedCount !== 1 ? "s" : ""} open</span>
        )}
        {summary.issueClosedCount > 0 && (
          <span>{summary.issueClosedCount} issue{summary.issueClosedCount !== 1 ? "s" : ""} closed</span>
        )}
        {!hasActivity && <span className="text-gray-400">No activity</span>}
        <span className={clsx("ml-auto", trendColor[summary.trendLabel] ?? "text-gray-400")}>
          {trendLabel[summary.trendLabel] ?? ""}
        </span>
      </div>

      {/* Generated summary */}
      {summary.generatedSummary && (
        <div className="space-y-1">
          {summary.generatedSummary.split("\n").map((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return null;

            // Section header: entire line is **bold**
            if (trimmed.startsWith("**") && trimmed.endsWith("**") && trimmed.indexOf("**", 2) === trimmed.length - 2) {
              return (
                <p key={i} className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1 first:pt-0">
                  {trimmed.slice(2, -2)}
                </p>
              );
            }

            // Inline bold parser: splits on **...**
            const renderInline = (text: string) => {
              const parts = text.split(/(\*\*[^*]+\*\*)/g);
              return parts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={j} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
                  : part
              );
            };

            if (trimmed.startsWith("- ")) {
              return (
                <div key={i} className="flex gap-1.5 text-sm text-gray-700">
                  <span className="text-gray-400 shrink-0">•</span>
                  <span>{renderInline(trimmed.slice(2))}</span>
                </div>
              );
            }
            return <p key={i} className="text-sm text-gray-700">{renderInline(trimmed)}</p>;
          })}
        </div>
      )}

      {/* Source badge + regenerate */}
      <div className="flex items-center gap-2">
        {summary.summarySource === "llm" ? (
          <span className="flex items-center gap-1 text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
            <Sparkles size={10} />
            AI summary
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            <AlertCircle size={10} />
            Rule-based
          </span>
        )}
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <RefreshCw size={10} className={clsx(regenerating && "animate-spin")} />
          Regenerate
        </button>
      </div>
    </div>
  );
}
