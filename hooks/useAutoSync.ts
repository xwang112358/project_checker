"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatCountdown } from "@/lib/utils";

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function useAutoSync(onSyncComplete?: () => void) {
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const nextSyncRef = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useCallback((from: Date) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const next = new Date(from.getTime() + SYNC_INTERVAL_MS);
    nextSyncRef.current = next;
    const delay = next.getTime() - Date.now();
    timerRef.current = setTimeout(() => triggerSync(), Math.max(delay, 0));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const triggerSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      const now = new Date();
      setLastSynced(now);
      scheduleNext(now);
      onSyncComplete?.();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, scheduleNext, onSyncComplete]);

  // Initialize on mount: check when last sync happened
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings?key=last_global_sync_at");
      const data = await res.json();

      if (data.value) {
        const last = new Date(data.value);
        setLastSynced(last);
        const elapsed = Date.now() - last.getTime();
        if (elapsed >= SYNC_INTERVAL_MS) {
          await triggerSync();
        } else {
          scheduleNext(last);
        }
      } else {
        await triggerSync();
      }
    })();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Live countdown ticker
  useEffect(() => {
    const tick = () => {
      const next = nextSyncRef.current;
      if (!next) { setCountdown(""); return; }
      const ms = next.getTime() - Date.now();
      setCountdown(ms <= 0 ? "soon" : formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [lastSynced]);

  return { lastSynced, isSyncing, countdown, triggerSync };
}
