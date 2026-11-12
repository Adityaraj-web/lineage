import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAcceptance, showReason, type PaymentRecord, type RunRecord } from "./run.js";
import type { PaymentStatus } from "./vault-types.js";
import { names } from "./test-support.js";

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
