"use client";

import Lenis from "lenis";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { FINE_POINTER_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";

interface SmoothScrollApi {
  stop(): void;
  start(): void;
}

const Ctx = createContext<SmoothScrollApi>({ stop() {}, start() {} });
export const useSmoothScroll = (): SmoothScrollApi => useContext(Ctx);

// Weighted wheel scrolling (Lenis) for mouse and trackpad. It moves the window's real scroll
// position, so motion's useScroll and the scrollbar stay truthful. Off under reduced motion and on
// coarse pointers; Replay stops it while it drives a scene.
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotionPref();
  const fine = useMediaQuery(FINE_POINTER_QUERY);
  const lenis = useRef<Lenis | null>(null);

  useEffect(() => {
    if (reduced || !fine) return;
    const l = new Lenis({ lerp: 0.12, smoothWheel: true, syncTouch: false, anchors: true, autoRaf: true });
    lenis.current = l;
    return () => {
      l.destroy();
      lenis.current = null;
    };
  }, [reduced, fine]);

  const api = useMemo<SmoothScrollApi>(
    () => ({ stop: () => lenis.current?.stop(), start: () => lenis.current?.start() }),
    [],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
