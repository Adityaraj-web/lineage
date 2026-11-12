"use client";

import { ArrowUpRight, Check, Lock, Mail, RotateCcw, ShieldCheck, ShieldOff, X } from "lucide-react";
import { motion, useInView, type TargetAndTransition, type Transition } from "motion/react";
import { useRef, useState } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { VAULT_IDS, type VaultKey } from "@/lib/config";
import { fmtUsdc } from "@/lib/format";
import type { CompareRow, CompareSide, CompareView } from "@/lib/views";
import { AccountId } from "../AccountId";
import { CountUp } from "../CountUp";
import { Memo } from "../Memo";
import { EASE_IN_OUT, EASE_OUT } from "../motion";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { StatusPill } from "../StatusPill";
import { accentClass, accentHex, badgeAccent, type Accent } from "../tone";

// One timeline, in seconds from the moment the stage is first in view.
const T = {
  seal: 0,
  rows: 0.3,
  rowStagger: 0.08,
  flow: 0.75, // the two clean rows, one after the other
  flowGap: 0.45,
  flowDur: 0.6,
  poison: 1.8,
  poisonDur: 0.9,
  counters: 2.9,
  summary: 4.1,
};
const GATE_AT = T.poison + T.poisonDur * 0.55;
const ARRIVE = T.poison + T.poisonDur;

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

interface Play {
  on: boolean;
  reduced: boolean;
}

// initial/animate/transition for an element that animates from `off` to `on` once the stage plays.
function play(p: Play, off: TargetAndTransition, on: TargetAndTransition, transition: Transition) {
  if (p.reduced) return { initial: false as const, animate: on };
  return { initial: off, animate: p.on ? on : off, transition };
}

const shortHash = (h: string) => (h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h);

