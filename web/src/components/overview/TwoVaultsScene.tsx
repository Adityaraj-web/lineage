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
import { fmtUsdc } from "@/lib/format";
import type { CompareView } from "@/lib/views";
import { shortId } from "../AccountId";
import { pct, useCount, useSceneProgress, useStep } from "../story/progress";
import { PinnedSection, SceneBox, useInViewProgress } from "../story/Scene";
import { Counter } from "../story/Counter";
import { GlowPath } from "../story/GlowPath";

const W = 1200;
const H = 640;
const L = 300;
const R = 900;
const GATE_Y = 300;
const NODE = { x: 1080, y: 360 };
const COUNTER_Y = 420;
const SETTLED = 0.85;
const TOKEN = /(\b[A-Z]{1,5}-\d{1,8}\b)/;

// Invoice-like tokens ("A-102") never break at their hyphen.
function KeepTokens({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i) =>
        i % 2 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

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
  const label = "absolute whitespace-nowrap text-[clamp(0.6875rem,1.25cqi,0.9375rem)] leading-none font-semibold";
  const chars = Math.max(fmtUsdc(d.received.vault).length, fmtUsdc(d.received.guarded).length);

  return (
    <Glass as={motion.div} tier="stage" className="overflow-hidden p-[clamp(1rem,2.5vw,2.5rem)]" style={{ opacity: stageIn, transform: stageT }}>
      <motion.div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-1/2 bg-[radial-gradient(60%_60%_at_70%_60%,rgb(251_113_133/0.16),transparent_70%)]" style={{ opacity: flash }} aria-hidden="true" />
      <motion.div className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-1/2 bg-[radial-gradient(50%_40%_at_50%_52%,rgb(251_191_36/0.12),transparent_70%)]" style={{ opacity: hold }} aria-hidden="true" />
      <SceneBox w={W} h={H} fit={fit} reserve="20rem">
        <Glass className="absolute flex flex-col items-center justify-center gap-1 px-4 text-center" style={{ left: pct(330, W), width: pct(540, W), top: 0, height: pct(120, H) }}>
          {email && <p className="max-w-full truncate text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground @max-[48rem]:hidden">{email.fromAddress}</p>}
          <p className="line-clamp-2 text-[clamp(0.75rem,1.4cqi,1rem)] leading-snug font-semibold [text-wrap:balance]">
            <KeepTokens text={email?.subject || d.row?.subject || ""} />
          </p>
          <p className="num text-[clamp(0.75rem,1.2cqi,0.9375rem)] text-p3">{d.amount}</p>
        </Glass>
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" fill="none">
          <defs>
            <radialGradient id="scene3-amber">
              <stop offset="0" stopColor="#fbbf24" stopOpacity="0.6" />
              <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
            </radialGradient>
          </defs>
          <GlowPath d="M 600 120 L 600 180" color="var(--color-p3)" style={{ pathLength: drop, opacity: dropOn }} />
          <GlowPath d={`M 600 180 C 600 250, ${L} 220, ${L} ${GATE_Y - 6}`} color="var(--color-p3)" style={{ pathLength: split, opacity: splitOn }} />
          <GlowPath d={`M 600 180 C 600 250, ${R} 220, ${R} ${GATE_Y - 6}`} color="var(--color-p3)" style={{ pathLength: split, opacity: splitOn }} />
          <GlowPath
            d={`M ${R} ${GATE_Y + 6} L ${R} ${NODE.y - 30} C ${R} ${NODE.y - 8}, ${R + 22} ${NODE.y}, ${R + 52} ${NODE.y} L ${NODE.x - 12} ${NODE.y}`}
            color="var(--color-attacker)"
            style={{ pathLength: pass, opacity: passOn }}
          />
          <motion.path d={`M ${R} ${GATE_Y + 6} L ${R} ${NODE.y - 30}`} stroke="var(--color-p3)" strokeWidth="2" strokeLinecap="round" style={{ opacity: amberStub }} />
          <motion.circle cx={L} cy={GATE_Y} r="56" fill="url(#scene3-amber)" style={{ opacity: hold }} />
          {/* Gates: two halves that meet. Lineage stays shut and glows; LimitsOnly slides open. */}
          <rect x={L - 46} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" />
          <rect x={L + 2} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" />
          <motion.rect x={L - 46} y={GATE_Y - 2.5} width="92" height="5" rx="2.5" fill="var(--color-p3)" style={{ opacity: hold }} />
          <motion.rect x={R - 46} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" style={{ transform: openL }} />
          <motion.rect x={R + 2} y={GATE_Y - 2.5} width="44" height="5" rx="2.5" fill="rgb(255 255 255 / 0.28)" style={{ transform: openR }} />
          <motion.circle cx={NODE.x} cy={NODE.y} r="10" fill="var(--color-attacker)" style={{ opacity: flash }} />
          <circle cx={NODE.x} cy={NODE.y} r="10" stroke="var(--color-attacker)" strokeWidth="1.5" />
        </svg>
        {/* Fixed label slots: each sized for its text at the smallest box, never wrapping. */}
        <p className={`${label} text-right`} style={{ right: pct(W - (L - 100), W), top: pct(GATE_Y - 8, H) }}>
          Lineage vault
        </p>
        <p className={label} style={{ left: pct(R + 100, W), top: pct(GATE_Y - 8, H) }}>
          LimitsOnly vault
        </p>
        <p
          className="absolute -translate-x-1/2 text-[clamp(0.6875rem,1.1cqi,0.875rem)] leading-none whitespace-nowrap text-attacker"
          style={{ left: pct(NODE.x, W), top: pct(NODE.y + 22, H) }}
        >
          {d.attacker}
        </p>
        {(["vault", "guarded"] as const).map((k) => (
          <div
            key={k}
            className="absolute text-center"
            style={{ left: pct((k === "vault" ? L : R) - 200, W), width: pct(400, W), top: pct(COUNTER_Y, H) }}
          >
            <Counter
              vault={k}
              label={k === "vault" ? "Attacker received from Lineage" : "Attacker received from LimitsOnly"}
              value={d.received[k]}
              text={k === "vault" ? lText : rText}
              testId={`scene-attacker-${k}`}
              chars={chars}
              className="w-full [--stat-min:1.5rem]"
              labelClassName="whitespace-nowrap text-[clamp(0.6875rem,1.05cqi,0.8125rem)]"
            />
            <motion.p className={cn("mt-[clamp(0.25rem,0.8cqi,0.5rem)] text-[clamp(0.75rem,1.2cqi,0.9375rem)]", k === "vault" ? "text-p3" : "text-attacker")} style={{ opacity: labels }}>
              {k === "vault" ? (d.lineageHeld ? "Held for you" : "Paid after your approval") : d.limitsPaid ? "Paid without asking" : "Not paid"}
            </motion.p>
          </div>
        ))}
      </SceneBox>
      <motion.div className="relative mt-[clamp(0.75rem,1.5vw,1.5rem)] flex justify-center" style={{ opacity: labels, transform: btnT }}>
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
        <p className="mt-1 text-body font-semibold">
          <KeepTokens text={email?.subject || d.row?.subject || ""} />
        </p>
        <p className="num mt-1 text-small text-p3">{d.amount}</p>
      </Glass>
      {(["vault", "guarded"] as const).map((k) => (
        <Glass key={k} className="flex gap-4 p-4">
          <svg viewBox="0 0 12 96" className="h-24 w-3 shrink-0 overflow-visible" aria-hidden="true" fill="none">
            <GlowPath d="M 6 0 L 6 44" color="var(--color-p3)" style={{ pathLength: thread }} />
            {k === "vault" ? (
              <motion.rect x="-2" y="46" width="16" height="4" rx="2" fill="var(--color-p3)" style={{ opacity: hold }} />
            ) : (
              <>
                <rect x="-2" y="46" width="16" height="4" rx="2" fill="rgb(255 255 255 / 0.28)" />
                <GlowPath d="M 6 52 L 6 96" color="var(--color-attacker)" style={{ pathLength: pass }} />
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
