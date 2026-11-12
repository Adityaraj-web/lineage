import { Snowflake } from "lucide-react";
import { fmtUsdc } from "@/lib/format";
import type { StoryStrip as Strip } from "@/lib/story";
import type { VaultView } from "@/lib/views";
import { AccountId } from "../AccountId";
import { CountUp } from "../CountUp";
import { shortHash } from "../Seal";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { StoryStrip } from "./StoryStrip";

const COPY = {
  vault: {
    title: "Lineage vault",
    blurb: "Pays payees you signed, and payees a resolver you pinned returns, within your caps. A raw address from the agent waits for you.",
  },
  guarded: {
    title: "LimitsOnly vault",
    blurb: "The guardrail wallet: same contract and code, limits only. It pays any request within budget and cap, wherever the address came from.",
  },
} as const;

function Stat({ label, value, tone }: { label: string; value: bigint; tone?: string }) {
  return (
    <div className="stat-box min-w-[9rem] flex-1 basis-[11rem]">
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="mt-2">
        <CountUp value={value} format={fmtUsdc} className={`stat [--stat-max:3.5rem] ${tone ?? ""}`} />
      </dd>
    </div>
  );
}

export function VaultHeader({ view, strip }: { view: VaultView; strip: Strip | null }) {
  const c = COPY[view.key];
  return (
    <header aria-label={c.title} className="flex flex-col gap-10 pt-14 md:pt-20">
      {strip && <StoryStrip strip={strip} />}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-[36rem]">
          <h1 className="font-serif text-display">{c.title}</h1>
          <p className="mt-4 text-body text-muted-foreground">{c.blurb}</p>
        </div>
        <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:min-w-[26rem] lg:flex-nowrap">
          <Stat label="Balance" value={BigInt(view.config.balance)} />
          <Stat label="In flight" value={BigInt(view.config.total_reserved)} tone={view.config.total_reserved !== "0" ? "text-p3" : "text-muted-foreground"} />
        </dl>
      </div>
      <p className="flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          {view.config.frozen && <Snowflake className="size-3.5 text-p2" aria-hidden="true" />}
          {view.config.frozen ? "Frozen" : "Active"}
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-1.5">
          owned by <AccountId id={view.config.owner} link className="text-[13px]" />
        </span>
        <span className="inline-flex flex-wrap items-baseline gap-1.5">
          pays in <AccountId id={view.config.token} link className="text-[13px]" />
        </span>
        <span className="inline-flex items-baseline gap-1.5">
          code
          {view.codeHash ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="rounded font-mono text-[13px] text-foreground outline-none focus-visible:ring-2">
                  <span aria-hidden="true">{shortHash(view.codeHash)}</span>
                  <span className="sr-only">{view.codeHash}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="font-mono text-micro" aria-hidden="true">
                {view.codeHash}
              </TooltipContent>
            </Tooltip>
          ) : (
            <span>none</span>
          )}
        </span>
        <AccountId id={view.vaultId} link className="text-[13px]" />
      </p>
    </header>
  );
}
