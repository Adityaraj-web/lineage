import type { Inbox, PaymentRow } from "@/lib/views";
import { StatusPill } from "../StatusPill";
import { TxResult } from "../wallet/TxResult";
import { heldAction, type OwnerAction } from "../wallet/useOwnerAction";

const PAST = { approve: "approved", reject: "rejected" } as const;

// Once a decided payment leaves the inbox its card is gone; this line keeps the hash and shows
// what the chain made of it (an approve can end Blocked, e.g. on a frozen vault).
export function LastAction({ action, inbox, payments }: { action: OwnerAction; inbox: Inbox; payments: PaymentRow[] }) {
  const { state } = action;
  if (state.kind !== "done" && state.kind !== "failed") return null;
  const held = heldAction(state.id);
  if (!held) return null;
  if (inbox.kind === "lineage" && inbox.items.some((i) => i.row.payment.id === held.paymentId)) return null;
  const payment = payments.find((r) => r.payment.id === held.paymentId)?.payment;
  return (
    <div data-testid="last-action" className="flex flex-col gap-2 text-small">
      <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-muted-foreground">
        <span>
          Last action: {PAST[held.verb]} payment <span className="num">#{held.paymentId}</span>
        </span>
        {payment && <StatusPill status={payment.status} />}
        {payment?.status === "Blocked" && <span className="text-foreground [overflow-wrap:anywhere]">{payment.reason}</span>}
      </p>
      <TxResult state={state} />
    </div>
  );
}
