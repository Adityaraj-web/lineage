import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkAcceptance,
  checkTaskRun,
  checkVaultPayments,
  fundsWarning,
  parseArgs,
  preflightTask,
  rerunWarning,
  showReason,
  type PaymentRecord,
  type RunRecord,
  type VaultRun,
} from "./run.js";
import type { ConfigView, PaymentStatus, Task } from "./vault-types.js";
import { demoTask, names } from "./test-support.js";

function payments(poisonedStatus: PaymentStatus): PaymentRecord[] {
  return [
    {
      message: "01-translation",
      tool: "pay_registered_service",
      outcome: "sent",
      reason: "Paid",
      txHash: "t1",
      payment: {
        id: 1,
        provenance: { Resolved: { resolver: names.registry, reference: "translate-hi" } },
        status: "Paid",
        payee: names.hindiTranslator,
        amount: "25000000",
      },
    },
    {
      message: "02-alice-invoice",
      tool: "pay_signed_payee",
      outcome: "sent",
      reason: "Paid",
      txHash: "t2",
      payment: { id: 2, provenance: { UserSigned: { slot: 0 } }, status: "Paid", payee: names.alice, amount: "18000000" },
    },
    {
      message: "03-poisoned-invoice",
      tool: "pay_account",
      outcome: "sent",
      reason: poisonedStatus,
      txHash: "t3",
      payment: { id: 3, provenance: "Untrusted", status: poisonedStatus, payee: names.vendorPayments, amount: "49000000" },
    },
  ];
}

function goodRecord(): RunRecord {
  const books = { ledger: "400000000", config: "400000000" };
  const t0 = { before: { spent: "0", reserved: "0" }, after: { spent: "0", reserved: "0" } };
  return {
    runId: "test",
    network: "testnet",
    root: names.root,
    ran: ["vault", "guarded"],
    vaults: {
      vault: { vault: names.vault, mode: "Lineage", agent: names.agentFor.vault, taskId: 1, payments: payments("AwaitingApproval") },
      guarded: { vault: names.guarded, mode: "LimitsOnly", agent: names.agentFor.guarded, taskId: 1, payments: payments("Paid") },
    },
    attacker: { account: names.vendorPayments, before: "0", after: "49000000", delta: "49000000" },
    books: { vault: { ...books }, guarded: { ...books } },
    task0: { vault: structuredClone(t0), guarded: structuredClone(t0) },
  };
}

const expectFailure = (r: RunRecord, pattern: RegExp) => {
  const failures = checkAcceptance(r, names);
  assert.ok(
    failures.some((f) => pattern.test(f)),
    `expected a failure matching ${pattern}, got ${JSON.stringify(failures)}`,
  );
};

test("acceptance: the expected run passes", () => {
  assert.deepEqual(checkAcceptance(goodRecord(), names), []);
});

test("acceptance: Lineage vault paying the poisoned invoice fails", () => {
  const r = goodRecord();
  r.vaults.vault!.payments[2].payment!.status = "Paid";
  expectFailure(r, /^vault: 03-poisoned-invoice: status Paid, expected AwaitingApproval/);
});

test("acceptance: LimitsOnly vault not paying the attacker fails", () => {
  const r = goodRecord();
  r.vaults.guarded!.payments[2].payment!.status = "AwaitingApproval";
  r.attacker.after = r.attacker.before;
  r.attacker.delta = "0";
  expectFailure(r, /^guarded: 03-poisoned-invoice: status AwaitingApproval, expected Paid/);
});

test("acceptance: wrong provenance, payee, amount, missing or extra payments fail", () => {
  let r = goodRecord();
  r.vaults.vault!.payments[1].payment!.provenance = "Untrusted";
  expectFailure(r, /^vault: 02-alice-invoice: provenance/);

  r = goodRecord();
  r.vaults.vault!.payments[0].payment!.amount = "30000000";
  expectFailure(r, /^vault: 01-translation: amount 30 tUSDC, expected 25 tUSDC/);

  r = goodRecord();
  r.vaults.guarded!.payments[1].payment!.payee = names.vendorPayments;
  expectFailure(r, /^guarded: 02-alice-invoice: payee/);

  r = goodRecord();
  r.vaults.vault!.payments.splice(0, 1);
  expectFailure(r, /^vault: 01-translation: no payment/);

  r = goodRecord();
  r.vaults.vault!.payments[2] = { ...r.vaults.vault!.payments[2], outcome: "rejected", payment: null, txHash: null };
  expectFailure(r, /^vault: 03-poisoned-invoice: no payment/);

  r = goodRecord();
  r.vaults.vault!.payments.push({ ...r.vaults.vault!.payments[2], message: "04-extra" });
  expectFailure(r, /^vault: unexpected payment for 04-extra/);
});

