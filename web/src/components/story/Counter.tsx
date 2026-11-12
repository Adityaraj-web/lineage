"use client";

import { motion, type MotionValue } from "motion/react";
import { cn } from "@/components/cn";
import { fmtUsdc } from "@/lib/format";
import { Shared } from "../transitions";

// What the attacker received from one vault. The visible text is a MotionValue (it counts with a
// scene); screen readers get the final amount. The LimitsOnly counter is the shared element that
// morphs between the Overview and Compare.
export function Counter({
  vault,
  value,
  text,
  testId,
  label,
  className,
}: {
  vault: "vault" | "guarded";
  value: bigint;
  text: MotionValue<string>;
  testId: string;
  label: string;
  className?: string;
}) {
  const visible = (
    <span className={cn("stat", value > 0n ? "text-attacker" : "text-p1")} aria-hidden="true">
      <motion.span className="inline-block">{text}</motion.span>
    </span>
  );
  return (
    <div data-testid={testId} className={cn("stat-box", className)}>
      <p className="text-micro text-muted-foreground">{label}</p>
      <div className="mt-1.5">{vault === "guarded" ? <Shared name="attacker-guarded">{visible}</Shared> : visible}</div>
      <span className="sr-only">{fmtUsdc(value)}</span>
    </div>
  );
}
