// Live wiring: the real chain and the synced demo-run.json. Unit tests never import this.
import demoRunJson from "../shared/demo-run.json";
import { chain } from "./chain";
import { AGENT_IDS, VAULT_IDS, type DemoRun } from "./config";
import type { LoadDeps } from "./views";

export const DEMO_RUN = demoRunJson as unknown as DemoRun;

export const liveDeps = (): LoadDeps => ({
  chain: chain(),
  demoRun: DEMO_RUN,
  vaultIds: VAULT_IDS,
  agentIds: AGENT_IDS,
  now: Date.now,
});
