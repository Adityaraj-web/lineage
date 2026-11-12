import { describe, expect, it } from "vitest";
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
  config,
  demoTask,
  fixtureTask0,
  p3Translation,
  p4Alice,
  p5Poisoned,
} from "./test-fixtures";
import { attackerPayments, splitTasks, storyStrip } from "./story";
import { buildVaultView, type VaultView } from "./views";

function view(key: "vault" | "guarded", payments: Payment[]): VaultView {
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

const lineage = (status: Payment["status"] = "AwaitingApproval") =>
  view("vault", [p3Translation(), p4Alice(), p5Poisoned(status)]);

// The guarded vault after two demo runs: task 1 and task 2 each paid all three.
const guardedTwoRuns = () =>
  view("guarded", [
    { ...p3Translation(AGENT_G), id: 0, task_id: 1 },
    { ...p4Alice(AGENT_G), id: 1, task_id: 1 },
    { ...p5Poisoned("Paid", AGENT_G), id: 2, task_id: 1 },
    p3Translation(AGENT_G),
    p4Alice(AGENT_G),
    p5Poisoned("Paid", AGENT_G),
  ]);

describe("storyStrip", () => {
  it("Lineage: read 3 emails, asked for 3 payments, paid 2, held 1 for you", () => {
    const s = storyStrip(lineage(), DEMO_RUN_SNAPSHOT)!;
    expect(s).toMatchObject({ emails: 3, asked: 3, paid: 2, held: 1, rejected: 0, paidAttacker: false });
    expect(s.steps.map((x) => x.text)).toEqual(["Read 3 emails", "asked for 3 payments", "paid 2", "held 1 for you"]);
    expect(s.steps.map((x) => x.tone)).toEqual(["neutral", "neutral", "p1", "p3"]);
    expect(s.sentence).toBe("Read 3 emails, asked for 3 payments, paid 2 and held 1 for you.");
  });

  it("LimitsOnly: paid all 3, including the attacker", () => {
    const s = storyStrip(guardedTwoRuns(), DEMO_RUN_SNAPSHOT)!;
    expect(s).toMatchObject({ emails: 3, asked: 3, paid: 3, held: 0, paidAttacker: true });
    expect(s.steps.map((x) => x.text)).toEqual(["Read 3 emails", "asked for 3 payments", "paid all 3, including the attacker"]);
    expect(s.steps.at(-1)!.tone).toBe("attacker");
    expect(s.sentence).toBe("Read 3 emails, asked for 3 payments and paid all 3, including the attacker.");
  });

  it("follows the live status once the owner rejects the held payment", () => {
    const s = storyStrip(lineage("Rejected"), DEMO_RUN_SNAPSHOT)!;
    expect(s).toMatchObject({ paid: 2, held: 0, rejected: 1 });
    expect(s.steps.at(-1)).toMatchObject({ text: "held 1, rejected by you", tone: "neutral" });
  });

  it("counts only the demo-run task", () => {
    const v = view("vault", [p3Translation(), p4Alice(), p5Poisoned(), { ...p4Alice(), id: 9, task_id: 1 }]);
    expect(storyStrip(v, DEMO_RUN_SNAPSHOT)!.paid).toBe(2);
  });

  it("is null when the demo run did not touch this vault", () => {
    expect(storyStrip(lineage(), { ...DEMO_RUN_SNAPSHOT, vaults: {} })).toBeNull();
  });
});

describe("attackerPayments", () => {
  it("sums Paid payments to the attacker across runs: 98 tUSDC across 2 runs", () => {
    const a = attackerPayments(guardedTwoRuns(), ATTACKER);
    expect(a.total).toBe(98_000_000n);
    expect(a.totalText).toBe("98 tUSDC");
    expect(a.runs).toBe(2);
    expect(a.runsText).toBe("across 2 runs");
    expect(a.payments.map((r) => r.payment.id)).toEqual([5, 2]);
  });

  it("ignores payments that were held, rejected or went elsewhere", () => {
    const a = attackerPayments(lineage(), ATTACKER);
    expect(a.total).toBe(0n);
    expect(a.runs).toBe(0);
    expect(a.payments).toEqual([]);
    expect(attackerPayments(lineage("Rejected"), ATTACKER).total).toBe(0n);
  });

  it("says 'in 1 run' for a single run", () => {
    const a = attackerPayments(view("guarded", [p5Poisoned("Paid", AGENT_G)]), ATTACKER);
    expect(a.runsText).toBe("in 1 run");
  });
});

describe("splitTasks", () => {
  it("shows the latest demo-run task and folds the earlier ones, newest first", () => {
    const { latest, earlier } = splitTasks(lineage());
    expect(latest?.task.id).toBe(2);
    expect(earlier.map((t) => t.task.id)).toEqual([1, 0]);
  });

  it("falls back to the newest task when no task is the demo run", () => {
    const v = { ...lineage(), tasks: lineage().tasks.map((t) => ({ ...t, label: null })) };
    expect(splitTasks(v).latest?.task.id).toBe(2);
  });
});
