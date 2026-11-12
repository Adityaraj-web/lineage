"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener?.("change", onChange);
  return () => mql.removeEventListener?.("change", onChange);
}

const getSnapshot = (): boolean =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;

// Prerendered HTML uses the static (reduced) frame, so first paint reads correctly without JS.
const getServerSnapshot = (): boolean => true;

// Live prefers-reduced-motion. motion's useReducedMotion caches the first answer per page load.
export function useReducedMotionPref(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
