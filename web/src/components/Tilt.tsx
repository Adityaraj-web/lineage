"use client";

import { motion, useMotionTemplate, useSpring } from "motion/react";
import type { PointerEvent } from "react";
import { cn } from "@/components/cn";
import { FINE_POINTER_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";

const SPRING = { stiffness: 160, damping: 20, mass: 0.6 };

// A subtle 3D tilt towards the pointer (spring, at most `max` degrees). Hover-fine only, none under
// reduced motion. Only the doorways and the hero vault use it.
export function Tilt({ children, className, max = 4 }: { children: React.ReactNode; className?: string; max?: number }) {
  const fine = useMediaQuery(FINE_POINTER_QUERY);
  const reduced = useReducedMotionPref();
  const rx = useSpring(0, SPRING);
  const ry = useSpring(0, SPRING);
  const transform = useMotionTemplate`perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  if (!fine || reduced) return <div className={className}>{children}</div>;
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ry.set(x * 2 * max);
    rx.set(-y * 2 * max);
  };
  const leave = () => {
    rx.set(0);
    ry.set(0);
  };
  return (
    <motion.div className={cn("[transform-style:flat]", className)} style={{ transform }} onPointerMove={move} onPointerLeave={leave}>
      {children}
    </motion.div>
  );
}
