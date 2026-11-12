"use client";

import { motion, useScroll, useTransform } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { EASE_IN_OUT, EASE_OUT } from "../motion";
import { needsYouText, Shared } from "../transitions";

const C = { p1: "var(--color-p1)", p2: "var(--color-p2)", p3: "var(--color-p3)" };

// Three threads into a vault: P1 straight in, P2 out to the registry and back, P3 stopped at a
// gate. Drawn once on load; static under reduced motion.
function HeroThreads() {
  const reduced = useReducedMotionPref();
  const draw = (delay: number, duration: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { duration, delay, ease: EASE_IN_OUT }, opacity: { duration: 0.01, delay } },
        };
  const pop = (delay: number) =>
    reduced
      ? { initial: false as const }
      : { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.35, delay, ease: EASE_OUT } };
  return (
    <svg viewBox="0 0 560 420" className="h-auto w-full overflow-visible" aria-hidden="true" fill="none">
      <defs>
        <radialGradient id="hero-amber">
          <stop offset="0" stopColor="#fbbf24" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="452" y="96" width="96" height="228" rx="18" fill="var(--color-raised)" stroke="var(--hairline)" />
      <path d="M470 132h60M470 150h40" stroke="rgb(255 255 255 / 0.12)" strokeWidth="2" strokeLinecap="round" />
      <motion.path d="M0 140 C 160 140, 260 140, 452 140" stroke={C.p1} strokeWidth="2" strokeLinecap="round" {...draw(0.1, 0.9)} />
      <motion.path
        d="M0 210 C 120 210, 170 300, 250 300 C 330 300, 360 210, 452 210"
        stroke={C.p2}
        strokeWidth="2"
        strokeLinecap="round"
        {...draw(0.3, 1.1)}
      />
      <motion.circle cx="250" cy="300" r="9" stroke={C.p2} strokeWidth="1.5" fill="var(--ink)" {...pop(0.85)} />
      <motion.path d="M0 280 C 150 280, 250 360, 400 360" stroke={C.p3} strokeWidth="2" strokeLinecap="round" {...draw(0.5, 0.8)} />
      <motion.circle cx="410" cy="360" r="46" fill="url(#hero-amber)" {...pop(1.3)} />
      <motion.rect x="406" y="336" width="5" height="48" rx="2.5" fill={C.p3} {...pop(1.25)} />
      <motion.circle cx="452" cy="140" r="4" fill={C.p1} {...pop(1.0)} />
      <motion.circle cx="452" cy="210" r="4" fill={C.p2} {...pop(1.4)} />
    </svg>
  );
}

export function Hero({ count }: { count: number | null }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const textY = useTransform(scrollYProgress, [0.3, 0.6], ["translateY(0px)", "translateY(-24px)"]);
  const textOpacity = useTransform(scrollYProgress, [0.6, 0.9], [1, 0.35]);
  const artY = useTransform(scrollYProgress, [0.6, 0.9], ["translateY(0px)", "translateY(40px)"]);
  const cueOpacity = useTransform(scrollYProgress, [0, 0.3], [1, 0]);
  const rise = (i: number) =>
    reduced ? {} : { initial: { opacity: 0, transform: "translateY(16px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: { duration: 0.6, delay: 0.08 + i * 0.07, ease: EASE_OUT } };

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center py-16">
      <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
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
            <a href="#doorways" className="text-small text-muted-foreground underline-offset-4 transition-colors duration-150 hover-fine:text-foreground hover-fine:underline">
              Skip to the vaults
            </a>
          </motion.div>
        </motion.div>
        <motion.div className="mx-auto w-full max-w-[34rem]" style={reduced ? undefined : { transform: artY }}>
          <HeroThreads />
        </motion.div>
      </div>
      <motion.div
        aria-hidden="true"
        className="absolute bottom-6 left-0 flex flex-col items-start gap-2 text-micro text-faint"
        style={reduced ? undefined : { opacity: cueOpacity }}
      >
        <span className="relative block h-10 w-px overflow-hidden bg-white/10">
          <span className="scroll-cue absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent to-foreground" />
        </span>
        Scroll
      </motion.div>
    </section>
  );
}
