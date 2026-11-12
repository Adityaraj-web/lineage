"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/components/cn";
import { Glass } from "@/components/Glass";
import { Tilt } from "@/components/Tilt";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { fmtUsdc } from "@/lib/format";
import type { Overview } from "@/lib/views";
import { shortId } from "../AccountId";
import { EASE_OUT } from "../motion";
import { Memo } from "../Memo";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { accentClass, levelAccent } from "../tone";
import { needsYouText } from "../transitions";
import { LEVEL_WORD } from "../vault/RiskCard";

const TINT = {
  p3: "bg-[radial-gradient(80%_70%_at_20%_100%,rgb(251_191_36/0.12),transparent_70%)]",
  attacker: "bg-[radial-gradient(70%_80%_at_100%_50%,rgb(251_113_133/0.12),transparent_70%)]",
  p1: "bg-[radial-gradient(70%_80%_at_100%_50%,rgb(52_211_153/0.10),transparent_70%)]",
};

function Door({
  href,
  title,
  tint,
  className,
  children,
  i,
  top = false,
}: {
  top?: boolean;
  href: string;
  title: string;
  tint: keyof typeof TINT;
  className?: string;
  children: React.ReactNode;
  i: number;
}) {
  const reduced = useReducedMotionPref();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, transform: "translateY(24px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay: i * 0.08, ease: EASE_OUT }}
    >
      <Tilt className="h-full">
        <Glass
          as={Link}
          href={href}
          tier="stage"
          className="door press flex h-full flex-col gap-8 overflow-hidden p-6 outline-none focus-visible:ring-2 md:p-8"
        >
          <span aria-hidden="true" className={cn("door-tint pointer-events-none absolute inset-0 -z-10", TINT[tint])} />
          <h3 className="text-[1.375rem] leading-tight font-semibold">{title}</h3>
          <div className={top ? "flex flex-1 flex-col" : "mt-auto"}>{children}</div>
        </Glass>
      </Tilt>
    </motion.div>
  );
}

function HeldPreview({ view }: { view: Overview }) {
  const held = view.held;
  if (!held) {
    return (
      <p className={cn("text-lead", view.awaitingCount > 0 ? "text-p3" : "text-muted-foreground")}>
        {view.awaitingCount > 0 ? `${needsYouText(view.awaitingCount)} in the Lineage vault` : "Nothing is waiting for you"}
      </p>
    );
  }
  const a = accentClass[levelAccent[held.risk.level]];
  return (
    <div className="flex flex-1 flex-col gap-4">
      {held.memo && (
        <p className="max-w-[32rem] text-lead text-foreground">
          <Memo text={held.memo} />
        </p>
      )}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="num text-[clamp(2rem,4vw,2.75rem)] leading-none font-medium whitespace-nowrap">{held.amount}</span>{" "}
        <span className="inline-flex items-center gap-3">
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">to </span>
          <span className="font-mono text-[15px] text-foreground">{shortId(held.payee)}</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <ProvenanceBadge badge={held.badge} compact />
        <span className={cn("chip-ink inline-flex h-7 items-center rounded-full border px-3 text-small font-semibold", a.border, a.soft, a.text)}>
          {LEVEL_WORD[held.risk.level]}
        </span>
      </div>
      <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/10 pt-4 text-small text-muted-foreground">
        Held for you in the Lineage vault.
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          Review it <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </p>
    </div>
  );
}

export function Doorways({ view }: { view: Overview }) {
  const r = view.compare.attackerReceivedText;
  return (
    <section id="doorways" aria-labelledby="doorways-title" className="scroll-mt-24 py-24">
      <h2 id="doorways-title" className="font-serif text-display">
        See it for yourself.
      </h2>
      <div className="mt-12 grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:grid-rows-2">
        <Door i={0} href="/vault/vault#inbox" title="Review what needs you" tint="p3" className="md:row-span-2" top>
          <HeldPreview view={view} />
        </Door>
        <Door i={1} href="/compare" title="See the attack side by side" tint="attacker">
          <div className="flex flex-col gap-2 text-body">
            <p className="flex items-baseline gap-3">
              <span className="num text-[1.75rem] leading-none font-medium whitespace-nowrap text-p1">{r.vault}</span>
              <span className="text-muted-foreground">from Lineage</span>
            </p>
            <p className="flex items-baseline gap-3">
              <span className="num text-[1.75rem] leading-none font-medium whitespace-nowrap text-attacker">{r.guarded}</span>
              <span className="text-muted-foreground">from LimitsOnly</span>
            </p>
          </div>
        </Door>
        <Door i={2} href="/vault/vault" title="Inspect the vaults" tint="p1">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-small text-muted-foreground">Lineage balance</dt>
              <dd className="num mt-1 text-[1.375rem] leading-none font-medium">{fmtUsdc(view.vaults.vault.config.balance)}</dd>
            </div>
            <div>
              <dt className="text-small text-muted-foreground">LimitsOnly balance</dt>
              <dd className="num mt-1 text-[1.375rem] leading-none font-medium">{fmtUsdc(view.vaults.guarded.config.balance)}</dd>
            </div>
          </dl>
        </Door>
      </div>
    </section>
  );
}
