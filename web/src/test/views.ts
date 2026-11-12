// View models for render tests, built by the real build* functions from the unit-test fixtures.
import type { Payment } from "@/shared/vault-types";
import {
  AGENT_G,
  ALICE,
  ALICE_STATS,
  ATTACKER,
  CODE_HASH,
  DEMO_RUN_SNAPSHOT,
  GUARDED,
  NO_STATS,
  NOW,
  PLAIN_ACCOUNT,
  VAULT,
  agentKey,
  config,
  demoTask,
  fixtureTask0,
  p3Translation,
  p4Alice,
  p5Poisoned,
} from "@/lib/test-fixtures";
import {
  buildCompareView,
  buildOverview,
  buildVaultView,
  type CompareFacts,
  type CompareView,
  type Overview,
  type OverviewFacts,
  type VaultView,
} from "@/lib/views";

export const demoPayments = (key: "vault" | "guarded"): Payment[] =>
  key === "vault"
    ? [p3Translation(), p4Alice(), p5Poisoned()]
    : [p3Translation(AGENT_G), p4Alice(AGENT_G), p5Poisoned("Paid", AGENT_G)];

export function vaultView(key: "vault" | "guarded", payments: Payment[] = demoPayments(key)): VaultView {
  return buildVaultView({
    key,
    vaultId: key === "vault" ? VAULT : GUARDED,
    config: config(key === "vault" ? "Lineage" : "LimitsOnly"),
    codeHash: CODE_HASH,
    tasks: [fixtureTask0(), demoTask(undefined, { id: 1 }), demoTask()],
    payments,
    payees: {
      [ATTACKER]: { account: PLAIN_ACCOUNT, stats: NO_STATS },
      [ALICE]: { account: PLAIN_ACCOUNT, stats: ALICE_STATS },
    },
    demoTaskId: 2,
    now: NOW,
  });
}

export function compareView(over: Partial<CompareFacts> = {}): CompareView {
  return buildCompareView({
    demoRun: DEMO_RUN_SNAPSHOT,
    payments: { vault: demoPayments("vault"), guarded: demoPayments("guarded") },
    tasks: { vault: demoTask(), guarded: demoTask(AGENT_G) },
    codeHashes: { vault: CODE_HASH, guarded: CODE_HASH },
    ...over,
  });
}

export function overview(over: Partial<OverviewFacts> = {}): Overview {
  return buildOverview({
    vaultIds: { vault: VAULT, guarded: GUARDED },
    configs: { vault: config("Lineage"), guarded: config("LimitsOnly") },
    codeHashes: { vault: CODE_HASH, guarded: CODE_HASH },
    keys: { vault: [agentKey(VAULT)], guarded: [agentKey(GUARDED)] },
    awaitingCount: 1,
    services: [
      {
        id: "translate-hi",
        payee: `hindi-translator.lineage-aditya.testnet`,
        price: "25000000",
        description: "Hindi translation of a landing page",
        status: "Verified",
        updated_at_ms: NOW - 86_400_000,
      },
    ],
    compare: compareView(),
    ...over,
  });
}
