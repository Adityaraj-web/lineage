"use client";

import { useCallback, useSyncExternalStore } from "react";

// Live media query. `server` is the answer for prerendered HTML (and the first paint before JS).
export function useMediaQuery(query: string, server = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener?.("change", onChange);
      return () => mql.removeEventListener?.("change", onChange);
    },
    [query],
  );
  const get = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, get, () => server);
}

// Pinned scroll scenes need room; below this they become stacked steps.
export const PINNED_QUERY = "(min-width: 768px) and (min-height: 620px)";
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
export const usePinned = (): boolean => useMediaQuery(PINNED_QUERY);
