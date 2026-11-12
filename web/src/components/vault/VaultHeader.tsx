import { Snowflake, ShieldCheck, ShieldOff, Activity } from "lucide-react";
import { cn } from "@/components/cn";
import { fmtUsdc } from "@/lib/format";
import type { VaultView } from "@/lib/views";
import { AccountId } from "../AccountId";
import { CountUp } from "../CountUp";

const COPY = {
  vault: {
    eyebrow: "Lineage mode",
    title: (
      <>
        Lineage <em>vault</em>
      </>
    ),
    blurb:
      "Pays payees you signed, and payees a resolver you pinned returns, within your caps. A raw address from the agent waits for you.",
  },
  guarded: {
    eyebrow: "LimitsOnly mode · the comparison guardrail wallet",
    title: (
      <>
        LimitsOnly <em>vault</em>
      </>
    ),
    blurb:
      "Same contract, same code, mode LimitsOnly: budget, per-payment cap, expiry and freeze. It pays any request within limits, wherever the address came from.",
  },
} as const;

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

export function VaultHeader({ view }: { view: VaultView }) {
  const c = COPY[view.key];
  const lineage = view.config.mode === "Lineage";
  return (
    <header className="pt-14 md:pt-20">
      <p className="eyebrow">{c.eyebrow}</p>
      <h1 className="mt-3 font-serif text-display">{c.title}</h1>
      <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-muted-foreground">{c.blurb}</p>
      <div className="mt-4">
        <AccountId id={view.vaultId} link className="text-[14px]" />
      </div>

      <dl className="glass mt-10 grid grid-cols-2 gap-x-6 gap-y-7 p-6 md:grid-cols-4 md:p-8">
        <Stat label="Balance">
          <CountUp
            value={BigInt(view.config.balance)}
            format={fmtUsdc}
            className="text-[1.875rem] leading-none"
            finalClassName="font-serif"
          />
        </Stat>
        <Stat label="In flight">
          <CountUp
            value={BigInt(view.config.total_reserved)}
            format={fmtUsdc}
            className="text-[1.875rem] leading-none"
            finalClassName="font-serif"
          />
        </Stat>
        <Stat label="Mode">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-small",
              lineage ? "border-p1-ring bg-p1-soft text-p1-fg" : "border-attacker-ring bg-attacker-soft text-attacker-fg",
            )}
          >
            {lineage ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <ShieldOff className="size-3.5" aria-hidden="true" />}
            {view.config.mode}
          </span>
        </Stat>
        <Stat label="State">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-small",
              view.config.frozen ? "border-p2-ring bg-p2-soft text-p2-fg" : "border-white/10 bg-white/[0.04]",
            )}
          >
            {view.config.frozen ? <Snowflake className="size-3.5" aria-hidden="true" /> : <Activity className="size-3.5" aria-hidden="true" />}
            {view.config.frozen ? "Frozen" : "Active"}
          </span>
        </Stat>
        <Stat label="Owner" className="col-span-2 md:col-span-1">
          <AccountId id={view.config.owner} link />
        </Stat>
        <Stat label="Token" className="col-span-2 md:col-span-1">
          <AccountId id={view.config.token} link />
        </Stat>
        <Stat label="Code hash" className="col-span-2">
          <span className="font-mono text-[12.5px] break-all text-muted-foreground">{view.codeHash ?? "no code"}</span>
        </Stat>
      </dl>
    </header>
  );
}
