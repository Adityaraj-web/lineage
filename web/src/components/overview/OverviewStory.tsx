"use client";

import type { Email } from "@/lib/emails";
import type { Overview } from "@/lib/views";
import { Doorways } from "./Doorways";
import { EmailsScene } from "./EmailsScene";
import { ProofScene } from "./ProofScene";
import { TwoVaultsScene } from "./TwoVaultsScene";

// Scenes 2 to 5. The hero (scene 1) renders before data arrives, in page.tsx.
export function OverviewStory({ view, emails }: { view: Overview; emails: Record<string, Email> }) {
  return (
    <>
      <EmailsScene rows={view.compare.rows} emails={emails} services={view.services} />
      <TwoVaultsScene view={view.compare} emails={emails} />
      <ProofScene view={view} />
      <Doorways view={view} />
    </>
  );
}
