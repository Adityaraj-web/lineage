"use client";

import { motion, type MotionStyle } from "motion/react";

// A story thread: the line and a wide, faint halo that share its progress, so a finished thread
// rests as a thin glowing line. A second stroke, not a filter: nothing repaints a blur on scroll.
export function GlowPath({ d, color, style, width = 2 }: { d: string; color: string; style?: MotionStyle; width?: number }) {
  return (
    <>
      <motion.path d={d} stroke={color} strokeWidth={width * 3.5} strokeOpacity={0.16} strokeLinecap="round" fill="none" style={style} />
      <motion.path d={d} stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" style={style} />
    </>
  );
}
