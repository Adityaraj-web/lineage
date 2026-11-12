"use client";

import { CircleCheck, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { RISK_DISCLAIMER, type FindingTone, type RiskCard as Risk, type RiskLevel } from "@/lib/risk";
import { EASE_OUT } from "../motion";
import { accentClass, findingAccent, levelAccent } from "../tone";

export const FINDINGS_START = 0.55;
export const FINDING_STAGGER = 0.12;
export const findingDelay = (i: number) => FINDINGS_START + i * FINDING_STAGGER;

const LEVELS: RiskLevel[] = ["low", "medium", "high"];
const LEVEL_WORD: Record<RiskLevel, string> = { high: "High risk", medium: "Medium risk", low: "Low risk" };
const ICON: Record<FindingTone, typeof Info> = {
  danger: ShieldAlert,
  warn: TriangleAlert,
  info: Info,
  ok: CircleCheck,
};

export function RiskMeter({ level, play }: { level: RiskLevel; play: boolean }) {
  const reduced = useReducedMotionPref();
  const upTo = LEVELS.indexOf(level);
  const a = accentClass[levelAccent[level]];
  return (
    <div className="flex items-center gap-3" data-meter data-level={level}>
      <div className="flex gap-1" aria-hidden="true">
        {LEVELS.map((l, i) => (
          <span key={l} className="relative h-2 w-9 overflow-hidden rounded-full bg-white/[0.07]">
            {i <= upTo && (
              <motion.span
                className={cn("absolute inset-0 origin-left rounded-full", a.solid)}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: play || reduced ? 1 : 0 }}
                transition={{ duration: 0.18, delay: i * 0.18, ease: EASE_OUT }}
              />
            )}
          </span>
        ))}
      </div>
      <span className={cn("text-small font-semibold", a.text)}>
        {LEVEL_WORD[level]}
      </span>
    </div>
  );
}

// Advisory only: the vault already refused to auto-pay. `play` starts the reveal; without it the
// card reveals itself when scrolled into view.
export function RiskCard({ risk, play }: { risk: Risk; play?: boolean }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const on = reduced || (play ?? inView);
  const levelA = accentClass[levelAccent[risk.level]];

  return (
    <div ref={ref} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label">Risk card</p>
        <RiskMeter level={risk.level} play={on} />
      </div>

      <p data-testid="risk-summary" className="text-[1.0625rem] leading-relaxed text-foreground">
        {risk.summary}
      </p>

      <ul className="flex flex-col gap-2.5" aria-label="Findings">
        {risk.findings.map((f, i) => {
          const Icon = ICON[f.tone];
          const a = accentClass[findingAccent[f.tone]];
          return (
            <motion.li
              key={f.id}
              data-finding={f.id}
              data-tone={f.tone}
              initial={reduced ? false : { opacity: 0, x: -6 }}
              animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.3, delay: reduced ? 0 : findingDelay(i), ease: EASE_OUT }}
              className={cn(
                "flex gap-3 rounded-xl border px-3.5 py-2.5 text-small",
                f.id === "duplicate-reference" ? cn(a.border, a.soft) : "border-white/[0.06] bg-white/[0.02]",
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", a.text)} aria-hidden="true" />
              <span className="sr-only">{f.tone === "ok" ? "OK" : f.tone}:</span>
              <span className="text-muted-foreground [overflow-wrap:anywhere]">{f.text}</span>
            </motion.li>
          );
        })}
      </ul>

      {risk.advice && (
        <p className={cn("rounded-xl border px-4 py-3 text-small", levelA.border, levelA.soft, levelA.text)}>
          {risk.advice}
        </p>
      )}

      <p className="flex items-start gap-2 text-[12px] text-faint">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {RISK_DISCLAIMER}
      </p>
    </div>
  );
}
