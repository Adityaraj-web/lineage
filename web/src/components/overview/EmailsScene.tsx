"use client";

import { motion, useTransform, type MotionStyle, type MotionValue } from "motion/react";
import { useRef } from "react";
import { cn } from "@/components/cn";
import { usePinned } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import type { Service } from "@/lib/chain";
import type { Email } from "@/lib/emails";
import { fmtUsdc } from "@/lib/format";
import type { CompareRow, CompareSide } from "@/lib/views";
import { shortId } from "../AccountId";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { pct, useSceneProgress, useStep } from "../story/progress";
import { PinnedSection, SceneBox, useInViewProgress } from "../story/Scene";

const W = 1200;
const H = 620;
const CARD_W = 380;
const CARD_H = 172;
const SLOT_Y = [100, 310, 520];
const REG = { x: 700, y: 112 };
const SIG = { x: 700, y: 330 };
const VAULT = { x: 1060, y: 150, w: 140, h: 330 };
const GATE_X = 1036;
const ENTRY: Record<"P1" | "P2" | "P3", number> = { P1: 300, P2: 232, P3: 430 };
const COLOR = { P1: "var(--color-p1)", P2: "var(--color-p2)", P3: "var(--color-p3)" };
const SETTLED = 0.85;

type Code = "P1" | "P2" | "P3";

export interface EmailStep {
  key: string;
  email: Email | null;
  subject: string;
  side: CompareSide;
  code: Code;
  result: string;
}

export function resultText(side: CompareSide): string {
  const p = side.payment;
  if (!p) return "Not found";
  if (p.status === "Paid") return `Paid ${side.amount}`;
  if (p.status === "AwaitingApproval") return "Held for you";
  if (p.status === "Rejected") return "Held, then rejected by you";
  return side.statusLabel;
}

export function emailSteps(rows: CompareRow[], emails: Record<string, Email>): EmailStep[] {
  return rows.map((r) => {
    const side = r.sides.vault;
    return {
      key: r.message,
      email: emails[r.message] ?? null,
      subject: r.subject,
      side,
      code: side.badge?.code ?? "P3",
      result: resultText(side),
    };
  });
}

function originLabels(steps: EmailStep[], services: Service[]) {
  const p1 = steps.find((s) => s.code === "P1");
  const p2 = steps.find((s) => s.code === "P2");
  const ref = p2?.side.payment && typeof p2.side.payment.provenance === "object" && "Resolved" in p2.side.payment.provenance
    ? p2.side.payment.provenance.Resolved.reference
    : null;
  const svc = ref ? services.find((s) => s.id === ref) : undefined;
  return {
    signature: p1?.side.badge?.detail ?? "",
    registry: svc ? `${svc.id} resolves to ${shortId(svc.payee)}, ${fmtUsdc(svc.price)}` : (p2?.side.badge?.detail ?? ""),
  };
}

// Each row's share of the scene, all settled by 85%: card in, thread out, (back), land.
function windows(i: number, n: number, code: Code) {
  const span = SETTLED / n;
  const b = i * span;
  const at = (f: number) => b + span * f;
  return code === "P3"
    ? { card: [at(0), at(0.2)], a: [at(0.2), at(0.62)], b: null, gate: [at(0.62), at(0.82)], result: [at(0.82), at(1)] }
    : { card: [at(0), at(0.2)], a: [at(0.2), at(0.55)], b: [at(0.55), at(0.85)], gate: null, result: [at(0.85), at(1)] };
}

function paths(i: number, code: Code) {
  const y = SLOT_Y[i];
  const e = ENTRY[code];
  if (code === "P3") return { a: `M ${CARD_W} ${y} C ${CARD_W + 180} ${y}, 640 490, 820 490 C 930 490, 950 ${e}, ${GATE_X - 5} ${e}`, b: null, node: null };
  const n = code === "P1" ? SIG : REG;
  return {
    a: `M ${CARD_W} ${y} C ${CARD_W + 160} ${y}, ${n.x - 170} ${n.y}, ${n.x - 13} ${n.y}`,
    b: `M ${n.x + 13} ${n.y} C ${n.x + 180} ${n.y}, ${VAULT.x - 160} ${e}, ${VAULT.x} ${e}`,
    node: n,
  };
}

