import { freezeTx, unfreezeTx } from "@/lib/actions";
import { TxResult } from "../wallet/TxResult";
import type { OwnerControls } from "../wallet/useOwnerAction";

const ID = "freeze";

// Owner only. Shows the chain's value: the label changes only after the refresh reads the new `frozen`.
export function FreezeSwitch({ frozen, owner }: { frozen: boolean; owner: OwnerControls }) {
  const { state, busy, run } = owner.action;
  const mine = state.kind !== "idle" && state.id === ID;
  const label = frozen ? "Unfreeze" : "Freeze";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(ID, frozen ? unfreezeTx(owner.vault) : freezeTx(owner.vault))}
          className="press inline-flex h-9 items-center rounded-full border border-white/10 px-4 text-small text-foreground outline-none hover-fine:bg-white/[0.06] focus-visible:ring-2 disabled:opacity-60"
        >
          {busy && mine ? "Waiting for your wallet…" : label}
        </button>
        <p className="text-small text-muted-foreground">
          Freeze stops every payment, including signed ones. Any owner key can freeze; unfreezing needs a full-access key.
        </p>
      </div>
      {mine && <TxResult state={state} />}
    </div>
  );
}
