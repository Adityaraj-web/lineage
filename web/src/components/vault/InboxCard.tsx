"use client";

import { Inbox as InboxIcon, ShieldOff } from "lucide-react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { useRef } from "react";
import type { Inbox as InboxModel, InboxItem } from "@/lib/views";
import { Glass } from "@/components/Glass";
import { AccountId } from "../AccountId";
import { EASE_OUT } from "../motion";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { StatusPill } from "../StatusPill";
import { ReferenceLink } from "./ReferenceLink";
import type { OwnerControls } from "../wallet/useOwnerAction";
import { OwnerActions } from "./OwnerActions";
import { findingDelay, RiskCard } from "./RiskCard";

export function InboxCard({ item, owner }: { item: InboxItem; owner?: OwnerControls }) {
  const ref = useRef<HTMLElement>(null);
  const play = useInView(ref, { once: true, amount: 0.3 });
  const p = item.row.payment;
  const dupIndex = item.risk.findings.findIndex((f) => f.id === "duplicate-reference");
  const dup = dupIndex >= 0 ? item.risk.findings[dupIndex] : null;
  const related = dup?.ref ? (item.related.find((r) => r.payment.id === dup.ref!.paymentId) ?? null) : null;
  const headingId = `inbox-${p.id}-title`;

  return (
    <Glass
      as="article"
      ref={ref}
      aria-labelledby={headingId}
      className="overflow-hidden [--glass-edge:rgb(251_191_36/0.55)] [--glass-ink:0.4]"
    >
      <div className="grid md:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-7 p-6 md:border-r md:border-white/[0.06] md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h3 id={headingId} className="text-small font-medium text-muted-foreground">
              Payment #{p.id}, held for you
            </h3>
            <StatusPill status={p.status} />
          </div>
          <ReferenceLink
            row={item.row}
            related={related}
            token={dup?.ref?.token ?? null}
            play={play}
            delay={findingDelay(Math.max(0, dupIndex)) + 0.3}
          />
          <div className="flex flex-col gap-3">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num text-[clamp(2rem,4vw,2.75rem)] leading-none font-medium whitespace-nowrap">{item.row.amount}</span>
              <span className="text-muted-foreground">to</span>
              {p.payee ? <AccountId id={p.payee} link className="text-[14px]" /> : <span>an unresolved payee</span>}
            </p>
            <ProvenanceBadge badge={item.row.badge} compact />
          </div>
        </div>
        <div className="bg-white/[0.012] p-6 md:p-8">
          <RiskCard risk={item.risk} play={play} />
          {owner && <OwnerActions item={item} owner={owner} />}
        </div>
      </div>
    </Glass>
  );
}

export function Inbox({ inbox, owner }: { inbox: InboxModel; owner?: OwnerControls }) {
  if (inbox.kind === "limits-only") {
    return (
      <Glass className="flex items-start gap-4 p-6 [--glass-edge:rgb(251_113_133/0.45)] md:p-8">
        <ShieldOff className="mt-1 size-5 shrink-0 text-attacker" aria-hidden="true" />
        <div>
          <p className="font-serif text-title">No inbox. It never asks.</p>
          <p className="mt-2 max-w-prose text-muted-foreground">{inbox.message}</p>
        </div>
      </Glass>
    );
  }
  if (inbox.items.length === 0) {
    return (
      <Glass className="flex items-start gap-4 p-6 md:p-8">
        <InboxIcon className="mt-1 size-5 shrink-0 text-p1" aria-hidden="true" />
        <div>
          <p className="font-serif text-title">Nothing is waiting for you.</p>
          <p className="mt-2 max-w-prose text-muted-foreground">
            Untrusted payees land here for your decision. Everything else was signed by you or resolved by a
            resolver you pinned.
          </p>
        </div>
      </Glass>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence initial={false}>
        {inbox.items.map((item) => (
          <motion.div
            key={item.row.payment.id}
            initial={{ opacity: 0, transform: "translateY(-8px)" }}
            animate={{ opacity: 1, transform: "none" }}
            exit={{ opacity: 0, transform: "translateY(-8px)" }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
          >
            <InboxCard item={item} owner={owner} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
