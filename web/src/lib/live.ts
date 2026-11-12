// Live wiring: the real chain and the synced demo-run.json. Unit tests never import this.
import demoRunJson from "../shared/demo-run.json";
import inboxJson from "../shared/inbox.json";
import { chain } from "./chain";
import { AGENT_IDS, DEPLOYMENT, VAULT_IDS, type DemoRun } from "./config";
import { parseEmail, type Email } from "./emails";
import type { LoadDeps } from "./views";

export const DEMO_RUN = demoRunJson as unknown as DemoRun;

// Keyed by message id ("03-poisoned-invoice"), the same ids demo-run.json uses.
export const DEMO_EMAILS: Record<string, Email> = Object.fromEntries(
  (inboxJson as { id: string; raw: string }[]).map((e) => [e.id, parseEmail(e.id, e.raw, DEPLOYMENT.root)]),
);

export const liveDeps = (): LoadDeps => ({
  chain: chain(),
  demoRun: DEMO_RUN,
  vaultIds: VAULT_IDS,
  agentIds: AGENT_IDS,
  now: Date.now,
});
