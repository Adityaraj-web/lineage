"use client";

import Link from "next/link";
import type { Mark } from "@/lib/changes";
import type { VaultView } from "@/lib/views";
import { Section } from "../live/ScreenState";
import { needsYouText, Shared } from "../transitions";
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
        title={
          view.inbox.kind === "lineage" ? (
            <Shared name="needs-you">
              <span className="inline-block">{needsYouText(held)}</span>
            </Shared>
          ) : (
            "Approval inbox"
          )
        }
      >
        <Inbox inbox={view.inbox} />
      </Section>

      <Section
        id="tasks"
        label={`${view.tasks.length} task mandates, signed by the owner`}
        title={
          <>
            Task mandates
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
        label={`${view.payments.length} payments · newest first`}
        title={
          <>
            Every payment, with its lineage
          </>
        }
        aside={
          <Link
            href="/compare"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-small text-muted-foreground transition-colors hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
          >
            Compare the two vaults
          </Link>
        }
      >
        <PaymentsTable payments={view.payments} tasks={view.tasks} marks={marks} />
      </Section>
    </div>
  );
}
