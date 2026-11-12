"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

export type PollStatus = "loading" | "live" | "paused" | "error";
export interface PollError {
  name: string;
  message: string;
}

// What the header shows about the current page's polling. Kept outside the page's state so a
// poll that returns identical data re-renders only the live indicator.
export interface LiveStatus {
  status: PollStatus;
  updatedAt: number | null;
  changedAt: number | null;
  error: PollError | null;
  retryAt: number | null;
}

export const INITIAL_LIVE_STATUS: LiveStatus = {
  status: "loading",
  updatedAt: null,
  changedAt: null,
  error: null,
  retryAt: null,
};

export interface LiveStore {
  get(): LiveStatus;
  set(patch: Partial<LiveStatus>): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
  refresh(): void;
  setRefresh(fn: (() => void) | null): void;
}

export function createLiveStore(): LiveStore {
  let state = INITIAL_LIVE_STATUS;
  let refreshFn: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      emit();
    },
    reset() {
      state = INITIAL_LIVE_STATUS;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: () => refreshFn?.(),
    setRefresh(fn) {
      refreshFn = fn;
    },
  };
}

export const LiveStoreContext = createContext<LiveStore>(createLiveStore());

export const useLiveStore = (): LiveStore => useContext(LiveStoreContext);

export function useLiveStatus(): LiveStatus {
  const store = useLiveStore();
  return useSyncExternalStore(store.subscribe, store.get, () => INITIAL_LIVE_STATUS);
}
