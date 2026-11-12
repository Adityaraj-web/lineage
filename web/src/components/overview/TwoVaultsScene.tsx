"use client";

import { ArrowRight } from "lucide-react";
import { motion, useTransform, type MotionValue } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { cn } from "@/components/cn";
import { Glass } from "@/components/Glass";
import { usePinned } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import type { Email } from "@/lib/emails";
import type { CompareView } from "@/lib/views";
import { shortId } from "../AccountId";
import { pct, useCount, useSceneProgress, useStep } from "../story/progress";
import { PinnedSection, SceneBox, useInViewProgress } from "../story/Scene";
import { Counter } from "../story/Counter";

const W = 1200;
const H = 500;
const L = 300;
const R = 900;
const GATE_Y = 372;
const SETTLED = 0.85;

// Every number here is live: the poisoned row's amount and what each vault paid the attacker.
function useTwoVaults(view: CompareView) {
  const row = view.rows.find((r) => r.poisoned) ?? null;
  return {
    row,
    amount: row?.sides.vault.amount ?? row?.sides.guarded.amount ?? "",
    attacker: shortId(view.attacker),
    received: view.attackerReceived,
    lineageHeld: row?.sides.vault.payment?.status !== "Paid",
    limitsPaid: row?.sides.guarded.payment?.status === "Paid",
  };
}


