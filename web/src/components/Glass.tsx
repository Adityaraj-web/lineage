"use client";

import { useRef, type ComponentProps, type ElementType, type PointerEvent } from "react";
import { cn } from "@/components/cn";
import { FINE_POINTER_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";

export type GlassTier = "stage" | "card" | "chip";

type GlassProps<E extends ElementType> = {
  as?: E;
  tier?: GlassTier;
  // Specular glare that follows the pointer. On by default for stages, hover-fine only.
  glare?: boolean;
} & Omit<ComponentProps<E>, "as">;

// Every panel. Stage and card blur what is behind them (a card nested in glass does not blur
// again); a chip never blurs. The glare's transform is written to the glare element itself, so a
// pointer move never restyles the panel's children.
export function Glass<E extends ElementType = "div">({ as, tier = "card", glare, className, children, onPointerMove, onPointerLeave, ...rest }: GlassProps<E>) {
  const Tag: ElementType = as ?? "div";
  const fine = useMediaQuery(FINE_POINTER_QUERY);
  const reduced = useReducedMotionPref();
  const glareRef = useRef<HTMLSpanElement>(null);
  const live = (glare ?? tier === "stage") && tier !== "chip" && fine && !reduced;

  const move = (e: PointerEvent<HTMLElement>) => {
    onPointerMove?.(e);
    const g = glareRef.current;
    if (!g || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    g.style.transform = `translate3d(${e.clientX - r.left - 180}px, ${e.clientY - r.top - 180}px, 0)`;
    g.style.opacity = "1";
  };
  const leave = (e: PointerEvent<HTMLElement>) => {
    onPointerLeave?.(e);
    if (glareRef.current) glareRef.current.style.opacity = "0";
  };

  return (
    <Tag
      data-glass={tier}
      className={cn("glass", `glass-${tier}`, className)}
      onPointerMove={live ? move : onPointerMove}
      onPointerLeave={live ? leave : onPointerLeave}
      {...rest}
    >
      {live && (
        <span aria-hidden="true" className="glass-glare-clip">
          <span ref={glareRef} className="glass-glare" />
        </span>
      )}
      {children}
    </Tag>
  );
}
