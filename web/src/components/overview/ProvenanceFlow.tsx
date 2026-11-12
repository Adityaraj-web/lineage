"use client";

import { BookCheck, Lock, Mail, PenLine, Vault, Workflow } from "lucide-react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type AnimationPlaybackControls,
  type Easing,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { DEPLOYMENT } from "@/lib/config";
import { fmtUsdc } from "@/lib/format";

// Geometry (viewBox 960 × 380). Three lanes run left to right into the vault.
const L1 = 70;
const L2 = 196;
const L3 = 316;
const SRC_X = 24;
const SRC_W = 212;
const SRC_R = SRC_X + SRC_W;
const VAULT_X = 772;
const IN_VAULT = 800;
const GATE_X = 708;
const REG = { x: 420, y: 108, w: 160, h: 56 };
const REG_CY = REG.y + REG.h / 2;

const P1_PATH = `M ${SRC_R} ${L1} L ${IN_VAULT} ${L1}`;
const P2A_PATH = `M ${SRC_R} ${L2} C 320 ${L2}, 340 ${REG_CY}, ${REG.x} ${REG_CY}`;
const P2B_PATH = `M ${REG.x + REG.w} ${REG_CY} C 660 ${REG_CY}, 680 ${L2}, ${IN_VAULT} ${L2}`;
const P3_LANE = `M ${SRC_R} ${L3} L ${VAULT_X} ${L3}`;
const P3_PATH = `M ${SRC_R} ${L3} L ${GATE_X - 16} ${L3}`;

const END = { p1: { x: IN_VAULT, y: L1 }, p2: { x: IN_VAULT, y: L2 }, p3: { x: GATE_X - 16, y: L3 } };

const C = { p1: "var(--color-p1)", p2: "var(--color-p2)", p3: "var(--color-p3)", fg: "#eceef3", muted: "#9aa3b5" };

// One 9 s loop; every value below is [seconds, value] keyframes on the same clock.
const LOOP = 9;
type Track = [number, number][];
const TRACKS: Record<string, Track> = {
  tok1: [[0, 0], [1.6, 1], [LOOP, 1]],
  tok1o: [[0, 0], [0.05, 1], [8.4, 1], [LOOP, 0]],
  flash1: [[0, 0], [1.55, 0], [1.7, 1], [2.1, 0], [LOOP, 0]],
  check1: [[0, 0], [1.6, 0], [1.85, 1], [8.4, 1], [LOOP, 0]],
  tok2: [[0, 0], [1.2, 0], [2.4, 1], [2.8, 1], [4.0, 2], [LOOP, 2]],
  tok2o: [[0, 0], [1.15, 0], [1.25, 1], [8.4, 1], [LOOP, 0]],
  reg: [[0, 0], [2.35, 0], [2.55, 1], [2.95, 0], [LOOP, 0]],
  resolved: [[0, 0], [2.5, 0], [2.75, 1], [8.4, 1], [LOOP, 0]],
  flash2: [[0, 0], [3.95, 0], [4.1, 1], [4.5, 0], [LOOP, 0]],
  check2: [[0, 0], [4.0, 0], [4.25, 1], [8.4, 1], [LOOP, 0]],
  tok3: [[0, 0], [4.0, 0], [5.2, 1], [5.38, 0.965], [5.55, 0.975], [LOOP, 0.975]],
  tok3o: [[0, 0], [3.95, 0], [4.05, 1], [8.4, 1], [LOOP, 0]],
  gate: [[0, 0], [5.2, 0], [5.6, 1], [6.6, 0.65], [7.6, 1], [8.4, 1], [LOOP, 0]],
  needs: [[0, 0], [5.6, 0], [5.9, 1], [8.4, 1], [LOOP, 0]],
};
// The static frame: the end state of the loop. Reduced motion, prerendered HTML and tests see this.
const STATIC: Record<string, number> = {
  tok1: 1, tok1o: 1, flash1: 0, check1: 1,
  tok2: 2, tok2o: 1, reg: 0, resolved: 1, flash2: 0, check2: 1,
  tok3: 1, tok3o: 1, gate: 1, needs: 1,
};
const EASE_SEG: Record<string, Easing> = { tok1: "easeInOut", tok2: "easeInOut", tok3: "easeIn" };

