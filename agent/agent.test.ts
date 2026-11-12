import { test } from "node:test";
import assert from "node:assert/strict";
import { runPlan, type Execute } from "./agent.js";
import { mandateFromTask, type RequestArgs, type ToolCall } from "./tools.js";
import { demoTask, names, payment } from "./test-support.js";

const mandate = mandateFromTask(demoTask());

const plan: ToolCall[] = [
  { message: "a", tool: "pay_account", args: { account_id: names.vendorPayments, amount: "1.2345678", memo: "a" } },
  { message: "b", tool: "pay_signed_payee", args: { slot: "zero", amount: "1", memo: "b" } },
  { message: "c", tool: "pay_account", args: { account_id: names.vendorPayments, amount: "49", memo: "c" } },
  { message: "d", tool: "pay_signed_payee", args: { slot: 0, amount: "18", memo: "d" } },
];

const expectedSent: RequestArgs[] = [
  { task_id: 3, payee: { Raw: { account_id: names.vendorPayments } }, amount: "49000000", memo: "c" },
  { task_id: 3, payee: { Signed: { slot: 0 } }, amount: "18000000", memo: "d" },
];

function fakeExecutor(failOn = -1): { execute: Execute; sent: RequestArgs[] } {
  const sent: RequestArgs[] = [];
  const execute: Execute = async (args) => {
    const i = sent.push(args) - 1;
    if (i === failOn) throw new Error("RPC timeout");
    return {
      payment: payment({ id: 100 + i, status: "Paid", provenance: "Untrusted", amount: args.amount }),
      txHash: `tx${i}`,
      events: [],
    };
  };
  return { execute, sent };
}

test("malformed calls are reported as rejected and skipped; the rest of the plan still runs, in order", async () => {
  const { execute, sent } = fakeExecutor();
  const steps = await runPlan(plan, { mandate, taskId: 3, execute });

  assert.deepEqual(
    steps.map((s) => [s.call.message, s.outcome.kind]),
    [
      ["a", "rejected"],
      ["b", "rejected"],
      ["c", "sent"],
      ["d", "sent"],
    ],
  );
  assert.deepEqual(sent, expectedSent);

  const [a, b, c] = steps.map((s) => s.outcome);
  assert.ok(a.kind === "rejected" && /more than 6 decimals/.test(a.reason), JSON.stringify(a));
  assert.ok(b.kind === "rejected" && /slot/.test(b.reason), JSON.stringify(b));
  assert.ok(c.kind === "sent" && c.payment.id === 100 && c.txHash === "tx0", JSON.stringify(c));
});

test("an executor error is recorded for that call and the next call still runs", async () => {
  const { execute, sent } = fakeExecutor(0);
  const steps = await runPlan(plan, { mandate, taskId: 3, execute });

  assert.deepEqual(
    steps.map((s) => s.outcome.kind),
    ["rejected", "rejected", "error", "sent"],
  );
  assert.deepEqual(sent, expectedSent);
  const err = steps[2].outcome;
  assert.ok(err.kind === "error" && /RPC timeout/.test(err.message), JSON.stringify(err));
});

test("an empty plan sends nothing", async () => {
  const { execute, sent } = fakeExecutor();
  assert.deepEqual(await runPlan([], { mandate, taskId: 3, execute }), []);
  assert.deepEqual(sent, []);
});