function EmailCard({ step, result, className, style }: { step: EmailStep; result: MotionValue<number> | number; className?: string; style?: MotionStyle }) {
  const e = step.email;
  return (
    <motion.article className={cn("surface flex flex-col gap-1.5 overflow-hidden p-[clamp(0.75rem,1.6cqi,1.25rem)]", className)} style={style}>
      {e && (
        <p className="truncate text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground">
          {e.fromName} <span className="text-faint">{e.fromAddress}</span>
        </p>
      )}
      <h3 className="line-clamp-2 text-[clamp(0.8125rem,1.4cqi,1rem)] leading-snug font-semibold">{e?.subject || step.subject}</h3>
      {e?.excerpt && (
        <p className="line-clamp-1 text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground">{e.excerpt}</p>
      )}
      <motion.div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1" style={{ opacity: result }}>
        {step.side.badge && <ProvenanceBadge badge={step.side.badge} compact />}
        <span className={cn("num text-[clamp(0.75rem,1.2cqi,0.875rem)] font-medium", step.code === "P3" ? "text-p3" : "text-foreground")}>
          {step.result}
        </span>
      </motion.div>
    </motion.article>
  );
}

function Row({ step, i, n, p }: { step: EmailStep; i: number; n: number; p: MotionValue<number> }) {
  const w = windows(i, n, step.code);
  const card = useStep(p, w.card[0], w.card[1]);
  const a = useStep(p, w.a[0], w.a[1]);
  const b = useStep(p, w.b?.[0] ?? 2, w.b?.[1] ?? 3);
  const gate = useStep(p, w.gate?.[0] ?? 2, w.gate?.[1] ?? 3);
  const result = useStep(p, w.result[0], w.result[1]);
  const cardT = useTransform(card, (v) => `translateX(${(1 - v) * -48}px)`);
  const shown = (v: number) => (v > 0.001 ? 1 : 0);
  const aOn = useTransform(a, shown);
  const bOn = useTransform(b, shown);
  const nodeGlow = useTransform(a, [0.9, 1], [0, 0.22]);
  const gateY = useTransform(gate, (v) => `translateY(${(1 - v) * -84}px)`);
  const geo = paths(i, step.code);
  const color = COLOR[step.code];
  return (
    <>
      <EmailCard
        step={step}
        result={result}
        className="absolute"
        style={{
          left: 0,
          top: pct(SLOT_Y[i] - CARD_H / 2, H),
          width: pct(CARD_W, W),
          height: pct(CARD_H, H),
          opacity: card,
          transform: cardT,
        }}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" fill="none">
        <motion.path d={geo.a} stroke={color} strokeWidth="2" strokeLinecap="round" style={{ pathLength: a, opacity: aOn }} />
        {geo.b && <motion.path d={geo.b} stroke={color} strokeWidth="2" strokeLinecap="round" style={{ pathLength: b, opacity: bOn }} />}
        {geo.node && <motion.circle cx={geo.node.x} cy={geo.node.y} r="13" fill={color} style={{ opacity: nodeGlow }} />}
        {step.code === "P3" && (
          <>
            <motion.circle cx={GATE_X} cy={ENTRY.P3} r="46" fill="url(#scene2-amber)" style={{ opacity: gate }} />
            <motion.rect x={GATE_X - 2.5} y={ENTRY.P3 - 34} width="5" height="68" rx="2.5" fill="var(--color-p3)" style={{ transform: gateY }} />
          </>
        )}
      </svg>
    </>
  );
}

