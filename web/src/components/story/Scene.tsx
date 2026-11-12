"use client";

import { animate, useInView, useMotionValue, type MotionValue } from "motion/react";
import { forwardRef, useEffect, type RefObject } from "react";
import { cn } from "@/components/cn";

// A pinned scene: a tall section whose stage sticks under the nav while its progress runs 0..1.
// `heightVh` is the section height (stage 100vh + the hold).
export const PinnedSection = forwardRef<HTMLElement, { heightVh: number; labelledBy: string; children: React.ReactNode; id?: string }>(
  function PinnedSection({ heightVh, labelledBy, children, id }, ref) {
    return (
      <section ref={ref} id={id} aria-labelledby={labelledBy} className="relative" style={{ height: `${heightVh}vh` }}>
        <div className="sticky top-16 flex h-[calc(100svh-4rem)] flex-col justify-center-safe py-6">{children}</div>
      </section>
    );
  },
);

// The scene's box: SVG viewBox coordinates map 1:1 onto it, and it is a size container, so text in
// it scales with the box. Fits the viewport height when pinned.
export function SceneBox({
  w,
  h,
  fit,
  className,
  children,
  reserve = "13rem",
}: {
  w: number;
  h: number;
  fit: boolean;
  className?: string;
  children: React.ReactNode;
  // Height reserved around the box when it fits the viewport (nav, heading, anything below it).
  reserve?: string;
}) {
  return (
    <div
      className={cn("relative mx-auto w-full [container-type:inline-size]", className)}
      style={{ aspectRatio: `${w} / ${h}`, maxWidth: fit ? `calc((100svh - ${reserve}) * ${w / h})` : undefined }}
    >
      {children}
    </div>
  );
}

// Local progress for a stacked (phone) step: runs 0→1 once when the step scrolls into view.
export function useInViewProgress(ref: RefObject<HTMLElement | null>, reduced: boolean, duration = 1.6): MotionValue<number> {
  const mv = useMotionValue(reduced ? 1 : 0);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  useEffect(() => {
    if (reduced) {
      mv.set(1);
      return;
    }
    if (!inView) return;
    const c = animate(mv, 1, { duration, ease: "linear" });
    return () => c.stop();
  }, [inView, reduced, mv, duration]);
  return mv;
}