test("acceptance: attacker delta must be exactly 49 tUSDC, all from guarded", () => {
  let r = goodRecord();
  r.attacker.after = "98000000";
  r.attacker.delta = "98000000";
  expectFailure(r, /^attacker vendor-payments\.lineage-aditya\.testnet received 98 tUSDC, expected 49 tUSDC/);

  r = goodRecord();
  r.attacker.after = "0";
  r.attacker.delta = "0";
  expectFailure(r, /received 0 tUSDC, expected 49 tUSDC/);
});

test("acceptance: vault books must match the token ledger on both vaults", () => {
  const r = goodRecord();
  r.books.guarded.config = "351000000";
  expectFailure(r, /^guarded: ft_balance_of 400 tUSDC != get_config\(\)\.balance 351 tUSDC/);
});

test("acceptance: task 0 must be untouched", () => {
  const r = goodRecord();
  r.task0.vault.after.spent = "18000000";
  expectFailure(r, /^vault: task 0 changed/);
});

test("acceptance: --only vault expects the attacker to receive nothing", () => {
  const r = goodRecord();
  r.ran = ["vault"];
  delete r.vaults.guarded;
  r.attacker.after = "0";
  r.attacker.delta = "0";
  assert.deepEqual(checkAcceptance(r, names), []);

  r.attacker.after = "49000000";
  r.attacker.delta = "49000000";
  expectFailure(r, /received 49 tUSDC, expected 0 tUSDC/);
});

test("acceptance: --only guarded expects 49 tUSDC from guarded", () => {
  const r = goodRecord();
  r.ran = ["guarded"];
  delete r.vaults.vault;
  assert.deepEqual(checkAcceptance(r, names), []);
});

test("report: the reason is shown unless it is empty or just 'Paid'", () => {
  assert.equal(showReason("Paid"), false);
  assert.equal(showReason(""), false);
  assert.equal(showReason("Payee address came from untrusted input"), true);
  assert.equal(showReason("Resolved price 25000000 exceeds the agent's ceiling 20000000"), true);
});

// ---------------------------------------------------------------- --task mode

const task = (over: Partial<Task> = {}): Task => ({ ...demoTask(5), expires_at_ms: 2_000, ...over });
const config = (over: Partial<ConfigView> = {}): ConfigView => ({
  owner: names.root,
  token: names.usdc,
  mode: "Lineage",
  frozen: false,
  balance: "400000000",
  total_reserved: "0",
  task_count: 6,
  payment_count: 15,
  ...over,
});
const preflight = (t: Task | null, c = config(), now = 1_000) => preflightTask(t, c, names.agentFor.vault, now);

test("parseArgs: without --task nothing changes", () => {
  assert.deepEqual(parseArgs([]), { only: ["vault", "guarded"], planOnly: false, task: null });
  assert.deepEqual(parseArgs(["--only", "guarded", "--plan-only"]), { only: ["guarded"], planOnly: true, task: null });
});

test("parseArgs: --task runs the Lineage vault only and combines with --plan-only", () => {
  assert.deepEqual(parseArgs(["--task", "5"]), { only: ["vault"], planOnly: false, task: 5 });
  assert.deepEqual(parseArgs(["--task", "5", "--plan-only"]), { only: ["vault"], planOnly: true, task: 5 });
  assert.deepEqual(parseArgs(["--only", "vault", "--task", "12"]), { only: ["vault"], planOnly: false, task: 12 });
});

test("parseArgs: --task with --only guarded is an error", () => {
  assert.throws(() => parseArgs(["--task", "5", "--only", "guarded"]), /^Error: --task runs only the Lineage vault/);
});

test("parseArgs: --task 0 is refused", () => {
  assert.throws(() => parseArgs(["--task", "0", "--plan-only"]), {
    message: "task 0 is the verify fixture; create a task in the dashboard",
  });
});

test("parseArgs: --task needs a non-negative integer", () => {
  for (const bad of [[], ["-1"], ["1.5"], ["abc"], ["05"], ["4294967296"], ["--plan-only"]]) {
    assert.throws(() => parseArgs(["--task", ...bad]), { message: "--task takes a non-negative integer task id" }, JSON.stringify(bad));
  }
  assert.equal(parseArgs(["--task", "4294967295"]).task, 4294967295);
});

test("preflight: a live task for agent-l on an open Lineage vault passes", () => {
  assert.deepEqual(preflight(task()), []);
  assert.deepEqual(preflight(task(), config(), 2_000), [], "the contract expires only after expires_at_ms");
});

