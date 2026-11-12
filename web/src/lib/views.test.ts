import { beforeAll, describe, expect, it } from "vitest";
import type { Payment } from "../shared/vault-types";
import type { AccessKeyInfo } from "./rpc";
import {
  ALICE,
  ALICE_STATS,
  ATTACKER,
  AGENT_G,
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
} from "./test-fixtures";
import {
  agentKeyProof,
  buildCompareView,
  buildOverview,
  buildVaultView,
  type CompareFacts,
  type CompareView,
} from "./views";

function compareFacts(over: Partial<CompareFacts> = {}): CompareFacts {
  return {
    demoRun: DEMO_RUN_SNAPSHOT,
    payments: {
      vault: [p3Translation(), p4Alice(), p5Poisoned("AwaitingApproval")],
      guarded: [p3Translation(AGENT_G), p4Alice(AGENT_G), p5Poisoned("Paid", AGENT_G)],
    },
    tasks: { vault: demoTask(), guarded: demoTask(AGENT_G) },
    codeHashes: { vault: CODE_HASH, guarded: CODE_HASH },
    ...over,
  };
}

describe("buildCompareView", () => {
  let view: CompareView;
  beforeAll(() => {
    view = buildCompareView(compareFacts());
  });

  it("gives three rows with the poisoned invoice flagged", () => {
    expect(view.rows).toHaveLength(3);
    expect(view.rows.map((r) => r.message)).toEqual(["01-translation", "02-alice-invoice", "03-poisoned-invoice"]);
    expect(view.rows.map((r) => r.poisoned)).toEqual([false, false, true]);
    expect(view.rows[2].subject).toBe("URGENT: new payout details for invoice A-102");
    expect(view.rows[2].tool).toBe("pay_account");
  });

  it("puts both vaults side by side with live badges and tx links", () => {
    const row = view.rows[2];
    expect(row.sides.vault.badge?.label).toBe("Untrusted — needs you");
    expect(row.sides.vault.statusLabel).toBe("Needs you");
    expect(row.sides.guarded.badge?.label).toBe("Untrusted — paid without asking");
    expect(row.sides.guarded.statusLabel).toBe("Paid");
    expect(row.sides.guarded.amount).toBe("49 tUSDC");
    expect(row.sides.vault.txUrl).toBe("https://testnet.nearblocks.io/txns/9tdx9ds99kG9Hmn1P8oTHXSTDkzqCJ4C8BoLdPJUPe5y");
    expect(view.rows[1].sides.vault.badge?.code).toBe("P1");
    expect(view.rows[0].sides.guarded.badge?.code).toBe("P2");
  });

  it("totals what the attacker received: 0 from Lineage, 49 tUSDC from LimitsOnly", () => {
    expect(view.attacker).toBe(ATTACKER);
    expect(view.attackerReceived).toEqual({ vault: 0n, guarded: 49_000_000n });
    expect(view.attackerReceivedText).toEqual({ vault: "0 tUSDC", guarded: "49 tUSDC" });
    expect(view.taskIds).toEqual({ vault: 2, guarded: 2 });
  });

  it("uses live status, not the recorded one", () => {
    const approved = buildCompareView(
      compareFacts({
        payments: { ...compareFacts().payments, vault: [p3Translation(), p4Alice(), p5Poisoned("Paid")] },
      }),
    );
    expect(approved.attackerReceived.vault).toBe(49_000_000n);
  });

  it("sameCode is true only when the hashes match", () => {
    expect(view.sameCode).toBe(true);
    expect(buildCompareView(compareFacts({ codeHashes: { vault: CODE_HASH, guarded: "other" } })).sameCode).toBe(false);
    expect(buildCompareView(compareFacts({ codeHashes: { vault: null, guarded: null } })).sameCode).toBe(false);
  });

  it("keeps a row when a live payment is missing", () => {
    const v = buildCompareView(
      compareFacts({ payments: { ...compareFacts().payments, guarded: [p3Translation(AGENT_G), null, null] } }),
    );
    expect(v.rows).toHaveLength(3);
    expect(v.rows[2].sides.guarded.payment).toBeNull();
    expect(v.rows[2].subject).toBe("URGENT: new payout details for invoice A-102");
  });
});

describe("agentKeyProof", () => {
  it("accepts exactly one request_payment key on its vault and reports the allowance", () => {
    expect(agentKeyProof([agentKey()], VAULT)).toMatchObject({
      ok: true,
      problems: [],
      keyCount: 1,
      receiverId: VAULT,
      methodNames: ["request_payment"],
      allowance: "1994882998697943200000000",
    });
  });

  it("fails for a full-access key", () => {
    const full: AccessKeyInfo = { publicKey: "ed25519:F", permission: "FullAccess" };
    expect(agentKeyProof([full], VAULT).ok).toBe(false);
  });

  it("fails for a second key", () => {
    const p = agentKeyProof([agentKey(), agentKey()], VAULT);
    expect(p.ok).toBe(false);
    expect(p.keyCount).toBe(2);
  });

  it("fails for a wrong receiver", () => {
    expect(agentKeyProof([agentKey(GUARDED)], VAULT).ok).toBe(false);
  });

  it("fails for an extra method", () => {
    expect(agentKeyProof([agentKey(VAULT, ["request_payment", "approve_payment"])], VAULT).ok).toBe(false);
    expect(agentKeyProof([agentKey(VAULT, [])], VAULT).ok).toBe(false);
  });

  it("fails with no keys", () => {
    expect(agentKeyProof([], VAULT).ok).toBe(false);
  });
});