function Stage({ steps, labels, p, fit }: { steps: EmailStep[]; labels: ReturnType<typeof originLabels>; p: MotionValue<number>; fit: boolean }) {
  const nodesIn = useStep(p, 0, 0.04);
  return (
    <SceneBox w={W} h={H} fit={fit}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true" fill="none">
        <defs>
          <radialGradient id="scene2-amber">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>
        <motion.g style={{ opacity: nodesIn }}>
          <circle cx={SIG.x} cy={SIG.y} r="12" stroke="var(--color-p1)" strokeWidth="1.5" fill="var(--ink)" />
          <circle cx={REG.x} cy={REG.y} r="12" stroke="var(--color-p2)" strokeWidth="1.5" fill="var(--ink)" />
        </motion.g>
      </svg>
      <motion.div className="absolute text-center" style={{ opacity: nodesIn, left: pct(SIG.x - 170, W), width: pct(340, W), top: pct(SIG.y + 22, H) }}>
        <p className="text-[clamp(0.75rem,1.2cqi,0.9375rem)] font-semibold">Your signature</p>
        <p className="text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground">{labels.signature}</p>
      </motion.div>
      <motion.div className="absolute text-center" style={{ opacity: nodesIn, left: pct(REG.x - 190, W), width: pct(380, W), top: pct(REG.y - 82, H) }}>
        <p className="text-[clamp(0.75rem,1.2cqi,0.9375rem)] font-semibold">Registry you pinned</p>
        <p className="text-[clamp(0.6875rem,1.05cqi,0.8125rem)] text-muted-foreground">{labels.registry}</p>
      </motion.div>
      <motion.div
        className="absolute flex flex-col items-center justify-start rounded-[clamp(0.75rem,1.4cqi,1.25rem)] border border-hairline bg-raised pt-[clamp(0.5rem,1.4cqi,1rem)]"
        style={{ opacity: nodesIn, left: pct(VAULT.x, W), top: pct(VAULT.y, H), width: pct(VAULT.w, W), height: pct(VAULT.h, H) }}
      >
        <p className="text-[clamp(0.75rem,1.2cqi,0.9375rem)] font-semibold">Vault</p>
      </motion.div>
      {steps.map((s, i) => (
        <Row key={s.key} step={s} i={i} n={steps.length} p={p} />
      ))}
    </SceneBox>
  );
}

function StackedStep({ step, labels, reduced }: { step: EmailStep; labels: ReturnType<typeof originLabels>; reduced: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const p = useInViewProgress(ref, reduced, 1.4);
  const a = useStep(p, 0.05, 0.45);
  const b = useStep(p, 0.5, 0.8);
  const result = useStep(p, 0.8, 1);
  const color = COLOR[step.code];
  const origin = step.code === "P1" ? labels.signature : step.code === "P2" ? labels.registry : "No origin: the address came from the email itself";
  const originTitle = step.code === "P1" ? "Your signature" : step.code === "P2" ? "Registry you pinned" : "Nobody vouches for it";
  return (
    <li ref={ref} className="flex flex-col [container-type:inline-size]">
      <EmailCard step={step} result={result} />
      <div className="flex gap-4 pl-6">
        <svg viewBox="0 0 12 150" className="h-[150px] w-3 shrink-0 overflow-visible" aria-hidden="true" fill="none">
          <motion.path d="M 6 0 L 6 64" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ pathLength: a }} />
          {step.code === "P3" ? (
            <motion.rect x="0" y="118" width="12" height="4" rx="2" fill="var(--color-p3)" style={{ opacity: result }} />
          ) : (
            <motion.path d="M 6 86 L 6 150" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ pathLength: b }} />
          )}
          {step.code === "P3" && <motion.path d="M 6 64 L 6 114" stroke={color} strokeWidth="2" strokeLinecap="round" style={{ pathLength: b }} />}
        </svg>
        <motion.div className="flex flex-col justify-center py-3" style={{ opacity: a }}>
          <p className="text-small font-semibold">{originTitle}</p>
          <p className="text-micro text-muted-foreground">{origin}</p>
        </motion.div>
      </div>
    </li>
  );
}

export function EmailsScene({ rows, emails, services }: { rows: CompareRow[]; emails: Record<string, Email>; services: Service[] }) {
  const reduced = useReducedMotionPref();
  const pinned = usePinned();
  const ref = useRef<HTMLElement>(null);
  const mode = pinned && !reduced ? "pinned" : "static";
  const p = useSceneProgress(ref, mode);
  const steps = emailSteps(rows, emails);
  const labels = originLabels(steps, services);
  const heading = (
    <h2 id="emails-title" className="font-serif text-display">
      Three emails reach the agent.
    </h2>
  );

  if (!pinned) {
    return (
      <section ref={ref} aria-labelledby="emails-title" className="py-24">
        {heading}
        <ol className="mt-10 flex flex-col gap-4">
          {steps.map((s) => (
            <StackedStep key={s.key} step={s} labels={labels} reduced={reduced} />
          ))}
        </ol>
      </section>
    );
  }
  if (mode === "static") {
    return (
      <section ref={ref} aria-labelledby="emails-title" className="py-24">
        {heading}
        <div className="mt-10">
          <Stage steps={steps} labels={labels} p={p} fit={false} />
        </div>
      </section>
    );
  }
  return (
    <PinnedSection ref={ref} heightVh={280} labelledBy="emails-title">
      {heading}
      <div className="mt-8">
        <Stage steps={steps} labels={labels} p={p} fit />
      </div>
    </PinnedSection>
  );
}
