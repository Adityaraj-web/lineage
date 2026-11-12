"use client";

import { useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import type { RefObject } from "react";
import { fmtUsdc } from "@/lib/format";

export type SceneMode = "pinned" | "static";

// Scene progress: scroll through a pinned section (0..1), or the settled end state.
export function useSceneProgress(ref: RefObject<HTMLElement | null>, mode: SceneMode): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const settled = useMotionValue(1);
  return mode === "pinned" ? scrollYProgress : settled;
}

// 0..1 over [a, b] of the scene's progress.
export function useStep(p: MotionValue<number>, a: number, b: number): MotionValue<number> {
  return useTransform(p, [a, b], [0, 1], { clamp: true });
}

// A tUSDC amount counted in whole tUSDC over a step, landing exactly on the live value.
export function useCount(step: MotionValue<number>, value: bigint): MotionValue<string> {
  return useTransform(step, (s) => {
    if (s >= 1 || value <= 0n) return fmtUsdc(value);
    const whole = Number(value / 1_000_000n);
    return `${Math.round(whole * s)} tUSDC`;
  });
}

// Viewbox coordinates (the scene's SVG) as CSS percentages of the same box.
export const pct = (v: number, of: number): string => `${(v / of) * 100}%`;
