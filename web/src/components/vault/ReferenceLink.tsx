"use client";

import { motion } from "motion/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import type { PaymentRow } from "@/lib/views";
import { AccountId } from "../AccountId";
import { Memo } from "../Memo";
import { EASE_IN_OUT, EASE_OUT } from "../motion";
import { ProvenanceBadge } from "../ProvenanceBadge";

interface Geometry {
  d: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

// The held payment's memo, and (for duplicate-reference) the earlier payment in the same task that
// carried the same invoice token, joined by a drawn connector between the two marked tokens.
export function ReferenceLink({
  row,
  related,
  token,
  play,
  delay,
}: {
  row: PaymentRow;
  related: PaymentRow | null;
  token: string | null;
  play: boolean;
  delay: number;
}) {
  const reduced = useReducedMotionPref();
  const box = useRef<HTMLDivElement>(null);
  const markA = useRef<HTMLElement | null>(null);
  const markB = useRef<HTMLElement | null>(null);
  const [geo, setGeo] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const c = box.current?.getBoundingClientRect();
    const a = markA.current?.getBoundingClientRect();
    const b = markB.current?.getBoundingClientRect();
    if (!c || !a || !b || a.width === 0 || b.width === 0) return setGeo(null);
    const pa = { x: a.left - c.left + a.width / 2, y: a.bottom - c.top + 3 };
    const pb = { x: b.left - c.left + b.width / 2, y: b.top - c.top - 3 };
    const dy = Math.max(24, pb.y - pa.y);
    setGeo({
      d: `M ${pa.x} ${pa.y} C ${pa.x} ${pa.y + dy * 0.55}, ${pb.x} ${pb.y - dy * 0.55}, ${pb.x} ${pb.y}`,
      a: pa,
      b: pb,
    });
  }, []);

  useLayoutEffect(() => {
    if (!related || !token) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure, related, token]);

  const tokens = token ? [token] : [];
  const drawn = reduced || play;
  return (
    <div ref={box} className="relative flex flex-col">
      <p className="mb-1.5 text-small text-muted-foreground">The memo, copied from an email the agent read</p>
      <p className="text-lead text-foreground">
        &ldquo;
        <Memo text={row.payment.memo} tokens={tokens} markRef={(el) => void (markA.current = el)} />
        &rdquo;
      </p>

      {related && token && (
        <>
          <div className="h-12" aria-hidden="true" />
          <div
            data-testid={`related-payment-${related.payment.id}`}
            className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"
          >
            <p className="text-small text-foreground">
              &ldquo;
              <Memo text={related.payment.memo} tokens={tokens} markRef={(el) => void (markB.current = el)} />
              &rdquo;
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
              <span className="text-attacker">Already paid in this task</span>
              <span className="num">#{related.payment.id}</span>
              <ProvenanceBadge badge={related.badge} compact />
              {related.payment.payee && <AccountId id={related.payment.payee} className="text-[12px]" />}
              <span className="num text-foreground">{related.amount}</span>
            </div>
          </div>
          {geo && (
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
              <motion.path
                d={geo.d}
                fill="none"
                stroke="var(--color-attacker)"
                strokeWidth={1.5}
                strokeDasharray="1 0"
                strokeLinecap="round"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                animate={drawn ? { pathLength: 1, opacity: 0.9 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.45, delay: reduced ? 0 : delay, ease: EASE_IN_OUT }}
              />
              {[geo.a, geo.b].map((p, i) => (
                <motion.circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="var(--color-attacker)"
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: drawn ? 1 : 0 }}
                  transition={{ duration: 0.2, delay: reduced ? 0 : delay + (i ? 0.4 : 0), ease: EASE_OUT }}
                />
              ))}
            </svg>
          )}
        </>
      )}
    </div>
  );
}