type Pt = { x: number; y: number };
function pointOn(ref: RefObject<SVGPathElement | null>, t: number, fallback: Pt): Pt {
  const el = ref.current;
  if (!el || typeof el.getTotalLength !== "function") return fallback;
  const len = el.getTotalLength();
  const p = el.getPointAtLength(len * Math.min(1, Math.max(0, t)));
  return { x: p.x, y: p.y };
}

const canMeasure = () =>
  typeof window !== "undefined" &&
  typeof SVGPathElement !== "undefined" &&
  typeof SVGPathElement.prototype.getTotalLength === "function";

function Source({ y, icon: Icon, title, sub, color }: { y: number; icon: typeof Mail; title: string; sub: string; color: string }) {
  return (
    <g>
      <rect x={SRC_X} y={y - 30} width={SRC_W} height={60} rx={16} fill="rgb(255 255 255 / 0.035)" stroke="rgb(255 255 255 / 0.09)" />
      <rect x={SRC_X} y={y - 30} width={3} height={60} rx={1.5} fill={color} />
      <Icon x={SRC_X + 16} y={y - 10} width={20} height={20} color={color} strokeWidth={1.75} aria-hidden="true" />
      <text x={SRC_X + 46} y={y - 3} fill={C.fg} fontSize={15} fontWeight={500} style={{ fontFamily: "var(--font-sans)" }}>
        {title}
      </text>
      <text x={SRC_X + 46} y={y + 15} fill={C.muted} fontSize={10.5} style={{ fontFamily: "var(--font-mono)" }}>
        {sub}
      </text>
    </g>
  );
}

function LaneCode({ y, code, color }: { y: number; code: string; color: string }) {
  return (
    <g>
      <rect x={SRC_R + 14} y={y - 22} width={26} height={15} rx={7.5} fill={color} />
      <text x={SRC_R + 27} y={y - 11} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#0a0d14" style={{ fontFamily: "var(--font-mono)" }}>
        {code}
      </text>
    </g>
  );
}

