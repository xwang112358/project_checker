"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RefreshCw, Cpu, AlertTriangle } from "lucide-react";
import GpuServerCard from "@/components/GpuServerCard";
import AddServerModal from "@/components/AddServerModal";
import type { GpuServerConfig, GpuServerResult } from "@/lib/gpu-types";

const POLL_INTERVAL_S = 30;

export default function GpuPage() {
  const [servers, setServers] = useState<GpuServerConfig[]>([]);
  const [results, setResults] = useState<GpuServerResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastPolled, setLastPolled] = useState<Date | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_S);
  const [showAddModal, setShowAddModal] = useState(false);

  const pollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doPoll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setIsPolling(true);
    try {
      const res = await fetch("/api/gpu/poll");
      const data = await res.json();
      if (res.ok) {
        setResults(data.servers ?? []);
        setLastPolled(new Date());
        setPollError(null);
      } else {
        setPollError(data.error ?? `Server error (${res.status})`);
      }
    } catch {
      setPollError("Network error — could not reach the server");
    } finally {
      pollingRef.current = false;
      setIsPolling(false);
    }
  }, []);

  const loadServers = useCallback(async () => {
    const res = await fetch("/api/gpu-servers");
    if (res.ok) {
      const data = await res.json();
      setServers(data);
    }
  }, []);

  useEffect(() => {
    loadServers().then(() => doPoll());

    intervalRef.current = setInterval(() => {
      setCountdown(POLL_INTERVAL_S);
      doPoll();
    }, POLL_INTERVAL_S * 1000);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c <= 1 ? POLL_INTERVAL_S : c - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleServerAdded(server: GpuServerConfig) {
    setServers((prev) => [...prev, server]);
    setShowAddModal(false);
    // Immediately poll to get its GPU data
    doPoll();
  }

  async function handleRemove(id: string) {
    setServers((prev) => prev.filter((s) => s.id !== id));
    setResults((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/gpu-servers/${id}`, { method: "DELETE" });
  }

  // Merge configs with poll results
  const mergedServers = servers.map((config) => ({
    config,
    result: results.find((r) => r.id === config.id) ?? null,
  }));

  // Summary stats
  const onlineCount = results.filter((r) => r.online).length;
  const totalGpus = results.reduce((sum, r) => sum + r.gpus.length, 0);
  const freeGpus = results.reduce(
    (sum, r) => sum + r.gpus.filter((g) => g.utilizationPct < 10).length,
    0
  );

  function formatLastPolled(date: Date): string {
    const secs = Math.round((Date.now() - date.getTime()) / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    return `${Math.round(secs / 60)}m ago`;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              GPU{" "}
              <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                Availability
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Lab server GPU monitor</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status / countdown */}
          <span className="text-xs text-gray-400">
            {lastPolled ? `Updated ${formatLastPolled(lastPolled)} · next in ${countdown}s` : "Polling…"}
          </span>

          {/* Manual refresh */}
          <button
            onClick={doPoll}
            disabled={isPolling}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={isPolling ? "animate-spin" : ""} />
            {isPolling ? "Polling…" : "Refresh"}
          </button>

          {/* Add server */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add Server
          </button>
        </div>
      </div>

      {/* Poll error banner */}
      {pollError && (
        <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium">Polling failed: </span>
            {pollError}
          </div>
        </div>
      )}

      {/* Summary bar */}
      {servers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Servers", value: servers.length, color: "text-gray-900" },
            { label: "Online", value: onlineCount, color: "text-green-600" },
            { label: "Total GPUs", value: totalGpus, color: "text-blue-600" },
            { label: "Free GPUs", value: freeGpus, color: "text-green-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Server cards grid */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Cpu size={40} className="text-gray-200 mb-4" />
          <p className="text-sm font-medium text-gray-500 mb-1">No servers added yet</p>
          <p className="text-xs text-gray-400 mb-4">
            Add a lab server to start monitoring GPU availability
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Add your first server
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mergedServers.map(({ config, result }) => (
            <GpuServerCard
              key={config.id}
              config={config}
              result={result}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Add server modal */}
      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleServerAdded}
        />
      )}
    </div>
  );
}
