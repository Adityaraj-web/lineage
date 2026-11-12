"use client";

import { ChevronDown } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { Glass } from "@/components/Glass";
import { Tilt } from "@/components/Tilt";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { fmtUsdc } from "@/lib/format";
import type { Overview } from "@/lib/views";
import { pct } from "../story/progress";
import { EASE_IN_OUT, EASE_OUT } from "../motion";
import { needsYouText, Shared } from "../transitions";

// The hero composition in viewBox units: three lanes from the left into a glass vault on the right.
const W = 600;
const H = 500;
const V = { x: 352, y: 24, w: 240, h: 452 };
const LANE = { p1: 132, p2: 236, p3: 392 };
const RING = { x: 186, y: 312 };
const C = { p1: "var(--color-p1)", p2: "var(--color-p2)", p3: "var(--color-p3)" };
// When each thread lands (seconds after load).
const AT = { p1: 1.0, p2: 1.5, p3: 1.35 };

const PATHS = {
  p1: `M 0 ${LANE.p1} L ${V.x} ${LANE.p1}`,
  p2: `M 0 ${LANE.p2} C 80 ${LANE.p2}, 110 ${RING.y}, ${RING.x - 10} ${RING.y} M ${RING.x + 10} ${RING.y} C 262 ${RING.y}, 290 ${LANE.p2}, ${V.x} ${LANE.p2}`,
  p3: `M 0 ${LANE.p3} L ${V.x - 12} ${LANE.p3}`,
};

function Thread({ d, color, delay, duration, reduced }: { d: string; color: string; delay: number; duration: number; reduced: boolean }) {
  const anim = reduced
    ? { initial: false as const }
    : {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { pathLength: { duration, delay, ease: EASE_IN_OUT }, opacity: { duration: 0.01, delay } },
      };
  return (
    <>
      <motion.path d={d} stroke={color} strokeWidth="7" strokeOpacity="0.16" strokeLinecap="round" {...anim} />
      <motion.path d={d} stroke={color} strokeWidth="2" strokeLinecap="round" {...anim} />
    </>
  );
}

function HeroVault({ view }: { view: Overview | null }) {
  const reduced = useReducedMotionPref();
  const appear = (at: number) =>
    reduced ? { initial: false as const } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.4, delay: at, ease: EASE_OUT } };
  const pulse = (at: number) =>
    reduced
      ? { initial: false as const, animate: { opacity: 0.14 } }
      : { initial: { opacity: 0 }, animate: { opacity: [0, 0.6, 0.14] }, transition: { duration: 1.4, delay: at, times: [0, 0.2, 1], ease: "easeOut" as const } };
  const pop = (at: number) =>
    reduced ? { initial: false as const } : { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.35, delay: at, ease: EASE_OUT } };
  const label = "absolute whitespace-nowrap text-[clamp(0.75rem,2.3cqi,0.9375rem)] font-medium";

  return (
    <div className="relative w-full [container-type:inline-size]" style={{ aspectRatio: `${W} / ${H}` }}>
      <p className={label} style={{ left: 0, top: pct(LANE.p1 - 40, H), color: C.p1 }}>
        Signed by you
      </p>
      <p className={label} style={{ left: 0, top: pct(LANE.p2 - 40, H), color: C.p2 }}>
        Your registry
      </p>
      <p className={label} style={{ left: 0, top: pct(LANE.p3 - 40, H), color: C.p3 }}>
        An email
      </p>

      <div className="absolute" style={{ left: pct(V.x, W), top: pct(V.y, H), width: pct(V.w, W), height: pct(V.h, H) }}>
        <Tilt className="size-full" max={3.5}>
          <Glass
            role="group"
            aria-label="Lineage vault"
            tier="stage"
            className="flex size-full flex-col justify-between overflow-hidden rounded-[clamp(1rem,3.2cqi,1.75rem)] p-[clamp(0.875rem,3.4cqi,1.5rem)]"
          >
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_32%_at_0%_24%,rgb(52_211_153/0.55),transparent_70%)]" {...pulse(AT.p1)} />
            <motion.span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_32%_at_0%_47%,rgb(56_189_248/0.5),transparent_70%)]" {...pulse(AT.p2)} />
            <p className="text-[clamp(0.8125rem,2.4cqi,1rem)] font-semibold">Lineage vault</p>
            {view ? (
              <div className="flex flex-col gap-[clamp(0.75rem,3cqi,1.25rem)]">
                <motion.p className="flex items-baseline gap-2 whitespace-nowrap text-p1" {...appear(AT.p2)}>
                  <span className="num text-[clamp(1.75rem,7cqi,2.75rem)] leading-none font-medium">{view.demo.paid}</span>{" "}
                  <span className="text-[clamp(0.8125rem,2.7cqi,1.0625rem)] font-semibold text-foreground">paid</span>
                </motion.p>
                <motion.p className="flex items-baseline gap-2 whitespace-nowrap text-p3" {...appear(AT.p3)}>
                  <span className="num text-[clamp(1.75rem,7cqi,2.75rem)] leading-none font-medium">{view.awaitingCount}</span>{" "}
                  <span className="text-[clamp(0.8125rem,2.7cqi,1.0625rem)] font-semibold text-foreground">held for you</span>
                </motion.p>
              </div>
            ) : (
              <p className="text-[clamp(0.8125rem,2.6cqi,1rem)] text-muted-foreground">Reading testnet</p>
            )}
            <div className="border-t border-white/10 pt-[clamp(0.625rem,2.4cqi,1rem)]">
              <p className="text-[clamp(0.75rem,2.2cqi,0.875rem)] text-muted-foreground">Balance</p>
              <p className="num mt-1 text-[clamp(1.125rem,4.6cqi,1.875rem)] leading-none font-medium whitespace-nowrap">
                {view ? fmtUsdc(view.vaults.vault.config.balance) : "—"}
              </p>
            </div>
          </Glass>
        </Tilt>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" fill="none">
        <defs>
          <radialGradient id="hero-amber">
            <stop offset="0" stopColor="#fbbf24" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>
        <Thread d={PATHS.p1} color={C.p1} delay={0.15} duration={0.85} reduced={reduced} />
        <Thread d={PATHS.p2} color={C.p2} delay={0.3} duration={1.2} reduced={reduced} />
        <Thread d={PATHS.p3} color={C.p3} delay={0.45} duration={0.9} reduced={reduced} />
        <motion.circle cx={RING.x} cy={RING.y} r="9" stroke={C.p2} strokeWidth="1.5" fill="none" {...pop(0.85)} />
        <motion.circle cx={V.x} cy={LANE.p1} r="3.5" fill={C.p1} {...pop(AT.p1)} />
        <motion.circle cx={V.x} cy={LANE.p2} r="3.5" fill={C.p2} {...pop(AT.p2)} />
        {/* The gate slot in the vault's left edge: P3 stops here. */}
        <motion.circle cx={V.x - 4} cy={LANE.p3} r="40" fill="url(#hero-amber)" {...pop(AT.p3)} />
        <motion.rect x={V.x - 7} y={LANE.p3 - 24} width="6" height="48" rx="3" fill={C.p3} {...pop(AT.p3 - 0.05)} />
      </svg>
    </div>
  );
}

