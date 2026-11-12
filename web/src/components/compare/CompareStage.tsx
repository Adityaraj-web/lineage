"use client";

import { ArrowUpRight, RotateCcw } from "lucide-react";
import { animate, motion, useInView, useMotionValue, useScroll, useTransform, type AnimationPlaybackControls, type MotionValue } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/components/cn";
import { Glass } from "@/components/Glass";
import { usePinned } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { type VaultKey } from "@/lib/config";
import { fmtUsdc } from "@/lib/format";
import type { CompareRow, CompareSide, CompareView } from "@/lib/views";
import { AccountId, shortId } from "../AccountId";
import { Memo } from "../Memo";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { Seal } from "../Seal";
import { useSmoothScroll } from "../SmoothScroll";
import { StatusPill } from "../StatusPill";
import { Counter } from "../story/Counter";
import { useCount, useStep } from "../story/progress";
import { accentHex, badgeAccent, type Accent } from "../tone";

const REPLAY_SECONDS = 6;
const STACKED_SECONDS = 3;

export function compareSummary(view: CompareView): string {
  const row = view.rows.find((r) => r.poisoned);
  const l = row?.sides.vault.payment?.status;
  const g = row?.sides.guarded.payment?.status;
  const lineage = !l
    ? "Lineage has no record of the poisoned invoice"
    : l === "AwaitingApproval"
      ? "Lineage held the poisoned invoice"
      : l === "Rejected"
        ? "Lineage held the poisoned invoice and you rejected it"
        : l === "Paid" || l === "Sending"
          ? "Lineage held the poisoned invoice until you approved it"
          : "Lineage blocked the poisoned invoice";
  const limits = !g
    ? "LimitsOnly has no record of it"
    : g === "Paid" || g === "Sending"
      ? "LimitsOnly paid it"
      : g === "AwaitingApproval"
        ? "LimitsOnly is holding it"
        : "LimitsOnly did not pay it";
  return `Same agent, same plan${view.sameCode ? ", same code" : ""}. ${lineage}; ${limits}.`;
}

const gatedStatus = (s: CompareSide) => {
  const st = s.payment?.status;
  return st === "AwaitingApproval" || st === "Rejected" || st === "Blocked";
};
const sideAccent = (s: CompareSide): Accent => (s.badge ? badgeAccent[s.badge.tone] : "neutral");

// Each row's share of the stage's progress; everything has landed by 85%.
interface RowTiming {
  draw: [number, number]; // both threads to their gate point
  finish: Record<VaultKey, [number, number]>; // gate closes, or the thread runs on to the vault
  land: Record<VaultKey, [number, number]>; // the outcome appears
}
function rowTiming(row: CompareRow, clean: number): RowTiming {
  if (row.poisoned)
    return {
      draw: [0.4, 0.5],
      finish: { vault: [0.5, 0.58], guarded: [0.58, 0.68] },
      land: { vault: [0.53, 0.58], guarded: [0.64, 0.68] },
    };
  const s = 0.08 + clean * 0.16;
  return {
    draw: [s, s + 0.08],
    finish: { vault: [s + 0.08, s + 0.12], guarded: [s + 0.08, s + 0.12] },
    land: { vault: [s + 0.11, s + 0.15], guarded: [s + 0.11, s + 0.15] },
  };
}

