"use client";

import Link from "next/link";
import type { Mark } from "@/lib/changes";
import type { DemoRun } from "@/lib/config";
import { attackerPayments, storyStrip } from "@/lib/story";
import type { VaultView } from "@/lib/views";
import type { Role } from "@/lib/wallet";
import { Section } from "../live/ScreenState";
import { NeedsYou, Shared } from "../transitions";
import type { OwnerAction, OwnerControls } from "../wallet/useOwnerAction";
import { AttackerPaid } from "./AttackerPaid";
import { Inbox } from "./InboxCard";
import { LastAction } from "./LastAction";
import { PaymentsTable } from "./PaymentsTable";
import { TasksSection } from "./TasksSection";
import { VaultHeader } from "./VaultHeader";

export function VaultDashboard({
  view,
  demoRun,
  marks,
  now,
  wallet,
}: {
  view: VaultView;
  demoRun: DemoRun;
  marks?: ReadonlyMap<number, Mark>;
  now: number;
  wallet?: { role: Role; accountId: string | null; action: OwnerAction };
}) {
  // The single gate: controls exist only when the connected account is this vault's owner.
  const owner: OwnerControls | undefined = wallet?.role === "owner" ? { vault: view.vaultId, action: wallet.action } : undefined;
  const viewer = wallet?.role === "viewer" ? wallet.accountId : null;
  const strip = storyStrip(view, demoRun);
  const held = view.inbox.kind === "lineage" ? view.inbox.items.length : 0;
  return (
    <div className="flex flex-col gap-24">
      <VaultHeader view={view} strip={strip} owner={owner} viewer={viewer} />

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
          <div className="flex flex-col gap-5">
            {owner && <LastAction action={owner.action} inbox={view.inbox} payments={view.payments} />}
            <Inbox inbox={view.inbox} owner={owner} />
          </div>
        </Section>
      ) : (
        <AttackerPaid paid={attackerPayments(view, demoRun.attacker.account)} attacker={demoRun.attacker.account} note={view.inbox.message} />
      )}

      <TasksSection view={view} now={now} owner={owner} />

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
