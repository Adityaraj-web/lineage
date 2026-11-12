"use client";

import { Inbox as InboxIcon, ShieldOff } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useRef } from "react";
import { fmtDate } from "@/lib/format";
import type { Inbox as InboxModel, InboxItem } from "@/lib/views";
import { AccountId } from "../AccountId";
import { EASE_OUT } from "../motion";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { StatusPill } from "../StatusPill";
import { ReferenceLink } from "./ReferenceLink";
import { findingDelay, RiskCard } from "./RiskCard";

export function InboxCard({ item }: { item: InboxItem }) {
  const ref = useRef<HTMLElement>(null);
  const play = useInView(ref, { once: true, amount: 0.3 });
  const p = item.row.payment;
  const dupIndex = item.risk.findings.findIndex((f) => f.id === "duplicate-reference");
  const dup = dupIndex >= 0 ? item.risk.findings[dupIndex] : null;
  const related = dup?.ref ? (item.related.find((r) => r.payment.id === dup.ref!.paymentId) ?? null) : null;
  const headingId = `inbox-${p.id}-title`;

  return (
    <article
      ref={ref}
      aria-labelledby={headingId}
      className="glass hairline-top relative overflow-hidden border-p3-ring/70 [--hairline:var(--color-p3)]"
    >
      <div className="grid md:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-5 p-6 md:border-r md:border-white/[0.06] md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h3 id={headingId} className="eyebrow">
              Payment #{p.id} · held for you · task #{p.task_id}
            </h3>
            <StatusPill status={p.status} />
          </div>
          <div>
            <p className="font-serif text-h1 tabular-nums">{item.row.amount}</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2 text-muted-foreground">
              <span>to</span>
              {p.payee ? <AccountId id={p.payee} link className="text-[14px]" /> : <span>an unresolved payee</span>}
            </p>
          </div>
          <ProvenanceBadge badge={item.row.badge} />
          <p className="text-small text-muted-foreground">
            <span className="text-foreground">Why the vault held it: </span>
            {p.reason}
          </p>
          <ReferenceLink
            row={item.row}
            related={related}
            token={dup?.ref?.token ?? null}
            play={play}
            delay={findingDelay(Math.max(0, dupIndex)) + 0.3}
          />
          <p className="font-mono text-[11px] text-faint">
            requested {fmtDate(p.created_at_ms)} by <AccountId id={p.agent} className="text-[11px]" />
          </p>
        </div>
        <div className="bg-white/[0.012] p-6 md:p-8">
          <RiskCard risk={item.risk} play={play} />
        </div>
      </div>
    </article>
  );
}

export function Inbox({ inbox }: { inbox: InboxModel }) {
  if (inbox.kind === "limits-only") {
    return (
      <div className="glass flex items-start gap-4 border-attacker-ring/50 p-6 md:p-8">
        <ShieldOff className="mt-1 size-5 shrink-0 text-attacker-fg" aria-hidden="true" />
        <div>
          <p className="font-serif text-h2">No inbox. It never asks.</p>
          <p className="mt-2 max-w-prose text-muted-foreground">{inbox.message}</p>
        </div>
      </div>
    );
  }
  if (inbox.items.length === 0) {
    return (
      <div className="glass flex items-start gap-4 p-6 md:p-8">
        <InboxIcon className="mt-1 size-5 shrink-0 text-p1" aria-hidden="true" />
        <div>
          <p className="font-serif text-h2">Nothing is waiting for you.</p>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Untrusted payees land here for your decision. Everything else was signed by you or resolved by a
            resolver you pinned.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence initial={false}>
        {inbox.items.map((item) => (
          <motion.div
            key={item.row.payment.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            <InboxCard item={item} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
