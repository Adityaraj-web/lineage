"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fingerprint } from "@/lib/changes";
import { useLiveStore, type PollError } from "./live-store";
import { readPollCache, seedPollCache } from "./poll-cache";

const MAX_BACKOFF_MS = 30_000;

function toPollError(e: unknown): PollError {
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { name: "Error", message: String(e) };
}

const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

export interface Polled<T> {
  data: T | null;
  error: PollError | null;
  refresh: () => void;
}

// Polls `load` every `intervalMs` while the tab is visible. Identical results keep the previous
// `data` reference (no re-render); errors keep the last good data and retry with backoff.
// With `cacheKey`, the first render shows the last data any screen stored under that key.
export function usePolling<T>(
  load: () => Promise<T>,
  intervalMs = 5000,
  { cacheKey }: { cacheKey?: string } = {},
): Polled<T> {
  const store = useLiveStore();
  const [data, setData] = useState<T | null>(() => (cacheKey ? readPollCache<T>(cacheKey) : null));
  const keyRef = useRef(cacheKey);
  keyRef.current = cacheKey;
  const [error, setError] = useState<PollError | null>(null);

  const loadRef = useRef(load);
  loadRef.current = load;
  const alive = useRef(false);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const lastFp = useRef<string | null>(null);
  const lastOkAt = useRef(0);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const delay = useCallback(
    () => (failures.current === 0 ? intervalMs : Math.min(intervalMs * 2 ** (failures.current - 1), MAX_BACKOFF_MS)),
    [intervalMs],
  );

  const run = useCallback(async () => {
    if (!alive.current || inFlight.current) return;
    clearTimer();
    inFlight.current = true;
    try {
      const result = await loadRef.current();
      if (!alive.current) return;
      const now = Date.now();
      const fp = fingerprint(result);
      const first = lastFp.current === null;
      const changed = fp !== lastFp.current;
      if (changed) {
        lastFp.current = fp;
        setData(result);
      }
      if (keyRef.current) seedPollCache(keyRef.current, result);
      failures.current = 0;
      lastOkAt.current = now;
      setError(null);
      store.set({
        status: isHidden() ? "paused" : "live",
        updatedAt: now,
        error: null,
        retryAt: null,
        ...(changed && !first ? { changedAt: now } : {}),
      });
    } catch (e) {
      if (!alive.current) return;
      failures.current++;
      const err = toPollError(e);
      setError((prev) => (prev && prev.name === err.name && prev.message === err.message ? prev : err));
      store.set({ status: "error", error: err, retryAt: isHidden() ? null : Date.now() + delay() });
    } finally {
      inFlight.current = false;
      if (alive.current && !isHidden()) timer.current = setTimeout(run, delay());
    }
  }, [delay, store]);

  const refresh = useCallback(() => {
    failures.current = 0;
    void run();
  }, [run]);

  useEffect(() => {
    alive.current = true;
    store.reset();
    store.setRefresh(refresh);
    void run();

    const onVisibility = () => {
      if (isHidden()) {
        clearTimer();
        store.set({ status: "paused", retryAt: null });
        return;
      }
      const due = failures.current > 0 || Date.now() - lastOkAt.current >= intervalMs;
      if (due) void run();
      else {
        store.set({ status: "live" });
        clearTimer();
        timer.current = setTimeout(run, intervalMs - (Date.now() - lastOkAt.current));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      alive.current = false;
      clearTimer();
      document.removeEventListener("visibilitychange", onVisibility);
      store.setRefresh(null);
    };
  }, [run, refresh, store, intervalMs]);

  return { data, error, refresh };
}