// The thread from the request (centre) out to one vault: draws to the gate point, then either stops
// at a closed gate or runs on. Transform only (scaleX on two bars).
function Track({ dir, side, t, k, p }: { dir: "left" | "right"; side: CompareSide; t: RowTiming; k: VaultKey; p: MotionValue<number> }) {
  const gated = gatedStatus(side);
  const color = accentHex[sideAccent(side)];
  const a = useStep(p, t.draw[0], t.draw[1]);
  const b = useStep(p, t.finish[k][0], t.finish[k][1]);
  const aT = useTransform(a, (v) => `scaleX(${v})`);
  const bT = useTransform(b, (v) => `scaleX(${v})`);
  const origin = dir === "left" ? "origin-right" : "origin-left";
  const near = dir === "left" ? "right-0" : "left-0";
  const far = dir === "left" ? "left-0" : "right-0";
  return (
    <div className="relative hidden h-full min-h-14 md:block" aria-hidden="true">
      <span className="absolute inset-x-0 top-1/2 h-px bg-white/[0.07]" />
      <motion.span className={cn("absolute top-1/2 h-[2px] w-[60%] -translate-y-1/2", near, origin)} style={{ background: color, boxShadow: `0 0 8px 1px ${color}40`, transform: aT }} />
      {gated ? (
        <>
          <motion.span
            className={cn("absolute top-1/2 h-9 w-[3px] -translate-y-1/2 rounded-full", dir === "left" ? "left-[38%]" : "right-[38%]")}
            style={{ background: color, opacity: b }}
          />
          <motion.span
            className={cn("absolute top-1/2 size-14 -translate-y-1/2 rounded-full", dir === "left" ? "left-[calc(38%-1.6rem)]" : "right-[calc(38%-1.6rem)]")}
            style={{ background: `radial-gradient(circle, ${color}55, transparent 70%)`, opacity: b }}
          />
        </>
      ) : (
        <motion.span className={cn("absolute top-1/2 h-[2px] w-[40%] -translate-y-1/2", far, origin)} style={{ background: color, boxShadow: `0 0 8px 1px ${color}40`, transform: bT }} />
      )}
    </div>
  );
}

function StageSide({ k, side, t, p, poisoned }: { k: VaultKey; side: CompareSide; t: RowTiming; p: MotionValue<number>; poisoned: boolean }) {
  const land = useStep(p, t.land[k][0], t.land[k][1]);
  const attackerPaid = poisoned && k === "guarded" && side.payment?.status === "Paid";
  return (
    <Glass
      as={motion.div}
      className={cn(
        "flex min-w-0 flex-col items-start gap-2 rounded-2xl p-3 md:p-3.5 short:py-2",
        attackerPaid ? "[--glass-edge:rgb(251_113_133/0.6)] [--glass-ink:0.5]" : poisoned && gatedStatus(side) ? "[--glass-edge:rgb(251_191_36/0.6)]" : "",
        k === "guarded" && "md:items-end md:text-right",
      )}
      style={{ opacity: land }}
    >
      <p className="text-micro text-muted-foreground md:hidden">{k === "vault" ? "Lineage" : "LimitsOnly"}</p>
      {side.payment && side.badge ? (
        <>
          <ProvenanceBadge badge={{ ...side.badge, detail: "" }} wrap />
          <span className="flex flex-wrap items-center gap-2">
            <StatusPill status={side.payment.status} accent={attackerPaid ? "attacker" : undefined} />
            <span className="num text-small text-foreground">{side.amount}</span>
          </span>
        </>
      ) : (
        <p className="text-small text-muted-foreground">{side.statusLabel}</p>
      )}
    </Glass>
  );
}

function StageRow({ row, t, p }: { row: CompareRow; t: RowTiming; p: MotionValue<number> }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(2.5rem,5rem)_minmax(12rem,17rem)_minmax(2.5rem,5rem)_minmax(0,1fr)] md:items-center md:gap-0")}>
      <div className="order-2 md:order-none">
        <StageSide k="vault" side={row.sides.vault} t={t} p={p} poisoned={row.poisoned} />
      </div>
      <Track dir="left" side={row.sides.vault} t={t} k="vault" p={p} />
      <Glass
        className={cn(
          "order-1 col-span-2 rounded-2xl px-4 py-3 md:order-none md:col-span-1",
          row.poisoned && "[--glass-edge:rgb(251_113_133/0.6)] [--glass-ink:0.5]",
        )}
      >
        <p className="text-small leading-snug text-foreground">
          <Memo text={row.subject} />
        </p>
        {row.poisoned && <p className="mt-1 text-micro text-attacker">Poisoned: new payout details</p>}
      </Glass>
      <Track dir="right" side={row.sides.guarded} t={t} k="guarded" p={p} />
      <div className="order-3 md:order-none">
        <StageSide k="guarded" side={row.sides.guarded} t={t} p={p} poisoned={row.poisoned} />
      </div>
    </div>
  );
}

