"use client";

import { ArrowRight, BookCheck, ShieldCheck, ShieldOff, Snowflake } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/cn";
import { AGENT_IDS, CONTRACTS, VAULT_KEYS, type VaultKey } from "@/lib/config";
import { fmtUsdc } from "@/lib/format";
import type { Overview } from "@/lib/views";
import { AccountId } from "../AccountId";
import { CountUp } from "../CountUp";
import { Section } from "../live/ScreenState";
import { AgentKeyCard } from "./AgentKeyCard";

const NAMES: Record<VaultKey, string> = { vault: "Lineage vault", guarded: "LimitsOnly vault" };

function AttackerHeadline({ view }: { view: Overview }) {
  const r = view.demo.attackerReceived;
  return (
    <div data-testid="attacker-headline" className="glass hairline-top flex flex-col gap-6 p-6 md:p-8">
      <p className="eyebrow">Latest demo run · what the attacker received</p>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        <div>
          <CountUp value={r.vault} format={fmtUsdc} className="text-stat text-p1-fg" finalClassName="font-serif" />
          <p className="mt-2 flex items-center gap-1.5 text-small text-muted-foreground">
            <ShieldCheck className="size-3.5 text-p1" aria-hidden="true" /> from the Lineage vault
          </p>
        </div>
        <div>
          <CountUp value={r.guarded} format={fmtUsdc} className="text-stat text-attacker-fg" finalClassName="font-serif" />
          <p className="mt-2 flex items-center gap-1.5 text-small text-muted-foreground">
            <ShieldOff className="size-3.5 text-attacker" aria-hidden="true" /> from the LimitsOnly vault
          </p>
        </div>
      </div>
      <Link
        href="/compare"
        className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-small transition-colors hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:outline-none"
      >
        Same agent, same plan, {view.sameCode ? "same code" : "different code"}: see it side by side
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function NeedsYouCard({ count }: { count: number }) {
  return (
    <Link
      href="/vault/vault#inbox"
      className={cn(
        "glass group flex flex-col justify-between gap-6 p-6 transition-colors outline-none focus-visible:ring-2 md:p-8",
        count > 0 ? "border-p3-ring animate-glow-amber motion-reduce:animate-none" : "",
      )}
    >
      <p className="eyebrow text-p3-fg">Needs you</p>
      <div>
        <p className={cn("font-serif text-stat", count > 0 ? "text-p3-fg" : "text-muted-foreground")}>{count}</p>
        <p className="mt-2 text-small text-muted-foreground">
          {count === 1 ? "untrusted payment waits" : "untrusted payments wait"} for you in the Lineage vault inbox
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-small text-foreground">
        Open the inbox <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

function VaultCard({ k, view }: { k: VaultKey; view: Overview }) {
  const v = view.vaults[k];
  const lineage = v.config.mode === "Lineage";
  return (
    <Link
      href={`/vault/${k}`}
      aria-labelledby={`vault-card-${k}`}
      className="glass group flex flex-col gap-5 p-6 transition-colors outline-none hover:border-white/15 focus-visible:ring-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{lineage ? "checks where payees came from" : "the guardrail wallet: limits only"}</p>
          <h3 id={`vault-card-${k}`} className="mt-2 flex items-center gap-2 font-serif text-h2">
            {lineage ? (
              <ShieldCheck className="size-5 text-p1" aria-hidden="true" />
            ) : (
              <ShieldOff className="size-5 text-attacker" aria-hidden="true" />
            )}
            {NAMES[k]}
          </h3>
        </div>
        <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </div>
      <AccountId id={v.vaultId} />
      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="eyebrow">Balance</dt>
          <dd className="mt-1">
            <CountUp value={BigInt(v.config.balance)} format={fmtUsdc} className="text-[1.375rem] leading-none" finalClassName="font-serif" />
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Payments</dt>
          <dd className="mt-1 font-serif text-[1.375rem] leading-none">{v.config.payment_count}</dd>
        </div>
        <div>
          <dt className="eyebrow">State</dt>
          <dd className="mt-1 flex items-center gap-1.5 text-small">
            {v.config.frozen ? <Snowflake className="size-3.5 text-p2" aria-hidden="true" /> : null}
            {v.config.frozen ? "Frozen" : "Active"}
          </dd>
        </div>
      </dl>
      <p className="font-mono text-[11px] break-all text-faint">code {v.codeHash ?? "none"}</p>
    </Link>
  );
}

function RegistryCard({ view }: { view: Overview }) {
  return (
    <section aria-labelledby="registry-title" className="glass p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <BookCheck className="size-3.5 text-p2" aria-hidden="true" /> P2 resolver
          </p>
          <h3 id="registry-title" className="mt-2 font-serif text-h2">
            The service registry
          </h3>
          <p className="mt-2 max-w-xl text-small text-muted-foreground">
            A curated resolver the owner pinned. For a P2 payment the vault calls{" "}
            <span className="font-mono text-foreground">lineage_resolve</span> and pays exactly the payee and price it
            returns, not what the agent asked for.
          </p>
        </div>
        <AccountId id={CONTRACTS.registry} link />
      </div>
      <ul className="mt-6 divide-y divide-white/[0.06] rounded-xl border border-white/[0.07]">
        {view.services.length === 0 && <li className="px-4 py-4 text-small text-faint">No services listed.</li>}
        {view.services.map((s) => (
          <li key={s.id} className="grid gap-2 px-4 py-3.5 md:grid-cols-[10rem_7rem_1fr_7rem] md:items-center md:gap-4">
            <span className="font-mono text-small text-p2-fg">{s.id}</span>
            <span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[12px]",
                  s.status === "Verified"
                    ? "border-p1-ring bg-p1-soft text-p1-fg"
                    : s.status === "Pending"
                      ? "border-p3-ring bg-p3-soft text-p3-fg"
                      : "border-white/10 text-muted-foreground",
                )}
              >
                {s.status}
              </span>
            </span>
            <span className="min-w-0">
              <AccountId id={s.payee} />
              <span className="block text-[12px] text-faint">{s.description}</span>
            </span>
            <span className="font-mono tabular-nums md:text-right">{fmtUsdc(s.price)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewDashboard({ view }: { view: Overview }) {
  return (
    <div className="flex flex-col gap-16 md:gap-20">
      <div className="grid gap-5 md:grid-cols-[1.65fr_1fr] md:gap-6">
        <AttackerHeadline view={view} />
        <NeedsYouCard count={view.awaitingCount} />
      </div>

      <Section
        eyebrow="Same contract, two modes"
        title={
          <>
            Two <em>vaults</em>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {VAULT_KEYS.map((k) => (
            <VaultCard key={k} k={k} view={view} />
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Proof the agent can only ask"
        title={
          <>
            The agent&apos;s <em>keys</em>
          </>
        }
      >
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {VAULT_KEYS.map((k) => (
            <AgentKeyCard key={k} vault={k} agentId={AGENT_IDS[k]} proof={view.keyProofs[k]} />
          ))}
        </div>
      </Section>

      <RegistryCard view={view} />
    </div>
  );
}
