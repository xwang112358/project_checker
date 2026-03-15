"use client";

import { RefreshCw } from "lucide-react";
import { relativeTime } from "@/lib/utils";
import clsx from "clsx";

interface Props {
  lastSynced: Date | null;
  isSyncing: boolean;
  countdown: string;
  onSync: () => void;
}

export default function SyncBar({ lastSynced, isSyncing, countdown, onSync }: Props) {
  return (
    <div className="flex items-center gap-4 text-sm text-gray-500">
      <span>
        {lastSynced ? `Updated ${relativeTime(lastSynced)}` : "Not yet synced"}
      </span>
      {countdown && !isSyncing && (
        <span className="text-gray-400">Next sync in {countdown}</span>
      )}
      <button
        onClick={onSync}
        disabled={isSyncing}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          isSyncing
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        )}
      >
        <RefreshCw
          size={14}
          className={clsx(isSyncing && "animate-spin")}
        />
        {isSyncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
