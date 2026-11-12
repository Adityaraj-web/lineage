"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/components/cn";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { announceChanges, type Mark } from "@/lib/changes";
import { fmtDate } from "@/lib/format";
import type { PaymentRow, TaskRow } from "@/lib/views";
import { AccountId } from "../AccountId";
import { Memo } from "../Memo";
import { EASE_OUT } from "../motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { ProvenanceBadge } from "../ProvenanceBadge";
import { StatusPill } from "../StatusPill";
import { accentHex, badgeAccent } from "../tone";
import { Glass } from "@/components/Glass";

const NO_MARKS: ReadonlyMap<number, Mark> = new Map();
const COLS =
  "lg:grid lg:grid-cols-[3rem_minmax(12rem,1.35fr)_7rem_minmax(10rem,1.1fr)_6rem_minmax(9rem,1.3fr)] lg:items-center lg:gap-x-4 xl:gap-x-5";

export function PaymentsTable({
  payments,
  tasks,
  marks = NO_MARKS,
}: {
  payments: PaymentRow[];
  tasks: TaskRow[];
  marks?: ReadonlyMap<number, Mark>;
}) {
  const reduced = useReducedMotionPref();
  const [filter, setFilter] = useState("all");
  const taskOptions = useMemo(() => {
    const used = new Set(payments.map((r) => r.payment.task_id));
    return tasks.filter((t) => used.has(t.task.id)).sort((a, b) => b.task.id - a.task.id);
  }, [payments, tasks]);
  const rows = filter === "all" ? payments : payments.filter((r) => String(r.payment.task_id) === filter);

  return (
    <div>
      <ToggleGroup
        type="single"
        value={filter}
        onValueChange={(v) => v && setFilter(v)}
        aria-label="Filter payments by task"
        className="mb-4 flex-wrap"
        spacing={1}
      >
        <ToggleGroupItem value="all" className="h-8 rounded-full px-3.5 text-small data-[state=on]:bg-white/[0.09]">
          All
        </ToggleGroupItem>
        {taskOptions.map((t) => (
          <ToggleGroupItem
            key={t.task.id}
            value={String(t.task.id)}
            className="h-8 rounded-full px-3.5 text-small data-[state=on]:bg-white/[0.09]"
          >
            <span>
              <span className="num">Task {t.task.id}</span>
              {t.label && <span className="text-muted-foreground">, {t.label}</span>}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Glass role="table" aria-label="Payments" className="overflow-hidden">
        <div role="rowgroup" className="hidden border-b border-white/[0.06] px-5 py-3 lg:block">
          <div role="row" className={cn(COLS, "label")}>
            <span role="columnheader">#</span>
            <span role="columnheader">Where the payee came from</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Payee</span>
            <span role="columnheader" className="text-right">
              Amount
            </span>
            <span role="columnheader">Memo (untrusted)</span>
          </div>
        </div>
        <div role="rowgroup" className="divide-y divide-white/[0.05]">
          {/* Keyed by filter: changing the filter swaps rows instantly; only data changes animate. */}
          <AnimatePresence initial={false} key={filter}>
            {rows.map((r) => {
              const p = r.payment;
              const mark = marks.get(p.id);
              const accent = accentHex[badgeAccent[r.badge.tone]];
              const unasked = r.badge.code === "P3" && r.badge.tone === "red";
              return (
                <motion.div
                  role="row"
                  key={p.id}
                  data-payment-id={p.id}
                  data-paid-without-asking={unasked || undefined}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, transform: "translateY(-8px)" }}
                  animate={{ opacity: 1, transform: "none" }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className={cn("relative grid gap-3 px-5 py-4", COLS, unasked && "bg-attacker-soft")}
                >
                  {mark && (
                    <motion.span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0"
                      style={{ background: `linear-gradient(90deg, ${accent}33, ${accent}0d 60%, transparent)` }}
                      initial={{ opacity: 1 }}
                      animate={{ opacity: reduced ? 1 : 0 }}
                      transition={{ duration: 1.6, ease: "easeOut" }}
                    />
                  )}
                  <span role="cell" className="relative num text-small text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="rounded outline-none focus-visible:ring-2">
                          #{p.id}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="text-micro" aria-hidden="true">
                        Task #{p.task_id}, updated {fmtDate(p.updated_at_ms)}
                      </TooltipContent>
                    </Tooltip>
                    <span className="sr-only">
                      , task #{p.task_id}, updated {fmtDate(p.updated_at_ms)}
                    </span>
                  </span>
                  <span role="cell" className="relative min-w-0">
                    <ProvenanceBadge badge={r.badge} compact />
                  </span>
                  <span role="cell" className="relative flex flex-wrap items-center gap-2">
                    <StatusPill status={p.status} />
                    {mark && (
                      <span className="rounded bg-white/10 px-1 text-micro text-foreground">
                        {mark.kind === "added" ? "New" : "Updated"}
                      </span>
                    )}
                  </span>
                  <span role="cell" className="relative min-w-0">
                    {p.payee ? <AccountId id={p.payee} link /> : <span className="text-faint">resolving…</span>}
                  </span>
                  <span role="cell" className="relative num text-body lg:text-right">
                    {r.amount}
                  </span>
                  <span role="cell" className="relative min-w-0 text-small text-muted-foreground">
                    <Memo text={p.memo} className="line-clamp-2" />
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">No payments in this task yet.</p>}
        </div>
      </Glass>
      <p className="sr-only" aria-live="polite">
        {announceChanges(marks)}
      </p>
    </div>
  );
}
