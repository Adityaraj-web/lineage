import { ArrowUpRight } from "lucide-react";
import { cn } from "@/components/cn";
import { explorerTx } from "@/lib/config";
import { shortHash } from "../Seal";
import type { ActionState } from "./useOwnerAction";

function HashLink({ hash }: { hash: string }) {
  return (
    <a
      href={explorerTx(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-0.5 rounded-sm font-mono text-[12.5px] text-foreground underline-offset-4 outline-none hover-fine:underline focus-visible:ring-2"
    >
      <span aria-hidden="true">{shortHash(hash)}</span>
      <span className="sr-only">{hash}</span>
      <ArrowUpRight className="size-3 self-center text-muted-foreground" aria-hidden="true" />
    </a>
  );
}

// The outcome of the last owner action: hash, explorer link, and the contract's or wallet's message.
export function TxResult({ state, className }: { state: ActionState; className?: string }) {
  if (state.kind !== "done" && state.kind !== "failed") return null;
  const ok = state.kind === "done" && state.result.ok;
  const hash = state.kind === "done" ? state.result.hash : null;
  const message =
    state.kind === "failed" ? state.message : ok ? null : state.result.hash ? `Failed: ${state.result.error ?? "Transaction failed"}` : state.result.error;
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1 text-small", className)}>
      {ok && <span className="text-p1">Sent</span>}
      {message && <span className={ok ? "" : "text-attacker"}>{message}</span>}
      {hash && <HashLink hash={hash} />}
    </p>
  );
}