export function ProvenanceFlow() {
  const reduced = useReducedMotionPref();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const animated = mounted && !reduced && canMeasure();

  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(svgRef, { amount: 0.2 });
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const p1 = useRef<SVGPathElement>(null);
  const p2a = useRef<SVGPathElement>(null);
  const p2b = useRef<SVGPathElement>(null);
  const p3 = useRef<SVGPathElement>(null);

  const mv: Record<string, MotionValue<number>> = {};
  for (const k of Object.keys(STATIC)) {
    // A fixed set of keys in a fixed order, so the hook order never changes.
    mv[k] = useMotionValue(STATIC[k]);
  }
  const lane = [useMotionValue(1), useMotionValue(1), useMotionValue(1)];

  const t1x = useTransform(mv.tok1, (v) => pointOn(p1, v, END.p1).x);
  const t1y = useTransform(mv.tok1, (v) => pointOn(p1, v, END.p1).y);
  const t2 = (v: number) => (v <= 1 ? pointOn(p2a, v, END.p2) : pointOn(p2b, v - 1, END.p2));
  const t2x = useTransform(mv.tok2, (v) => t2(v).x);
  const t2y = useTransform(mv.tok2, (v) => t2(v).y);
  const t3x = useTransform(mv.tok3, (v) => pointOn(p3, v, END.p3).x);
  const t3y = useTransform(mv.tok3, (v) => pointOn(p3, v, END.p3).y);
  const regScale = useTransform(mv.reg, [0, 1], [1, 1.06]);
  const needsY = useTransform(mv.needs, [0, 1], [6, 0]);

  const controls = useRef<AnimationPlaybackControls[]>([]);
  useEffect(() => {
    if (!animated) return;
    const started: AnimationPlaybackControls[] = [];
    lane.forEach((l, i) => started.push(animate(l, [0, 1], { duration: 0.9, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] })));
    for (const [k, track] of Object.entries(TRACKS)) {
      const ease = EASE_SEG[k] ?? "linear";
      started.push(
        animate(
          mv[k],
          track.map(([, v]) => v),
          { duration: LOOP, times: track.map(([t]) => t / LOOP), ease, repeat: Infinity, delay: 1.1 },
        ),
      );
    }
    controls.current = started;
    return () => {
      started.forEach((c) => c.stop());
      for (const k of Object.keys(STATIC)) mv[k].set(STATIC[k]);
      lane.forEach((l) => l.set(1));
    };
    // mv and lane are motion values created once; only `animated` restarts the loop.
  }, [animated]);

  useEffect(() => {
    if (!animated) return;
    controls.current.forEach((c) => (inView && visible ? c.play() : c.pause()));
  }, [animated, inView, visible]);

  const reg = DEPLOYMENT.registry["translate-hi"];
  const resolvedText = `→ ${reg.payee.replace(`.${DEPLOYMENT.root}`, "")} · ${fmtUsdc(reg.price)}`;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 960 380"
      role="img"
      aria-labelledby="flow-title flow-desc"
      className="h-auto w-full select-none"
    >
      <title id="flow-title">How Lineage decides who gets paid</title>
      <desc id="flow-desc">
        Three lanes into the vault. P1, signed by you: a payee in a task mandate you signed flows straight through and is
        paid. P2, resolved via registry: the vault asks a registry you pinned, which returns {reg.payee} at{" "}
        {fmtUsdc(reg.price)}, and pays exactly that. P3, an email: a raw address the agent read hits a gate and waits.
        Needs you.
      </desc>
      <defs>
        <filter id="flow-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="vault-fill" x1="0" x2="1">
          <stop offset="0" stopColor="rgb(255 255 255 / 0.06)" />
          <stop offset="1" stopColor="rgb(255 255 255 / 0.02)" />
        </linearGradient>
      </defs>

      {/* lanes */}
      <motion.path d={P1_PATH} stroke={C.p1} strokeOpacity={0.45} strokeWidth={1.5} fill="none" style={{ pathLength: lane[0] }} />
      <motion.path d={P2A_PATH} stroke={C.p2} strokeOpacity={0.45} strokeWidth={1.5} fill="none" style={{ pathLength: lane[1] }} />
      <motion.path d={P2B_PATH} stroke={C.p2} strokeOpacity={0.45} strokeWidth={1.5} fill="none" style={{ pathLength: lane[1] }} />
      <motion.path d={P3_LANE} stroke={C.p3} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="0" fill="none" style={{ pathLength: lane[2] }} />
      {/* invisible paths the tokens follow */}
      <path ref={p1} d={P1_PATH} fill="none" stroke="none" />
      <path ref={p2a} d={P2A_PATH} fill="none" stroke="none" />
      <path ref={p2b} d={P2B_PATH} fill="none" stroke="none" />
      <path ref={p3} d={P3_PATH} fill="none" stroke="none" />

      <Source y={L1} icon={PenLine} title="Signed by you" sub="a payee in your task mandate" color={C.p1} />
      <Source y={L2} icon={Workflow} title="A service request" sub="pay_registered_service" color={C.p2} />
      <Source y={L3} icon={Mail} title="An email" sub="“new payout details…”" color={C.p3} />
      <LaneCode y={L1} code="P1" color={C.p1} />
      <LaneCode y={L2} code="P2" color={C.p2} />
      <LaneCode y={L3} code="P3" color={C.p3} />

      {/* registry */}
      <motion.g style={{ scale: regScale, transformOrigin: `${REG.x + REG.w / 2}px ${REG_CY}px` }}>
        <rect x={REG.x} y={REG.y} width={REG.w} height={REG.h} rx={14} fill="#0e1318" stroke={C.p2} strokeOpacity={0.55} />
        <motion.rect
          x={REG.x - 4}
          y={REG.y - 4}
          width={REG.w + 8}
          height={REG.h + 8}
          rx={18}
          fill="none"
          stroke={C.p2}
          strokeWidth={2}
          style={{ opacity: mv.reg }}
          filter="url(#flow-glow)"
        />
        <BookCheck x={REG.x + 14} y={REG_CY - 10} width={20} height={20} color={C.p2} strokeWidth={1.75} aria-hidden="true" />
        <text x={REG.x + 44} y={REG_CY - 3} fill={C.fg} fontSize={14} fontWeight={500} style={{ fontFamily: "var(--font-sans)" }}>
          Registry
        </text>
        <text x={REG.x + 44} y={REG_CY + 14} fill={C.muted} fontSize={10.5} style={{ fontFamily: "var(--font-mono)" }}>
          translate-hi
        </text>
      </motion.g>
      <motion.text
        x={REG.x + REG.w / 2}
        y={REG.y + REG.h + 26}
        textAnchor="middle"
        fill={C.p2}
        fontSize={11.5}
        style={{ fontFamily: "var(--font-mono)", opacity: mv.resolved }}
      >
        {resolvedText}
      </motion.text>
      <motion.text
        x={REG.x + REG.w / 2}
        y={REG.y + REG.h + 42}
        textAnchor="middle"
        fill={C.muted}
        fontSize={10}
        style={{ fontFamily: "var(--font-sans)", opacity: mv.resolved }}
      >
        Resolved via registry
      </motion.text>

      {/* vault */}
      <rect x={VAULT_X} y={26} width={164} height={328} rx={28} fill="url(#vault-fill)" stroke="rgb(255 255 255 / 0.14)" />
      <motion.rect x={VAULT_X} y={26} width={164} height={328} rx={28} fill="none" stroke={C.p1} strokeWidth={2} style={{ opacity: mv.flash1 }} filter="url(#flow-glow)" />
      <motion.rect x={VAULT_X} y={26} width={164} height={328} rx={28} fill="none" stroke={C.p2} strokeWidth={2} style={{ opacity: mv.flash2 }} filter="url(#flow-glow)" />
      <Vault x={VAULT_X + 64} y={110} width={36} height={36} color={C.fg} strokeWidth={1.4} aria-hidden="true" />
      <text x={VAULT_X + 82} y={168} textAnchor="middle" fill={C.fg} fontSize={22} style={{ fontFamily: "var(--font-serif)" }}>
        Vault
      </text>
      <text x={VAULT_X + 82} y={268} textAnchor="middle" fill={C.muted} fontSize={10} style={{ fontFamily: "var(--font-mono)" }}>
        checks where the
      </text>
      <text x={VAULT_X + 82} y={282} textAnchor="middle" fill={C.muted} fontSize={10} style={{ fontFamily: "var(--font-mono)" }}>
        payee came from
      </text>
      <motion.g style={{ opacity: mv.check1 }}>
        <text x={IN_VAULT + 20} y={L1 + 4} fill={C.p1} fontSize={12} fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
          ✓ paid
        </text>
      </motion.g>
      <motion.g style={{ opacity: mv.check2 }}>
        <text x={IN_VAULT + 20} y={L2 + 4} fill={C.p2} fontSize={12} fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
          ✓ paid
        </text>
      </motion.g>

      {/* the gate on P3 */}
      <motion.rect
        x={GATE_X - 3}
        y={L3 - 30}
        width={6}
        height={60}
        rx={3}
        fill={C.p3}
        style={{ opacity: mv.gate }}
        filter="url(#flow-glow)"
      />
      <rect x={GATE_X - 1.5} y={L3 - 30} width={3} height={60} rx={1.5} fill={C.p3} />
      <Lock x={GATE_X - 7} y={L3 + 36} width={14} height={14} color={C.p3} aria-hidden="true" />
      <motion.g style={{ opacity: mv.needs, y: needsY }}>
        <rect x={GATE_X - 50} y={L3 - 64} width={100} height={24} rx={12} fill="rgb(251 191 36 / 0.14)" stroke={C.p3} strokeOpacity={0.6} />
        <text x={GATE_X} y={L3 - 48} textAnchor="middle" fill={C.p3} fontSize={12} fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
          Needs you
        </text>
      </motion.g>

      {/* tokens */}
      <motion.circle r={7} fill={C.p1} cx={t1x} cy={t1y} style={{ opacity: mv.tok1o }} filter="url(#flow-glow)" />
      <motion.circle r={7} fill={C.p2} cx={t2x} cy={t2y} style={{ opacity: mv.tok2o }} filter="url(#flow-glow)" />
      <motion.circle r={7} fill={C.p3} cx={t3x} cy={t3y} style={{ opacity: mv.tok3o }} filter="url(#flow-glow)" />
    </svg>
  );
}