export function Hero({ view }: { view: Overview | null }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);
  const count = view ? view.awaitingCount : null;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0.3, 0.6], ["translateY(0px)", "translateY(-24px)"]);
  const textOpacity = useTransform(scrollYProgress, [0.6, 0.9], [1, 0.35]);
  const artY = useTransform(scrollYProgress, [0.6, 0.9], ["translateY(0px)", "translateY(40px)"]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const rise = (i: number) =>
    reduced ? {} : { initial: { opacity: 0, transform: "translateY(16px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: { duration: 0.6, delay: 0.08 + i * 0.07, ease: EASE_OUT } };

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div style={reduced ? undefined : { transform: textY, opacity: textOpacity }}>
          <motion.h1 id="hero-title" className="max-w-[13ch] font-serif text-hero" {...rise(0)}>
            Prepared statements for money.
          </motion.h1>
          <motion.p className="mt-8 max-w-[36rem] text-lead text-foreground md:text-[1.375rem] md:leading-[1.5]" {...rise(1)}>
            Your AI agent can ask to pay anyone. The vault pays only payees whose origin it can trace.
          </motion.p>
          <motion.div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4" {...rise(2)}>
            <Link
              href="/vault/vault#inbox"
              className="press group inline-flex h-11 items-center gap-2.5 rounded-full border border-p3-ring bg-p3-soft pr-5 pl-4 text-small font-medium text-foreground transition-colors duration-150 hover-fine:bg-[rgb(251_191_36/0.14)]"
            >
              <span aria-hidden="true" className="glow-amber size-2 rounded-full bg-p3" />
              {count === null ? (
                <span>Checking the inbox</span>
              ) : (
                <Shared name="needs-you">
                  <span className="inline-block">{needsYouText(count)}</span>
                </Shared>
              )}
            </Link>
            <a href="#doorways" className="text-small text-foreground underline-offset-4 transition-colors duration-150 hover-fine:underline">
              Skip to the vaults
            </a>
          </motion.div>
        </motion.div>
        <motion.div className="mx-auto w-full max-w-[36rem]" style={reduced ? undefined : { transform: artY }}>
          <HeroVault view={view} />
        </motion.div>
      </div>
      <motion.div
        aria-hidden="true"
        className="absolute bottom-6 left-0 flex items-center gap-1.5 text-micro text-muted-foreground"
        style={reduced ? undefined : { opacity: cueOpacity }}
      >
        Scroll
        <ChevronDown className="scroll-cue size-3.5" />
      </motion.div>
    </section>
  );
}