function Stage({ view, p, settled, onReplay }: { view: CompareView; p: MotionValue<number>; settled: boolean; onReplay: (() => void) | null }) {
  const count = useStep(p, 0.68, 0.8);
  const counted = { vault: useCount(count, view.attackerReceived.vault), guarded: useCount(count, view.attackerReceived.guarded) };
  const fixed = { vault: useMotionValue(fmtUsdc(view.attackerReceived.vault)), guarded: useMotionValue(fmtUsdc(view.attackerReceived.guarded)) };
  useEffect(() => {
    fixed.vault.set(fmtUsdc(view.attackerReceived.vault));
    fixed.guarded.set(fmtUsdc(view.attackerReceived.guarded));
  }, [view.attackerReceived.vault, view.attackerReceived.guarded, fixed.vault, fixed.guarded]);
  const text = settled ? fixed : counted;

  const split = useStep(p, 0.4, 0.5);
  const flash = useTransform(p, [0.62, 0.65, 0.72], [0, 1, 0.4]);
  const seal = useStep(p, 0.78, 0.85);
  const sealT = useTransform(seal, (v) => `scale(${1.12 - 0.12 * v}) rotate(${-8 + 8 * v}deg)`);
  const replayIn = useStep(p, 0.8, 0.85);
  let clean = 0;

  return (
    <Glass tier="stage" className="overflow-hidden p-4 md:p-8 short:p-5">
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(70%_60%_at_30%_70%,rgb(52_211_153/0.08),transparent_70%)]" style={{ opacity: split }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(70%_60%_at_70%_70%,rgb(251_113_133/0.10),transparent_70%)]" style={{ opacity: split }} />
      <motion.div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(60%_50%_at_80%_80%,rgb(251_113_133/0.18),transparent_70%)]" style={{ opacity: flash }} />

      <div className="relative flex flex-wrap items-end gap-x-6 gap-y-5">
        <Counter vault="vault" value={view.attackerReceived.vault} text={text.vault} testId="attacker-vault" label="Attacker received from Lineage" className="flex-1" />
        <p className="hidden shrink-0 pb-2 text-center text-micro text-muted-foreground md:block">
          attacker
          <span className="block font-mono text-[12px] text-attacker">{shortId(view.attacker)}</span>
        </p>
        <Counter
          vault="guarded"
          value={view.attackerReceived.guarded}
          text={text.guarded}
          testId="attacker-guarded"
          label="Attacker received from LimitsOnly"
          className="flex-1 md:text-right"
        />
      </div>

      <div className="relative mt-6 flex flex-col gap-3 md:mt-8 short:mt-4 short:gap-2" aria-hidden="true">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(2.5rem,5rem)_minmax(12rem,17rem)_minmax(2.5rem,5rem)_minmax(0,1fr)] text-small font-semibold md:grid">
          <span>Lineage vault</span>
          <span />
          <span className="text-center text-muted-foreground">What the agent asked</span>
          <span />
          <span className="text-right">LimitsOnly vault</span>
        </div>
        {view.rows.map((row) => (
          <StageRow key={row.message} row={row} t={rowTiming(row, row.poisoned ? 0 : clean++)} p={p} />
        ))}
      </div>

      <div className="relative mt-6 flex items-center justify-center gap-6 md:mt-8 short:mt-4">
        <motion.div style={{ opacity: seal, transform: sealT }}>
          <Seal hashes={view.codeHashes} sameCode={view.sameCode} shortPill />
        </motion.div>
        {onReplay && (
          <motion.button
            type="button"
            onClick={onReplay}
            style={{ opacity: replayIn }}
            className="press inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-raised px-4 text-small text-foreground transition-colors duration-150 hover-fine:bg-raised-2 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Replay
          </motion.button>
        )}
      </div>
    </Glass>
  );
}

