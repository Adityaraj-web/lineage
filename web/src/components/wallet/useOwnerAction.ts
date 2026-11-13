"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OwnerTx } from "@/lib/actions";
import { parseOutcome, walletErrorMessage, type TxResult } from "@/lib/tx";

// NEAR Connect resolves only after the wallet has signed and sent, so there is no separate "submitted" step.
export type ActionState =
  | { kind: "idle" }
  | { kind: "signing"; id: string }
  | { kind: "done"; id: string; result: TxResult }
  | { kind: "failed"; id: string; message: string };

export interface OwnerAction {
  state: ActionState;
  busy: boolean;
  run(id: string, tx: OwnerTx): Promise<void>;
  clear(): void;
}

// Passed down only when the connected account is the vault's owner.
export interface OwnerControls {
  vault: string;
  action: OwnerAction;
}

// Approve settles a block or two later through the callback; the second read catches it.
export const REFRESH_AGAIN_MS = 2000;
const IDLE: ActionState = { kind: "idle" };

export function useOwnerAction(send: ((tx: OwnerTx) => Promise<unknown>) | null, refresh: () => void): OwnerAction {
  const [state, setState] = useState<ActionState>(IDLE);
  const busyRef = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimer();
    };
  }, []);

  const run = useCallback(
    async (id: string, tx: OwnerTx) => {
      if (!send || busyRef.current) return;
      busyRef.current = true;
      clearTimer();
      setState({ kind: "signing", id });
      let next: ActionState;
      try {
        next = { kind: "done", id, result: parseOutcome(await send(tx)) };
      } catch (e) {
        next = { kind: "failed", id, message: walletErrorMessage(e) };
      }
      busyRef.current = false;
      if (!alive.current) return;
      setState(next);
      refreshRef.current();
      timer.current = setTimeout(() => refreshRef.current(), REFRESH_AGAIN_MS);
    },
    [send],
  );

  const clear = useCallback(() => {
    if (!busyRef.current) setState(IDLE);
  }, []);

  return useMemo(() => ({ state, busy: state.kind === "signing", run, clear }), [state, run, clear]);
}

export const CREATE_TASK_ID = "create-task";

// Ids of actions on a held payment: "approve:5", "reject:5".
export type HeldVerb = "approve" | "reject";
export const heldActionId = (verb: HeldVerb, paymentId: number): string => `${verb}:${paymentId}`;
export function heldAction(id: string): { verb: HeldVerb; paymentId: number } | null {
  const m = /^(approve|reject):(\d+)$/.exec(id);
  return m ? { verb: m[1] as HeldVerb, paymentId: Number(m[2]) } : null;
}