function Stage({ view, emails, p, fit }: { view: CompareView; emails: Record<string, Email>; p: MotionValue<number>; fit: boolean }) {
  const d = useTwoVaults(view);
  const email = d.row ? emails[d.row.message] : undefined;
  const stageIn = useStep(p, 0, 0.08);
  const drop = useStep(p, 0.08, 0.18);
  const split = useStep(p, 0.18, 0.32);
  const hold = useStep(p, 0.32, 0.42);
  const open = useStep(p, 0.42, 0.47);
  const pass = useStep(p, 0.45, 0.55);
  const flash = useTransform(p, [0.55, 0.58, 0.66], [0, 1, 0.35]);
  const count = useStep(p, 0.62, 0.78);
  const labels = useStep(p, 0.78, SETTLED);
  const lText = useCount(count, d.received.vault);
  const rText = useCount(count, d.received.guarded);
  const stageT = useTransform(stageIn, (v) => `scale(${0.98 + 0.02 * v})`);
  const shown = (v: number) => (v > 0.001 ? 1 : 0);
  const dropOn = useTransform(drop, shown);
  const splitOn = useTransform(split, shown);
  const passOn = useTransform(pass, shown);
  const amberStub = useTransform(pass, (v) => shown(v) * Math.max(0, 1 - v / 0.4));
  const openL = useTransform(open, (v) => `translateX(${-v * 42}px)`);
  const openR = useTransform(open, (v) => `translateX(${v * 42}px)`);
  const btnT = useTransform(labels, (v) => `translateY(${(1 - v) * 8}px)`);

  return (
    <Glass as={motion.div} tier="stage" className="overflow-hidden p-[clamp(1rem,2.5vw,2.5rem)]" style={{ opacity: stageIn, transform: stageT }}>
      <motion.div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(60%_60%_at_70%_70%,rgb(251_113_133/0.16),transparent_70%)]" style={{ opacity: flash }} aria-hidden="true" />
      <motion.div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(50%_40%_at_50%_62%,rgb(251_191_36/0.12),transparent_70%)]" style={{ opacity: hold }} aria-hidden="true" />
      <SceneBox w={W} h={H} fit={fit} reserve="34rem">
        <Glass className="absolute flex flex-col items-center justify-center gap-1 px-4 text-center" style={{ left: pct(300, W), width: pct(600, W), top: 0, height: pct(130, H) }}>
          {email && <p className="truncate text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground">{email.fromAddress}</p>}
          <p className="line-clamp-2 text-[clamp(0.8125rem,1.4cqi,1rem)] leading-snug font-semibold">{email?.subject || d.row?.subject}</p>
          <p className="num text-[clamp(0.75rem,1.2cqi,0.9375rem)] text-p3">{d.amount}</p>
        </Glass>
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" fill="none">
          <defs>
            <radialGradient id="scene3-amber">
              <stop offset="0" stopColor="#fbbf24" stopOpacity="0.6" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <motion.path d="M 600 130 L 600 220" stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: drop, opacity: dropOn }} />
          <motion.path d={`M 600 220 C 600 300, ${L} 260, ${L} ${GATE_Y - 6}`} stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: split, opacity: splitOn }} />
          <motion.path d={`M 600 220 C 600 300, ${R} 260, ${R} ${GATE_Y - 6}`} stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: split, opacity: splitOn }} />
          <motion.path d={`M ${R} ${GATE_Y + 6} L ${R} 420 C ${R} 444, ${R + 40} 452, ${R + 80} 452 L 1062 452`} stroke="var(--color-attacker)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: pass, opacity: passOn }} />
          <motion.path d={`M ${R} ${GATE_Y + 6} L ${R} 420`} stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ opacity: amberStub }} />
          <motion.circle cx={L} cy={GATE_Y} r="56" fill="url(#scene3-amber)" style={{ opacity: hold }} />
          {/* Gates: two halves that meet. Lineage stays shut and glows; LimitsOnly slides open. */}
          <rect x={L - 46} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" />
          <rect x={L + 2} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" />
          <motion.rect x={L - 46} y={GATE_Y - 2.5} width="92" height="5" rx="2.5" fill="var(--color-p3)" style={{ opacity: hold }} />
          <motion.rect x={R - 46} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" style={{ transform: openL }} />
          <motion.rect x={R + 2} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" style={{ transform: openR }} />
          <motion.circle cx="1072" cy="452" r="10" fill="var(--color-attacker)" style={{ opacity: flash }} />
          <circle cx="1072" cy="452" r="10" stroke="var(--color-attacker)" strokeWidth="1.5" />
        </svg>
        <p className="absolute text-right text-[clamp(0.75rem,1.2cqi,0.9375rem)] font-semibold" style={{ left: pct(L - 300, W), width: pct(240, W), top: pct(GATE_Y - 40, H) }}>
          Lineage vault
        </p>
        <p className="absolute text-[clamp(0.75rem,1.2cqi,0.9375rem)] font-semibold" style={{ left: pct(R + 60, W), width: pct(240, W), top: pct(GATE_Y - 40, H) }}>
          LimitsOnly vault
        </p>
        <p className="absolute text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-attacker" style={{ left: pct(1000, W), width: pct(200, W), top: pct(470, H), textAlign: "center" }}>
          {d.attacker}
        </p>
      </SceneBox>
      <div className="relative mt-[clamp(1rem,2vw,2rem)] grid grid-cols-2 gap-6">
        <div className="flex flex-col items-center text-center">
          <Counter vault="vault" label="Attacker received from Lineage" value={d.received.vault} text={lText} testId="scene-attacker-vault" className="w-full max-w-[22rem]" />
          <motion.p className="mt-2 text-small text-p3" style={{ opacity: labels }}>
            {d.lineageHeld ? "Held for you" : "Paid after your approval"}
          </motion.p>
        </div>
        <div className="flex flex-col items-center text-center">
          <Counter vault="guarded" label="Attacker received from LimitsOnly" value={d.received.guarded} text={rText} testId="scene-attacker-guarded" className="w-full max-w-[22rem]" />
          <motion.p className="mt-2 text-small text-attacker" style={{ opacity: labels }}>
            {d.limitsPaid ? "Paid without asking" : "Not paid"}
          </motion.p>
        </div>
      </div>
      <motion.div className="relative mt-6 flex justify-center" style={{ opacity: labels, transform: btnT }}>
        <Link
          href="/compare"
          className="press inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-small font-semibold text-ink transition-[background-color] duration-150 hover-fine:bg-white"
        >
          Watch it side by side <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </motion.div>
    </Glass>
  );
}

