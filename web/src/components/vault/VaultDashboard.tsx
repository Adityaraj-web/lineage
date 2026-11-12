"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Mark } from "@/lib/changes";
import type { VaultView } from "@/lib/views";
import { Section } from "../live/ScreenState";
import { Inbox } from "./InboxCard";
import { PaymentsTable } from "./PaymentsTable";
import { TaskCard } from "./TaskCard";
import { VaultHeader } from "./VaultHeader";

export function VaultDashboard({
  view,
  marks,
  now,
}: {
  view: VaultView;
  marks?: ReadonlyMap<number, Mark>;
  now: number;
}) {
  const tasks = [...view.tasks].sort((a, b) => b.task.id - a.task.id);
  const held = view.inbox.kind === "lineage" ? view.inbox.items.length : 0;
  return (
    <div className="flex flex-col gap-16 md:gap-20">
      <VaultHeader view={view} />

      <Section
        id="inbox"
        eyebrow={view.inbox.kind === "lineage" ? `Approval inbox · ${held} waiting` : "Approval inbox"}
        title={
          <>
            Needs <em>you</em>
          </>
        }
      >
        <Inbox inbox={view.inbox} />
      </Section>

      <Section
        id="tasks"
        eyebrow={`${view.tasks.length} task mandates, signed by the owner`}
        title={
          <>
            Task <em>mandates</em>
          </>
        }
      >
        <div className="grid gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {tasks.map((t) => (
            <TaskCard key={t.task.id} row={t} now={now} />
          ))}
        </div>
      </Section>

      <Section
        id="payments"
        eyebrow={`${view.payments.length} payments · newest first`}
        title={
          <>
            Every payment, with its <em>lineage</em>
          </>
        }
        aside={
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-small text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:outline-none"
          >
            Compare the two vaults <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <PaymentsTable payments={view.payments} tasks={view.tasks} marks={marks} />
      </Section>
    </div>
  );
}
