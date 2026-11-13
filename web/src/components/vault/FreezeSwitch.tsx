"use client";

import { Snowflake } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/cn";
import { freezeTx, unfreezeTx } from "@/lib/actions";
import { TxResult } from "../wallet/TxResult";
import type { OwnerControls } from "../wallet/useOwnerAction";
import { BTN, WAITING } from "./owner-ui";

const ID = "freeze";
export const FREEZE_HELP = "Freeze stops every payment, including signed ones. Any owner key can freeze; unfreezing needs a full-access key.";
export const UNFREEZE_CONFIRM = "Unfreeze? The agent can spend again within its caps.";
// Off: the border alone marks the track, 3:1 against the brightest backdrop (FreezeSwitch.test.ts).
export const TRACK = { on: "border-p2-ring bg-p2-soft", off: "border-white/55 bg-white/[0.04]" } as const;

// Owner only. The switch shows the chain's `frozen` and nothing else: it flips after the refresh reads
// the new value. Freezing is the safe direction and needs no confirm; unfreezing asks once.
export function FreezeSwitch({ frozen, owner }: { frozen: boolean; owner: OwnerControls }) {
  const { state, busy, run } = owner.action;
  const [confirming, setConfirming] = useState(false);
  const switchRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const mine = state.kind !== "idle" && state.id === ID;
  const waiting = busy && mine;

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (state.kind === "done" && state.id === ID) setConfirming(false);
  }, [state]);
  useEffect(() => {
    if (!frozen) setConfirming(false);
  }, [frozen]);

  const toggle = () => {
    if (frozen) setConfirming(true);
    else void run(ID, freezeTx(owner.vault));
  };
  const back = () => {
    setConfirming(false);
    switchRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3" data-freeze>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          ref={switchRef}
          type="button"
          role="switch"
          aria-checked={frozen}
          aria-label="Freeze vault"
          disabled={busy}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
            frozen ? TRACK.on : TRACK.off,
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1/2 left-0.5 size-[18px] -translate-y-1/2 rounded-full shadow transition-transform duration-200 motion-reduce:transition-none",
              frozen ? "translate-x-5 bg-p2" : "translate-x-0 bg-foreground/80",
            )}
          />
        </button>
        <span className="inline-flex items-center gap-1.5 text-small whitespace-nowrap text-foreground">
          {frozen && <Snowflake className="size-3.5 text-p2" aria-hidden="true" />}
          {frozen ? "Frozen" : "Active"}
        </span>
        {waiting && <span className="text-small text-muted-foreground">{WAITING}</span>}
      </div>
      <p className="max-w-prose text-small text-muted-foreground">{FREEZE_HELP}</p>
      {confirming && frozen && (
        <div role="group" aria-label="Confirm unfreeze" className="flex flex-col gap-3 md:flex-row md:items-center">
          <p className="text-small text-foreground">{UNFREEZE_CONFIRM}</p>
          <div className="flex flex-col gap-3 md:flex-row">
            <button ref={confirmRef} type="button" disabled={busy} onClick={() => void run(ID, unfreezeTx(owner.vault))} className={BTN.primary}>
              {waiting ? WAITING : "Unfreeze and sign"}
            </button>
            <button type="button" disabled={busy} onClick={back} className={BTN.quiet}>
              Back
            </button>
          </div>
        </div>
      )}
      {mine && <TxResult state={state} />}
    </div>
  );
}