function Stacked({ view, emails, reduced }: { view: CompareView; emails: Record<string, Email>; reduced: boolean }) {
  const d = useTwoVaults(view);
  const email = d.row ? emails[d.row.message] : undefined;
  const ref = useRef<HTMLDivElement>(null);
  const p = useInViewProgress(ref, reduced, 2.2);
  const thread = useStep(p, 0, 0.35);
  const hold = useStep(p, 0.35, 0.5);
  const pass = useStep(p, 0.5, 0.65);
  const count = useStep(p, 0.65, 0.9);
  const labels = useStep(p, 0.9, 1);
  const lText = useCount(count, d.received.vault);
  const rText = useCount(count, d.received.guarded);
  return (
    <div ref={ref} className="mt-10 flex flex-col gap-4">
      <Glass className="p-4 [container-type:inline-size]">
        {email && <p className="truncate text-micro text-muted-foreground">{email.fromAddress}</p>}
        <p className="mt-1 text-body font-semibold">{email?.subject || d.row?.subject}</p>
        <p className="num mt-1 text-small text-p3">{d.amount}</p>
      </Glass>
      {(["vault", "guarded"] as const).map((k) => (
        <Glass key={k} className="flex gap-4 p-4">
          <svg viewBox="0 0 12 96" className="h-24 w-3 shrink-0 overflow-visible" aria-hidden="true" fill="none">
            <motion.path d="M 6 0 L 6 44" stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: thread }} />
            {k === "vault" ? (
              <motion.rect x="-2" y="46" width="16" height="4" rx="2" fill="var(--color-p3)" style={{ opacity: hold }} />
            ) : (
              <>
                <rect x="-2" y="46" width="16" height="4" rx="2" fill="rgb(255 255 255 / 0.28)" />
                <motion.path d="M 6 52 L 6 96" stroke="var(--color-attacker)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: pass }} />
              </>
            )}
          </svg>
          <div className="min-w-0 flex-1">
            <p className="text-small font-semibold">{k === "vault" ? "Lineage vault" : "LimitsOnly vault"}</p>
            <Counter vault={k} label={k === "vault" ? "Attacker received from Lineage" : "Attacker received from LimitsOnly"} value={d.received[k]} text={k === "vault" ? lText : rText} testId={`scene-attacker-${k}`} className="mt-2" />
            <motion.p className={cn("mt-2 text-small", k === "vault" ? "text-p3" : "text-attacker")} style={{ opacity: labels }}>
              {k === "vault" ? (d.lineageHeld ? "Held for you" : "Paid after your approval") : d.limitsPaid ? "Paid without asking" : "Not paid"}
            </motion.p>
          </div>
        </Glass>
      ))}
      <motion.div className="mt-2" style={{ opacity: labels }}>
        <Link href="/compare" className="press inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-small font-semibold text-ink">
          Watch it side by side <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </motion.div>
    </div>
  );
}

export function TwoVaultsScene({ view, emails }: { view: CompareView; emails: Record<string, Email> }) {
  const reduced = useReducedMotionPref();
  const pinned = usePinned();
  const ref = useRef<HTMLElement>(null);
  const mode = pinned && !reduced ? "pinned" : "static";
  const p = useSceneProgress(ref, mode);
  const heading = (
    <h2 id="two-vaults-title" className="font-serif text-display">
      Same request, two vaults.
    </h2>
  );
  if (!pinned)
    return (
      <section ref={ref} aria-labelledby="two-vaults-title" className="py-24">
        {heading}
        <Stacked view={view} emails={emails} reduced={reduced} />
      </section>
    );
  if (mode === "static")
    return (
      <section ref={ref} aria-labelledby="two-vaults-title" className="py-24">
        {heading}
        <div className="mt-10">
          <Stage view={view} emails={emails} p={p} fit={false} />
        </div>
      </section>
    );
  return (
    <PinnedSection ref={ref} heightVh={220} labelledBy="two-vaults-title">
      {heading}
      <div className="mt-6">
        <Stage view={view} emails={emails} p={p} fit />
      </div>
    </PinnedSection>
  );
}
