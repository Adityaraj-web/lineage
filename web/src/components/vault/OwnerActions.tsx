"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { approveTx, defaultRejectReason, REJECT_REASON_MAX, rejectTx } from "@/lib/actions";
import type { InboxItem } from "@/lib/views";
import { EASE_OUT } from "../motion";
import { TxResult } from "../wallet/TxResult";
import { heldActionId, type OwnerControls } from "../wallet/useOwnerAction";
import { BTN, WAITING } from "./owner-ui";

export const WALLET_NOTE = "Your wallet will ask you to confirm. It needs a full-access key on the owner account.";
export const TICK_LABEL = "I confirmed this address with the payee outside this conversation.";

type Mode = "idle" | "approve" | "reject";
const capReason = (s: string) => Array.from(s).slice(0, REJECT_REASON_MAX).join("");

function Expand({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionPref();
  if (reduced) return <div>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}

// Owner only, at the foot of the risk column. Nothing sends without an inline confirm; Reject is
// the safe default for a held payment, so it is the primary button.
export function OwnerActions({ item, owner }: { item: InboxItem; owner: OwnerControls }) {
  const p = item.row.payment;
  const high = item.risk.level === "high";
  const { state, busy, run } = owner.action;
  const [mode, setMode] = useState<Mode>("idle");
  const [ticked, setTicked] = useState(false);
  const [reason, setReason] = useState(() => defaultRejectReason(item.risk));
  const opener = useRef<Mode>("idle");
  const approveBtn = useRef<HTMLButtonElement>(null);
  const rejectBtn = useRef<HTMLButtonElement>(null);
  const first = useRef<HTMLElement | null>(null);
  const reasonId = useId();
  const countId = useId();

  const ids = { approve: heldActionId("approve", p.id), reject: heldActionId("reject", p.id) };
  const mine = state.kind !== "idle" && (state.id === ids.approve || state.id === ids.reject);
  const signing = (id: string) => busy && state.kind === "signing" && state.id === id;

  const open = (m: Exclude<Mode, "idle">) => {
    opener.current = m;
    setTicked(false);
    if (m === "reject") setReason(defaultRejectReason(item.risk));
    setMode(m);
  };
  const back = () => {
    setTicked(false);
    setMode("idle");
  };

  useEffect(() => {
    if (mode !== "idle") first.current?.focus();
    else if (opener.current === "approve") approveBtn.current?.focus();
    else if (opener.current === "reject") rejectBtn.current?.focus();
  }, [mode]);

  const approveTone = high ? "attacker" : "neutral";
  const approveCls = high ? BTN.attacker : BTN.secondary;

  return (
    <div className="mt-7 flex flex-col gap-4 border-t border-white/[0.06] pt-6" data-owner-actions>
      {mode === "idle" && (
        <div className="flex flex-col gap-3 md:flex-row">
          <button ref={rejectBtn} type="button" data-variant="primary" disabled={busy} onClick={() => open("reject")} className={BTN.primary}>
            Reject
          </button>
          <button ref={approveBtn} type="button" data-variant="secondary" data-tone={approveTone} disabled={busy} onClick={() => open("approve")} className={approveCls}>
            Approve
          </button>
        </div>
      )}

      {mode === "approve" && (
        <Expand>
          <div role="group" aria-label="Confirm approval" className="flex flex-col gap-4">
            <p className="text-body text-foreground">
              Pay <strong className="num font-semibold">{item.row.amount}</strong> to{" "}
              <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{p.payee ?? "an unresolved payee"}</span> from task{" "}
              <span className="num">{p.task_id}</span>.
            </p>
            {high && (
              <label className="flex items-start gap-3 text-small text-foreground">
                <input
                  ref={(el) => {
                    first.current = el;
                  }}
                  type="checkbox"
                  checked={ticked}
                  disabled={busy}
                  onChange={(e) => setTicked(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-attacker)]"
                />
                {TICK_LABEL}
              </label>
            )}
            <div className="flex flex-col gap-3 md:flex-row">
              <button
                ref={(el) => {
                  if (!high) first.current = el;
                }}
                type="button"
                data-tone={approveTone}
                disabled={busy || !p.payee || (high && !ticked)}
                onClick={() => void run(ids.approve, approveTx(owner.vault, p.id))}
                className={approveCls}
              >
                {signing(ids.approve) ? WAITING : "Approve and sign"}
              </button>
              <button type="button" disabled={busy} onClick={back} className={BTN.quiet}>
                Back
              </button>
            </div>
          </div>
        </Expand>
      )}

      {mode === "reject" && (
        <Expand>
          <div role="group" aria-label="Confirm rejection" className="flex flex-col gap-3">
            <label htmlFor={reasonId} className="text-small text-muted-foreground">
              Reason (stored on-chain, shown publicly)
            </label>
            <textarea
              id={reasonId}
              ref={(el) => {
                first.current = el;
              }}
              rows={2}
              value={reason}
              disabled={busy}
              aria-describedby={countId}
              onChange={(e) => setReason(capReason(e.target.value))}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-body text-foreground outline-none focus-visible:ring-2 disabled:opacity-60"
            />
            <p id={countId} className="num -mt-1 self-end text-micro text-muted-foreground">
              {Array.from(reason).length}/{REJECT_REASON_MAX}
            </p>
            <div className="flex flex-col gap-3 md:flex-row">
              <button type="button" disabled={busy} onClick={() => void run(ids.reject, rejectTx(owner.vault, p.id, reason))} className={BTN.primary}>
                {signing(ids.reject) ? WAITING : "Reject and sign"}
              </button>
              <button type="button" disabled={busy} onClick={back} className={BTN.quiet}>
                Back
              </button>
            </div>
          </div>
        </Expand>
      )}

      {mine && <TxResult state={state} />}
      <p className="text-small text-muted-foreground">{WALLET_NOTE}</p>
    </div>
  );
}
