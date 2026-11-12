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

// Counts from the previous value (0 on mount) to `value`. While counting, digits render in Geist
// Mono (fixed width); at rest the value renders in `finalClassName` (e.g. the display serif, which
// has no tabular figures). Hidden sizers in the same grid cell hold the widest of both, so the
// layout never shifts. Screen readers get only the final value.
export function CountUp({
  value,
  format,
  className,
  finalClassName,
  align = "start",
  duration,
  delay = 0,
}: {
  value: bigint;
  format: (v: bigint) => string;
  className?: string;
  finalClassName?: string;
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
        "inline-grid whitespace-nowrap tabular-nums",
        align === "end" ? "justify-items-end" : align === "center" ? "justify-items-center" : "justify-items-start",
        className,
      )}
    >
      <span aria-hidden="true" className={cn(cell, "invisible", finalClassName)}>
        {final}
      </span>
      <span aria-hidden="true" className={cn(cell, "invisible font-mono")}>
        {format(from > value ? from : value)}
      </span>
      {animating ? (
        <span aria-hidden="true" data-countup="counting" className={cn(cell, "font-mono")}>
          {format(shown)}
        </span>
      ) : (
        <span aria-hidden="true" data-countup="final" className={cn(cell, finalClassName)}>
          {final}
        </span>
      )}
      <span className="sr-only">{final}</span>
    </span>
  );
}