function TxLink({ side, vault }: { side: CompareSide; vault: VaultKey }) {
  if (!side.txUrl) return null;
  return (
    <a
      href={side.txUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View the ${vault === "vault" ? "Lineage" : "LimitsOnly"} transaction on NEAR Blocks`}
      className="inline-grid size-7 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover-fine:bg-white/[0.06] hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
    >
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </a>
  );
}

function TableSide({ side, vault }: { side: CompareSide; vault: VaultKey }) {
  return (
    <div data-testid={`side-${vault}`} className="flex min-w-0 flex-col gap-2">
      <p className="text-micro text-muted-foreground md:hidden">{vault === "vault" ? "Lineage vault" : "LimitsOnly vault"}</p>
      {side.payment && side.badge ? (
        <>
          <ProvenanceBadge badge={side.badge} compact />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusPill status={side.payment.status} />
            <span className="num text-small">{side.amount}</span>
            <TxLink side={side} vault={vault} />
          </div>
          {side.payee && <AccountId id={side.payee} className="text-[12px]" />}
        </>
      ) : (
        <p className="text-small text-faint">{side.statusLabel}</p>
      )}
    </div>
  );
}

function PaymentsInRun({ view }: { view: CompareView }) {
  return (
    <section aria-labelledby="run-payments-title" className="mt-24">
      <h2 id="run-payments-title" className="font-serif text-title">
        Every payment in this run
      </h2>
      <Glass className="mt-6 overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-6 border-b border-hairline px-5 py-3 text-small text-muted-foreground md:grid">
        <span>What the agent asked</span>
        <span>Lineage vault</span>
        <span>LimitsOnly vault</span>
      </div>
      <ol className="flex flex-col divide-y divide-white/[0.05]">
        {view.rows.map((row, i) => (
          <li
            key={row.message}
            data-testid={`compare-row-${i}`}
            data-poisoned={String(row.poisoned)}
            className={cn(
              "grid gap-4 p-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-6 md:px-5 md:py-5",
              row.poisoned && "chip-ink bg-attacker-soft",
            )}
          >
            <div>
              <p className="text-body text-foreground">
                <Memo text={row.subject} />
              </p>
              {row.poisoned && <p className="mt-1 text-micro text-attacker">Poisoned: new payout details</p>}
            </div>
            <TableSide side={row.sides.vault} vault="vault" />
            <TableSide side={row.sides.guarded} vault="guarded" />
          </li>
        ))}
      </ol>
      </Glass>
    </section>
  );
}

// The demo run told by scroll: pinned for 250vh where there's room, played once in view otherwise,
// settled under reduced motion. Replay drives the same progress by time and gives scroll back on
// any input. `settled` (the data was already cached, e.g. from the Overview) shows the counters'
// final values at once so the shared counter can morph in.
export function CompareStage({ view, settled = false }: { view: CompareView; settled?: boolean }) {
  const reduced = useReducedMotionPref();
  const pinned = usePinned() && !reduced;
  const smooth = useSmoothScroll();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useMotionValue(reduced ? 1 : 0);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const replay = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (reduced) {
      p.set(1);
      return;
    }
    if (!pinned) return;
    p.set(scrollYProgress.get());
    return scrollYProgress.on("change", (v) => {
      if (!replay.current) p.set(v);
    });
  }, [reduced, pinned, scrollYProgress, p]);

  useEffect(() => {
    if (reduced || pinned || !inView || replay.current) return;
    const c = animate(p, 1, { duration: STACKED_SECONDS, ease: "linear" });
    return () => c.stop();
  }, [reduced, pinned, inView, p]);

  const stopReplay = useCallback(() => replay.current?.stop(), []);
  useEffect(() => stopReplay, [stopReplay]);

  const onReplay = useCallback(() => {
    stopReplay();
    const events = ["wheel", "touchstart", "keydown"] as const;
    let done = false;
    let controls: AnimationPlaybackControls | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      replay.current = null;
      for (const e of events) window.removeEventListener(e, cancel);
      smooth.start();
    };
    const cancel = () => {
      controls?.stop();
      finish();
      if (pinned) p.set(scrollYProgress.get());
    };
    replay.current = { stop: cancel };
    smooth.stop();
    // The click's own keydown (Enter or Space) has already fired, so any input from here cancels.
    for (const e of events) window.addEventListener(e, cancel, { passive: true });
    p.set(0);
    controls = animate(p, 1, { duration: pinned ? REPLAY_SECONDS : STACKED_SECONDS, ease: "linear", onComplete: finish });
  }, [p, pinned, scrollYProgress, smooth, stopReplay]);

  const stage = <Stage view={view} p={p} settled={settled || reduced} onReplay={reduced ? null : onReplay} />;
  return (
    <>
      {pinned ? (
        <section ref={ref} aria-label="The demo run, side by side" className="relative" style={{ height: "250vh" }}>
          <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center-safe py-4">{stage}</div>
        </section>
      ) : (
        <section ref={ref} aria-label="The demo run, side by side">
          {stage}
        </section>
      )}
      <PaymentsInRun view={view} />
    </>
  );
}
