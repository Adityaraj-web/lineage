"use client";

import { useEffect, useRef, useState } from "react";
import { MARK_MS, MARK_MS_REDUCED } from "@/components/motion";
import { diffPayments, type Mark } from "@/lib/changes";
import type { Payment } from "@/shared/vault-types";
import { useReducedMotionPref } from "./useReducedMotionPref";

const EMPTY: ReadonlyMap<number, Mark> = new Map();

// Marks payments that are new or changed since the previous data version. Runs only when the
// `payments` reference changes, which usePolling guarantees happens on data changes only.
export function useChanges(payments: readonly Payment[] | null | undefined): ReadonlyMap<number, Mark> {
  const reduced = useReducedMotionPref();
  const prev = useRef<readonly Payment[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [marks, setMarks] = useState<ReadonlyMap<number, Mark>>(EMPTY);

  useEffect(() => {
    if (!payments) return;
    const next = diffPayments(prev.current, payments);
    prev.current = payments;
    if (next.size === 0) return;
    setMarks(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMarks(EMPTY), reduced ? MARK_MS_REDUCED : MARK_MS);
  }, [payments, reduced]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return marks;
}