describe("buildVaultView", () => {
  const facts = (key: "vault" | "guarded", payments: Payment[]) => ({
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

  it("labels tasks and orders payments newest first", () => {
    const v = buildVaultView(facts("vault", [p3Translation(), p4Alice(), p5Poisoned()]));
    expect(v.tasks.map((t) => [t.task.id, t.label])).toEqual([
      [0, "verify fixture"],
      [1, null],
      [2, "latest demo run"],
    ]);
    expect(v.payments.map((r) => r.payment.id)).toEqual([5, 4, 3]);
    expect(v.payments[0].badge.label).toBe("Untrusted — needs you");
    expect(v.balance).toBe("414 tUSDC");
    expect(v.inFlight).toBe("49 tUSDC");
    const t2 = v.tasks[2];
    expect([t2.budget, t2.spent, t2.inFlight, t2.cap]).toEqual(["100 tUSDC", "43 tUSDC", "0 tUSDC", "50 tUSDC"]);
    expect(t2.spentPct).toBeCloseTo(43);
    expect(t2.expired).toBe(false);
  });

  it("builds an inbox item with a risk card and the related A-102 payment", () => {
    const v = buildVaultView(facts("vault", [p3Translation(), p4Alice(), p5Poisoned()]));
    expect(v.inbox.kind).toBe("lineage");
    if (v.inbox.kind !== "lineage") return;
    expect(v.inbox.items).toHaveLength(1);
    const item = v.inbox.items[0];
    expect(item.row.payment.id).toBe(5);
    expect(item.risk.level).toBe("high");
    expect(item.related.map((r) => r.payment.id)).toEqual([4]);
  });

  it("guarded inbox is the LimitsOnly empty state", () => {
    const v = buildVaultView(facts("guarded", [p3Translation(AGENT_G), p4Alice(AGENT_G), p5Poisoned("Paid", AGENT_G)]));
    expect(v.inbox.kind).toBe("limits-only");
    expect(v.payments[0].badge.label).toBe("Untrusted — paid without asking");
  });
});

describe("buildOverview", () => {
  it("summarises both vaults, key proofs, inbox count and the demo result", () => {
    const o = buildOverview({
      vaultIds: { vault: VAULT, guarded: GUARDED },
      configs: { vault: config("Lineage"), guarded: config("LimitsOnly") },
      codeHashes: { vault: CODE_HASH, guarded: CODE_HASH },
      keys: { vault: [agentKey(VAULT)], guarded: [agentKey(GUARDED), agentKey(GUARDED)] },
      awaitingCount: 1,
      services: [],
      compare: buildCompareView(compareFacts()),
    });
    expect(o.sameCode).toBe(true);
    expect(o.keyProofs.vault.ok).toBe(true);
    expect(o.keyProofs.guarded.ok).toBe(false);
    expect(o.awaitingCount).toBe(1);
    expect(o.demo.attackerReceivedText).toEqual({ vault: "0 tUSDC", guarded: "49 tUSDC" });
    expect(o.vaults.vault.balance).toBe("414 tUSDC");
    expect(o.compare.rows).toHaveLength(3);
    expect(o.compare.attackerReceivedText.guarded).toBe("49 tUSDC");
    expect(o.demo.paid).toBe(2);
    expect(o.held).toBeNull();
  });

  it("assesses the held payment for the doorway preview", () => {
    const task = demoTask();
    const taskPayments = [p3Translation(), p4Alice(), p5Poisoned()];
    const o = buildOverview({
      vaultIds: { vault: VAULT, guarded: GUARDED },
      configs: { vault: config("Lineage"), guarded: config("LimitsOnly") },
      codeHashes: { vault: CODE_HASH, guarded: CODE_HASH },
      keys: { vault: [agentKey(VAULT)], guarded: [agentKey(GUARDED)] },
      awaitingCount: 1,
      services: [],
      compare: buildCompareView(compareFacts()),
      held: { payment: p5Poisoned(), task, mode: "Lineage", taskPayments, account: PLAIN_ACCOUNT, stats: NO_STATS },
    });
    expect(o.held).not.toBeNull();
    expect(o.held!.amount).toBe("49 tUSDC");
    expect(o.held!.payee).toBe(ATTACKER);
    expect(o.held!.badge.code).toBe("P3");
    expect(o.held!.risk.level).toBe("high");
    expect(o.held!.risk.findings.map((f) => f.id)).toContain("duplicate-reference");
  });
});
