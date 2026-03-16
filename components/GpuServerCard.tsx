"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Wifi, WifiOff, Thermometer, Cpu } from "lucide-react";
import clsx from "clsx";
import type { GpuServerConfig, GpuServerResult, GpuMetric } from "@/lib/gpu-types";

interface Props {
  config: GpuServerConfig;
  result: GpuServerResult | null;
  onRemove: (id: string) => void;
}

function barColor(pct: number): string {
  if (pct < 30) return "bg-green-500";
  if (pct < 70) return "bg-yellow-500";
  return "bg-red-500";
}

function memGb(mb: number): string {
  return (mb / 1024).toFixed(1);
}

function summarizeGpuTypes(gpus: GpuMetric[]): string {
  const counts = new Map<string, number>();
  gpus.forEach((g) => counts.set(g.name, (counts.get(g.name) ?? 0) + 1));
  return Array.from(counts.entries())
    .map(([name, count]) => `${count}× ${name}`)
    .join(", ");
}

export default function GpuServerCard({ config, result, onRemove }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isLoading = result === null;
  const isOnline = result?.online ?? false;

  return (
    <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 truncate">{config.label}</h3>
            {isLoading ? (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                Polling…
              </span>
            ) : isOnline ? (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                <Wifi size={10} />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                <WifiOff size={10} />
                Offline
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {config.username}@{config.host}
            {config.port !== 22 ? `:${config.port}` : ""}
          </p>
        </div>

        {/* Remove button */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onRemove(config.id)}
                className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded transition-colors"
              >
                Remove
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-1 py-0.5"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              title="Remove server"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : !isOnline ? (
        <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg p-3">
          <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
          <span>{result?.error ?? "Server unreachable"}</span>
        </div>
      ) : result!.gpus.length === 0 ? (
        <div className="text-xs text-gray-400 italic">
          {result?.error ?? "No GPUs detected on this server"}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* GPU type summary */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Cpu size={12} className="flex-shrink-0" />
            <span>{summarizeGpuTypes(result!.gpus)}</span>
          </div>

          {/* Per-GPU rows */}
          <div className="space-y-3">
            {result!.gpus.map((gpu) => (
              <div key={gpu.index} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700">GPU {gpu.index}</span>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span
                      className={clsx(
                        "font-semibold",
                        gpu.utilizationPct < 30
                          ? "text-green-600"
                          : gpu.utilizationPct < 70
                          ? "text-yellow-600"
                          : "text-red-600"
                      )}
                    >
                      {gpu.utilizationPct}%
                    </span>
                    <span>
                      {memGb(gpu.memoryUsedMb)}/{memGb(gpu.memoryTotalMb)} GB
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Thermometer size={10} />
                      {gpu.temperatureC}°C
                    </span>
                  </div>
                </div>
                {/* Utilization bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={clsx("h-full rounded-full transition-all", barColor(gpu.utilizationPct))}
                    style={{ width: `${gpu.utilizationPct}%` }}
                  />
                </div>
                {/* Memory bar */}
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all"
                    style={{
                      width: `${Math.round((gpu.memoryUsedMb / gpu.memoryTotalMb) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
