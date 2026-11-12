import { defaultRejectReason, rejectTx } from "@/lib/actions";
import type { InboxItem } from "@/lib/views";
import { TxResult } from "../wallet/TxResult";
import type { OwnerControls } from "../wallet/useOwnerAction";

export const WALLET_NOTE = "Your wallet will ask you to confirm. It needs a full-access key on the owner account.";

// Owner only. Phase 2: Reject with the default reason. Approve arrives with its confirm step.
export function OwnerActions({ item, owner }: { item: InboxItem; owner: OwnerControls }) {
  const p = item.row.payment;
  const id = `reject:${p.id}`;
  const { state, busy, run } = owner.action;
  const mine = state.kind !== "idle" && state.id === id;
  return (
    <div className="mt-7 flex flex-col gap-3 border-t border-white/[0.06] pt-6">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run(id, rejectTx(owner.vault, p.id, defaultRejectReason(item.risk)))}
        className="press inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-small font-medium text-background outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 max-md:w-full md:self-start"
      >
        {busy && mine ? "Waiting for your wallet…" : "Reject"}
      </button>
      {mine && <TxResult state={state} />}
      <p className="text-small text-muted-foreground">{WALLET_NOTE}</p>
    </div>
  );
}