function SameCodeSeal({ view, p }: { view: CompareView; p: Play }) {
  const same = view.sameCode;
  const ring = same ? "var(--color-p1)" : "var(--color-attacker)";
  return (
    <motion.div
      data-testid="same-code-seal"
      className={cn(
        "relative grid size-32 place-items-center rounded-full border bg-ink",
        same ? "border-p1-ring shadow-[0_0_40px_-8px_rgb(52_211_153/0.45)]" : "border-attacker-ring",
      )}
      {...play(
        p,
        { scale: 1.15, rotate: -8, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1 },
        { type: "spring", stiffness: 260, damping: 20, delay: T.seal },
      )}
    >
      <svg viewBox="0 0 128 128" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <path id="seal-ring" d="M64,64 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0" />
        </defs>
        <circle cx="64" cy="64" r="58" fill="none" stroke={ring} strokeOpacity="0.25" strokeDasharray="2 4" />
        <text className="fill-muted-foreground text-[10px] font-medium">
          <textPath href="#seal-ring">same agent · same plan · same contract ·</textPath>
        </text>
      </svg>
      <div className="relative flex flex-col items-center gap-0.5 text-center">
        {same ? (
          <Check className="size-4 text-p1" aria-hidden="true" />
        ) : (
          <X className="size-4 text-attacker" aria-hidden="true" />
        )}
        <span className={cn("text-[1rem] leading-tight font-semibold", same ? "text-p1" : "text-attacker")}>
          {same ? "same code" : "different code"}
        </span>
        {same && view.codeHashes.vault && (
          <>
            <span className="font-mono text-[10px] text-muted-foreground" aria-hidden="true">
              {shortHash(view.codeHashes.vault)}
            </span>
            <span className="sr-only">{view.codeHashes.vault}</span>
          </>
        )}
        {!same && (
          <span className="sr-only">
            Lineage {view.codeHashes.vault ?? "no code"}, LimitsOnly {view.codeHashes.guarded ?? "no code"}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// The lane a payment travels from the shared message (centre) out to one vault's outcome.
function Track({
  dir,
  accent,
  gated,
  delay,
  duration,
  p,
}: {
  dir: "left" | "right";
  accent: Accent;
  gated: boolean;
  delay: number;
  duration: number;
  p: Play;
}) {
  const color = accentHex[accent];
  const from = dir === "left" ? "100%" : "0%";
  const to = dir === "left" ? "0%" : "100%";
  const stop = dir === "left" ? "30%" : "70%";
  const overshoot = dir === "left" ? "24%" : "76%";
  const gateAt = dir === "left" ? "left-[16%]" : "left-[84%]";
  return (
    <div className="relative hidden h-full min-h-16 md:block" aria-hidden="true">
      <span
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
        style={{ backgroundImage: `linear-gradient(90deg, ${color}55 50%, transparent 0)`, backgroundSize: "6px 1px" }}
      />
      {gated && (
        <motion.span
          className={cn("absolute top-1/2 h-9 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full", gateAt)}
          style={{ background: color, boxShadow: `0 0 16px 2px ${color}88`, originY: 0.5 }}
          {...play(p, { scaleY: 0, opacity: 0 }, { scaleY: 1, opacity: 1 }, {
            type: "spring",
            stiffness: 520,
            damping: 24,
            delay: GATE_AT,
          })}
        />
      )}
      {gated && (
        <motion.span
          className={cn("absolute top-[calc(50%-30px)] -translate-x-1/2", gateAt)}
          {...play(p, { opacity: 0 }, { opacity: 1 }, { duration: 0.2, delay: GATE_AT + 0.1 })}
        >
          <Lock className="size-3" style={{ color }} />
        </motion.span>
      )}
      <motion.span
        className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: color, boxShadow: `0 0 14px 3px ${color}99` }}
        {...play(
          p,
          { left: from, opacity: 0 },
          gated ? { left: [from, overshoot, stop], opacity: [0, 1, 1] } : { left: [from, to], opacity: [0, 1] },
          gated
            ? { duration, delay, times: [0, 0.82, 1], ease: [EASE_IN_OUT, EASE_OUT] }
            : { duration, delay, ease: EASE_IN_OUT, opacity: { duration: 0.15, delay } },
        )}
      />
    </div>
  );
}

function SideCell({
  vault,
  side,
  poisoned,
  arriveAt,
  p,
}: {
  vault: VaultKey;
  side: CompareSide;
  poisoned: boolean;
  arriveAt: number;
  p: Play;
}) {
  const accent: Accent = side.badge ? badgeAccent[side.badge.tone] : "neutral";
  const a = accentClass[accent];
  const attackerPaid = poisoned && vault === "guarded" && side.payment?.status === "Paid";
  return (
    <div
      data-testid={`side-${vault}`}
      className={cn(
        "relative flex min-w-0 flex-col gap-2.5 overflow-hidden rounded-2xl border p-4",
        poisoned ? cn(a.border, "bg-raised") : "border-white/[0.07] bg-white/[0.02]",
      )}
    >
      {poisoned && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(120% 140% at ${vault === "vault" ? "100%" : "0%"} 50%, ${accentHex[accent]}2e, transparent 70%)` }}
          {...play(p, { opacity: 0 }, { opacity: 1 }, { duration: 0.5, delay: arriveAt })}
        />
      )}
      <p className="label md:hidden">{vault === "vault" ? "Lineage" : "LimitsOnly"}</p>
      {side.payment && side.badge ? (
        <>
          <div className="relative">
            <ProvenanceBadge badge={side.badge} compact wrap />
          </div>
          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <StatusPill status={side.payment.status} accent={attackerPaid ? "attacker" : undefined} />
            <span className="num text-body">{side.amount}</span>
          </div>
          <div className="relative flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            {side.payee ? <AccountId id={side.payee} className="text-[12px]" /> : <span className="text-faint">no payee</span>}
            {side.txUrl && (
              <a
                href={side.txUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`View the ${vault === "vault" ? "Lineage" : "LimitsOnly"} transaction on NEAR Blocks`}
                className="inline-flex items-center gap-0.5 text-micro text-muted-foreground hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
              >
                tx <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="text-small text-faint">Payment {side.statusLabel} on this vault.</p>
      )}
    </div>
  );
}

function MessageCell({ row, p, index }: { row: CompareRow; p: Play; index: number }) {
  return (
    <div
      className={cn(
        "relative col-span-2 flex flex-col gap-2 rounded-2xl border p-4 md:col-span-1",
        row.poisoned ? "border-dashed border-attacker-ring bg-attacker-soft/40" : "border-white/[0.07] bg-white/[0.025]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Mail className={cn("size-3.5", row.poisoned ? "text-attacker" : "text-muted-foreground")} aria-hidden="true" />
        <span className="font-mono text-[11px] text-muted-foreground">
          {String(index + 1).padStart(2, "0")} · {row.message.replace(/^\d+-/, "")}
        </span>
        {row.poisoned && (
          <span className="rounded-full bg-attacker px-1.5 py-px text-micro font-semibold text-ink">
            poisoned
          </span>
        )}
      </div>
      <p className="text-small leading-snug text-foreground">
        <Memo text={row.subject} />
      </p>
      <p className="font-mono text-[11px] text-faint">
        agent called <span className="text-muted-foreground">{row.tool}</span>
      </p>
    </div>
  );
}

const GRID = "grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_4.5rem_minmax(13rem,17rem)_4.5rem_minmax(0,1fr)] md:gap-0";

function Stage({ view, p }: { view: CompareView; p: Play }) {
  let clean = 0;
  return (
    <div className="relative">
      {/* LimitsOnly side flashes rose when the poisoned payment lands */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 left-1/2 hidden rounded-r-3xl md:block"
        style={{ background: "linear-gradient(90deg, transparent, rgb(244 63 94 / 0.16) 45%, rgb(244 63 94 / 0.22))" }}
        {...(p.reduced
          ? { initial: false, animate: { opacity: 0 } }
          : {
              initial: { opacity: 0 },
              animate: p.on && view.attackerReceived.guarded > 0n ? { opacity: [0, 1, 0] } : { opacity: 0 },
              transition: { duration: 0.9, delay: ARRIVE, times: [0, 0.18, 1], ease: "easeOut" },
            })}
      />

      <div className={cn(GRID, "items-end pb-6")}>
        <div className="hidden md:block">
          <p className="flex items-center gap-2 font-serif text-title">
            <ShieldCheck className="size-5 text-p1" aria-hidden="true" /> Lineage
          </p>
          <AccountId id={VAULT_IDS.vault} className="text-[11.5px]" />
        </div>
        <span className="hidden md:block" />
        <div className="col-span-2 flex justify-center md:col-span-1">
          <SameCodeSeal view={view} p={p} />
        </div>
        <span className="hidden md:block" />
        <div className="hidden text-right md:block">
          <p className="flex items-center justify-end gap-2 font-serif text-title">
            LimitsOnly <ShieldOff className="size-5 text-attacker" aria-hidden="true" />
          </p>
          <AccountId id={VAULT_IDS.guarded} className="text-[11.5px]" />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:gap-4">
        {view.rows.map((row, i) => {
          const start = row.poisoned ? T.poison : T.flow + clean++ * T.flowGap;
          const dur = row.poisoned ? T.poisonDur : T.flowDur;
          const arrive = start + dur;
          const tone = (k: VaultKey): Accent => {
            const b = row.sides[k].badge;
            return b ? badgeAccent[b.tone] : "neutral";
          };
          const gated = (k: VaultKey) => {
            const s = row.sides[k].payment?.status;
            return s === "AwaitingApproval" || s === "Rejected" || s === "Blocked";
          };
          return (
            <motion.div
              key={row.message}
              data-testid={`compare-row-${i}`}
              data-poisoned={String(row.poisoned)}
              className={cn(GRID, "relative rounded-3xl", row.poisoned && "md:bg-white/[0.015] md:p-2 md:ring-1 md:ring-white/[0.06]")}
              {...play(p, { opacity: 0, y: 8 }, { opacity: 1, y: 0 }, {
                duration: 0.35,
                delay: T.rows + i * T.rowStagger,
                ease: EASE_OUT,
              })}
            >
              <div className="order-2 md:order-none">
                <SideCell vault="vault" side={row.sides.vault} poisoned={row.poisoned} arriveAt={arrive} p={p} />
              </div>
              <Track dir="left" accent={tone("vault")} gated={gated("vault")} delay={start} duration={dur} p={p} />
              <div className="order-1 col-span-2 md:order-none md:col-span-1">
                <MessageCell row={row} p={p} index={i} />
              </div>
              <Track dir="right" accent={tone("guarded")} gated={gated("guarded")} delay={start} duration={dur} p={p} />
              <div className="order-3 md:order-none">
                <SideCell vault="guarded" side={row.sides.guarded} poisoned={row.poisoned} arriveAt={arrive} p={p} />
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className={cn(GRID, "mt-8 items-center")}>
        <AttackerCounter vault="vault" view={view} />
        <span className="hidden md:block" />
        <p className="col-span-2 order-first text-center md:order-none md:col-span-1">
          <span className="label block">attacker received</span>
          <AccountId id={view.attacker} className="text-[11.5px]" />
        </p>
        <span className="hidden md:block" />
        <AttackerCounter vault="guarded" view={view} />
      </div>

      <motion.p
        className="mt-10 text-center text-lead md:text-[1.5rem] md:leading-snug"
        {...play(p, { opacity: 0, y: 6 }, { opacity: 1, y: 0 }, { duration: 0.5, delay: T.summary, ease: EASE_OUT })}
      >
        {compareSummary(view)}
      </motion.p>
    </div>
  );
}

function AttackerCounter({ vault, view }: { vault: VaultKey; view: CompareView }) {
  const v = view.attackerReceived[vault];
  return (
    <div
      data-testid={`attacker-${vault}`}
      className={cn("flex flex-col gap-1", vault === "guarded" ? "items-end text-right" : "items-start")}
    >
      <span className="label">{vault === "vault" ? "from Lineage" : "from LimitsOnly"}</span>
      <CountUp
        value={v}
        format={fmtUsdc}
        delay={T.counters}
        align={vault === "guarded" ? "end" : "start"}
        className={cn("text-stat", v > 0n ? "text-attacker" : "text-p1")}
       
      />
    </div>
  );
}

export function CompareStage({ view }: { view: CompareView }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });
  const [playId, setPlayId] = useState(0);
  const p: Play = { on: inView, reduced };

  return (
    <section ref={ref} aria-label="The demo run, side by side" className="stage relative p-5 md:p-10">
      {!reduced && (
        <button
          type="button"
          onClick={() => setPlayId((n) => n + 1)}
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" /> Replay
        </button>
      )}
      <Stage key={playId} view={view} p={p} />
    </section>
  );
}
