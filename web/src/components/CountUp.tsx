"use client";

import { animate } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { EASE_COUNT } from "./motion";

const SAFE = BigInt(Number.MAX_SAFE_INTEGER);

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
}: {
  value: bigint;
  format: (v: bigint) => string;
  className?: string;
  finalClassName?: string;
  align?: "start" | "end" | "center";
  duration?: number;
}) {
  const reduced = useReducedMotionPref();
  const prev = useRef<bigint>(0n);
  const [shown, setShown] = useState<bigint | null>(null);
  const [from, setFrom] = useState<bigint>(0n);

  useLayoutEffect(() => {
    const start = prev.current;
    prev.current = value;
    if (reduced || start === value || value > SAFE || start > SAFE || value < 0n) {
      setShown(null);
      return;
    }
    setFrom(start);
    setShown(start);
    const first = start === 0n;
    const controls = animate(Number(start), Number(value), {
      duration: duration ?? (first ? 1.2 : 0.6),
      ease: EASE_COUNT,
      onUpdate: (v) => setShown(BigInt(Math.round(v))),
      onComplete: () => setShown(null),
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  const final = format(value);
  const cell = "col-start-1 row-start-1";
  const animating = shown !== null;
  return (
    <span
      className={cn(
        "inline-grid tabular-nums",
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
