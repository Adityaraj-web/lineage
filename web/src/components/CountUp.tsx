"use client";

import { animate } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { EASE_COUNT } from "./motion";

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

// The largest power of ten (<= max) dividing both ends, so a count to 49 tUSDC steps in whole
// tUSDC and never shows more digits than the value it lands on.
export function countQuantum(a: bigint, b: bigint, max = 1_000_000n): bigint {
  let q = 1n;
  while (q * 10n <= max && a % (q * 10n) === 0n && b % (q * 10n) === 0n) q *= 10n;
  return q;
}

// Counts from the previous value (0 on mount) to `value`, in tabular figures, so the width only
// changes with the digit count. A hidden sizer holds the wider of the two ends: no layout shift.
// Screen readers get only the final value.
export function CountUp({
  value,
  format,
  className,
  align = "start",
  duration,
  delay = 0,
}: {
  value: bigint;
  format: (v: bigint) => string;
  className?: string;
  align?: "start" | "end" | "center";
  duration?: number;
  delay?: number;
}) {
  const reduced = useReducedMotionPref();
  // The value currently on screen; a new target counts on from here.
  const cur = useRef<bigint>(0n);
  const [shown, setShown] = useState<bigint | null>(null);
  const [from, setFrom] = useState<bigint>(0n);

  useLayoutEffect(() => {
    const start = cur.current;
    if (reduced || start === value || value > SAFE || start > SAFE || value < 0n) {
      cur.current = value;
      setShown(null);
      return;
    }
    setFrom(start);
    setShown(start);
    const first = start === 0n;
    const q = countQuantum(start, value);
    const controls = animate(Number(start), Number(value), {
      duration: duration ?? (first ? 1.2 : 0.6),
      delay,
      ease: EASE_COUNT,
      onUpdate: (v) => {
        cur.current = (BigInt(Math.round(v)) / q) * q;
        setShown(cur.current);
      },
      onComplete: () => {
        cur.current = value;
        setShown(null);
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration, delay]);

  const final = format(value);
  const cell = "col-start-1 row-start-1";
  const animating = shown !== null;
  return (
    <span
      className={cn(
        "num inline-grid whitespace-nowrap",
        align === "end" ? "justify-items-end" : align === "center" ? "justify-items-center" : "justify-items-start",
        className,
      )}
    >
      <span aria-hidden="true" className={cn(cell, "invisible")}>
        {format(from > value ? from : value)}
      </span>
      <span aria-hidden="true" data-countup={animating ? "counting" : "final"} className={cell}>
        {animating ? format(shown) : final}
      </span>
      <span className="sr-only">{final}</span>
    </span>
  );
}