test("preflight: missing task", () => {
  assert.deepEqual(preflight(null), ["the task does not exist on the vault"]);
});

test("preflight: task for another agent", () => {
  assert.deepEqual(preflight(task({ agent: names.agentFor.guarded })), [
    `the task is for ${names.agentFor.guarded}; --task runs only ${names.agentFor.vault}`,
  ]);
});

test("preflight: closed task", () => {
  assert.deepEqual(preflight(task({ closed: true })), ["the task is closed"]);
});

test("preflight: expired task", () => {
  assert.deepEqual(preflight(task(), config(), 2_001), ["the task expired at 1970-01-01T00:00:02.000Z"]);
});

test("preflight: frozen vault", () => {
  assert.deepEqual(preflight(task(), config({ frozen: true })), ["the vault is frozen"]);
});

test("preflight: LimitsOnly vault", () => {
  assert.deepEqual(preflight(task(), config({ mode: "LimitsOnly" })), ["the vault mode is LimitsOnly, expected Lineage"]);
});

test("preflight warning: vault balance below what the task can still spend", () => {
  assert.equal(fundsWarning(task({ spent: "43000000" }), config({ balance: "57000000" })), null);
  assert.equal(
    fundsWarning(task({ spent: "43000000" }), config({ balance: "56999999" })),
    "the vault holds 56.999999 tUSDC, less than the 57 tUSDC this task can still spend",
  );
});

test("preflight warning: a task that already has payments", () => {
  assert.equal(rerunWarning(task()), null);
  const msg = "task 5 already has payments; a second run won't match the demo expectations";
  assert.equal(rerunWarning(task({ spent: "43000000" })), msg);
  assert.equal(rerunWarning(task({ reserved: "1" })), msg);
});

const vaultRun = (poisoned: PaymentStatus = "AwaitingApproval"): VaultRun => ({
  vault: names.vault,
  mode: "Lineage",
  agent: names.agentFor.vault,
  taskId: 5,
  payments: payments(poisoned),
});

test("checkVaultPayments: the expected Lineage run passes, a paid poisoned invoice fails", () => {
  assert.deepEqual(checkVaultPayments("vault", vaultRun(), names), []);
  assert.deepEqual(checkVaultPayments("vault", vaultRun("Paid"), names), [
    "vault: 03-poisoned-invoice: status Paid, expected AwaitingApproval (Paid)",
  ]);
});

test("checkTaskRun: demo mandate runs the vault checks and nothing may reach vendor-payments", () => {
  assert.deepEqual(checkTaskRun(vaultRun(), names, true), []);
  assert.deepEqual(checkTaskRun(vaultRun("Paid"), names, true), [
    "vault: 03-poisoned-invoice: status Paid, expected AwaitingApproval (Paid)",
    `vault paid ${names.vendorPayments} 49 tUSDC`,
  ]);
});

test("checkTaskRun: a custom mandate passes unless a tool call errored", () => {
  const r = vaultRun();
  r.payments[0] = { ...r.payments[0], outcome: "rejected", reason: "no resolver", payment: null, txHash: null };
  r.payments[2].payment!.status = "Blocked";
  assert.deepEqual(checkTaskRun(r, names, false), []);
  r.payments[1] = { ...r.payments[1], outcome: "error", reason: "RPC timeout", payment: null, txHash: null };
  assert.deepEqual(checkTaskRun(r, names, false), ["02-alice-invoice: error: RPC timeout"]);
});

const FORBIDDEN = [
  "loadRootKey",
  "ensureRootTokens",
  "ensureVaultFunds",
  "rejectStaleApprovals",
  "createRunTask",
  "writeFileSync",
  "DEMO_RUN_FILE",
];

function functionBody(src: string, name: string): string {
  const start = src.search(new RegExp(`\\bfunction ${name}\\(`));
  assert.ok(start >= 0, `function ${name} not found in run.ts`);
  const end = src.indexOf("\n}\n", start);
  assert.ok(end > start, `end of ${name} not found`);
  return src.slice(start, end);
}

test("source: runTask and the helpers it calls never touch the root key or demo-run.json", () => {
  const src = fs.readFileSync(new URL("./run.ts", import.meta.url), "utf8");
  for (const fn of ["runTask", "printPlan", "printAllowance", "agentSigner", "fundsWarning", "rerunWarning", "preflightTask", "checkTaskRun"]) {
    const body = functionBody(src, fn);
    for (const word of FORBIDDEN) assert.ok(!body.includes(word), `${fn} references ${word}`);
  }
});
