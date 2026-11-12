"use client";

import { motion } from "motion/react";
import { Fragment } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import type { StoryStrip as Strip, StoryTone } from "@/lib/story";
import { EASE_OUT } from "../motion";

const TONE: Record<StoryTone, { chip: string; thread: string }> = {
  neutral: { chip: "border-hairline bg-raised text-foreground", thread: "rgb(255 255 255 / 0.22)" },
  p1: { chip: "border-p1-ring bg-p1-soft text-p1", thread: "var(--color-p1)" },
  p3: { chip: "border-p3-ring bg-p3-soft text-p3", thread: "var(--color-p3)" },
  attacker: { chip: "border-attacker-ring bg-attacker-soft text-attacker", thread: "var(--color-attacker)" },
};

// The latest run in steps: chips joined by short thread segments that take the next step's colour.
// Screen readers get the one sentence instead.
export function StoryStrip({ strip }: { strip: Strip }) {
  const reduced = useReducedMotionPref();
  return (
    <div data-testid="story-strip">
      <p className="sr-only">{strip.sentence}</p>
      <ol aria-hidden="true" className="flex flex-wrap items-center gap-y-3">
        {strip.steps.map((s, i) => (
          <Fragment key={s.text}>
            {i > 0 && (
              <motion.li
                className="h-[1.5px] w-6 origin-left md:w-10"
                style={{ background: TONE[s.tone].thread }}
                initial={reduced ? false : { transform: "scaleX(0)" }}
                animate={{ transform: "scaleX(1)" }}
                transition={{ duration: 0.22, delay: 0.1 + i * 0.12, ease: EASE_OUT }}
              />
            )}
            <motion.li
              className={cn("rounded-full border px-3 py-1 text-small font-medium whitespace-nowrap", TONE[s.tone].chip)}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.12, ease: EASE_OUT }}
            >
              {s.text}
            </motion.li>
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
