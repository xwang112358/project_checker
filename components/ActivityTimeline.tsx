"use client";

import { GitCommit, GitMerge, CircleDot, StickyNote } from "lucide-react";
import { relativeTime } from "@/lib/utils";

interface TimelineItem {
  type: "commit" | "pr" | "issue" | "note";
  date: Date;
  title: string;
  subtitle?: string;
  status?: string;
}

interface Props {
  commits: { sha: string; message: string; author: string; date: string }[];
  pullRequests: { githubPrId: number; title: string; status: string; openedAt: string; mergedAt?: string | null }[];
  issues: { githubIssueId: number; title: string; status: string; openedAt: string; closedAt?: string | null }[];
  manualNotes: { id: string; weekStart: string; outsideProgressNote?: string | null; nextStepNote?: string | null }[];
}

export default function ActivityTimeline({ commits, pullRequests, issues, manualNotes }: Props) {
  const items: TimelineItem[] = [];

  commits.slice(0, 30).forEach((c) =>
    items.push({
      type: "commit",
      date: new Date(c.date),
      title: c.message,
      subtitle: `by ${c.author}`,
    })
  );

  pullRequests.forEach((pr) =>
    items.push({
      type: "pr",
      date: new Date(pr.mergedAt ?? pr.openedAt),
      title: pr.title,
      status: pr.status,
    })
  );

  issues.forEach((i) =>
    items.push({
      type: "issue",
      date: new Date(i.closedAt ?? i.openedAt),
      title: i.title,
      status: i.status,
    })
  );

  manualNotes.forEach((n) => {
    const text = [n.outsideProgressNote, n.nextStepNote].filter(Boolean).join(" / ");
    if (text) {
      items.push({
        type: "note",
        date: new Date(n.weekStart),
        title: text,
      });
    }
  });

  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 italic">No activity yet.</p>;
  }

  const iconMap = {
    commit: <GitCommit size={14} className="text-blue-500" />,
    pr: <GitMerge size={14} className="text-purple-500" />,
    issue: <CircleDot size={14} className="text-orange-500" />,
    note: <StickyNote size={14} className="text-yellow-500" />,
  };

  return (
    <div className="relative space-y-0">
      <div className="absolute left-3.5 top-2 bottom-2 w-px bg-gray-100" />
      {items.map((item, i) => (
        <div key={i} className="flex gap-3 relative pl-1 pb-4">
          <div className="relative z-10 flex-shrink-0 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
            {iconMap[item.type]}
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm text-gray-800 leading-snug truncate">{item.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {item.subtitle && (
                <span className="text-xs text-gray-400">{item.subtitle}</span>
              )}
              {item.status && item.status !== "open" && (
                <span className={`text-xs font-medium ${item.status === "merged" || item.status === "closed" ? "text-green-600" : "text-gray-400"}`}>
                  {item.status}
                </span>
              )}
              <span className="text-xs text-gray-400">{relativeTime(item.date)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
