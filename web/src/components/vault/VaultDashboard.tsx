"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Mark } from "@/lib/changes";
import type { DemoRun } from "@/lib/config";
import { attackerPayments, splitTasks, storyStrip } from "@/lib/story";
import type { VaultView } from "@/lib/views";
import { Section } from "../live/ScreenState";
import { NeedsYou, Shared } from "../transitions";
import { AttackerPaid } from "./AttackerPaid";
import { Inbox } from "./InboxCard";
import { PaymentsTable } from "./PaymentsTable";
import { TaskCard } from "./TaskCard";
import { VaultHeader } from "./VaultHeader";

export function VaultDashboard({
  view,
  demoRun,
  marks,
  now,
}: {
  view: VaultView;
  demoRun: DemoRun;
  marks?: ReadonlyMap<number, Mark>;
  now: number;
}) {
  const strip = storyStrip(view, demoRun);
  const { latest, earlier } = splitTasks(view);
  const held = view.inbox.kind === "lineage" ? view.inbox.items.length : 0;
  return (
    <div className="flex flex-col gap-24">
      <VaultHeader view={view} strip={strip} />

      {view.inbox.kind === "lineage" ? (
        <Section
          id="inbox"
          title={
            <Shared name="needs-you">
              <span className="inline-block">
                <NeedsYou n={held} />
              </span>
            </Shared>
          }
        >
          <Inbox inbox={view.inbox} />
        </Section>
      ) : (
        <AttackerPaid paid={attackerPayments(view, demoRun.attacker.account)} attacker={demoRun.attacker.account} note={view.inbox.message} />
      )}

      <Section id="tasks" title="Tasks">
        <div className="flex flex-col gap-6">
          {latest && (
            <div className="max-w-[40rem]">
              <TaskCard row={latest} now={now} />
            </div>
          )}
          {earlier.length > 0 && (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full py-1 text-small text-muted-foreground outline-none hover-fine:text-foreground focus-visible:ring-2 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />
                Earlier tasks ({earlier.length})
              </summary>
              <div className="mt-5 grid gap-5 md:grid-cols-2 md:gap-6">
                {earlier.map((t) => (
                  <TaskCard key={t.task.id} row={t} now={now} />
                ))}
              </div>
            </details>
          )}
        </div>
      </Section>

      <Section
        id="payments"
        title="Every payment, with its lineage"
        label="newest first"
        aside={
          <Link
            href="/compare"
            className="press inline-flex h-9 items-center rounded-full border border-white/10 px-4 text-small text-muted-foreground transition-colors duration-150 hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
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
