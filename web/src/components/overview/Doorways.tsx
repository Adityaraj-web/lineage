"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/components/cn";
import { Glass } from "@/components/Glass";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { fmtUsdc } from "@/lib/format";
import type { Overview } from "@/lib/views";
import { shortId } from "../AccountId";
import { EASE_OUT } from "../motion";
import { needsYouText } from "../transitions";

const TINT = {
  p3: "bg-[radial-gradient(80%_70%_at_20%_100%,rgb(251_191_36/0.10),transparent_70%)]",
  attacker: "bg-[radial-gradient(70%_80%_at_100%_50%,rgb(251_113_133/0.10),transparent_70%)]",
  p1: "bg-[radial-gradient(70%_80%_at_100%_50%,rgb(52_211_153/0.09),transparent_70%)]",
};

function Door({
  href,
  title,
  thread,
  tint,
  className,
  children,
  i,
}: {
  href: string;
  title: string;
  thread: string;
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
      <Glass
        as={Link}
        href={href}
        className="door press flex h-full flex-col justify-between gap-8 overflow-hidden p-6 outline-none focus-visible:ring-2 md:p-8"
      >
        <span aria-hidden="true" className={cn("door-tint pointer-events-none absolute inset-0", TINT[tint])} />
        <h3 className="relative text-[1.375rem] leading-tight font-semibold">{title}</h3>
        <div className="relative">{children}</div>
      </Glass>
    </motion.div>
  );
}

export function Doorways({ view }: { view: Overview }) {
  const held = view.compare.rows.find((r) => r.poisoned)?.sides.vault;
  const waiting = held?.payment?.status === "AwaitingApproval";
  const r = view.compare.attackerReceivedText;
  return (
    <section id="doorways" aria-labelledby="doorways-title" className="scroll-mt-24 py-24">
      <h2 id="doorways-title" className="font-serif text-display">
        See it for yourself.
      </h2>
      <div className="mt-12 grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:grid-rows-2">
        <Door i={0} href="/vault/vault#inbox" title="Review what needs you" thread="var(--color-p3)" tint="p3" className="md:row-span-2">
          <p className={cn("num text-[clamp(2.75rem,5vw,4rem)] leading-none font-medium", view.awaitingCount > 0 ? "text-p3" : "text-muted-foreground")}>
            {view.awaitingCount}
          </p>
          <p className="mt-3 text-body">{needsYouText(view.awaitingCount)}</p>
          {waiting && held?.amount && held.payee && (
            <p className="mt-1 text-small text-muted-foreground">
              {held.amount} to {shortId(held.payee)}, held for you in the Lineage vault
            </p>
          )}
        </Door>
        <Door i={1} href="/compare" title="See the attack side by side" thread="var(--color-attacker)" tint="attacker">
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
        <Door i={2} href="/vault/vault" title="Inspect the vaults" thread="var(--color-p1)" tint="p1">
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
