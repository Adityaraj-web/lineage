import { test } from "node:test";
import assert from "node:assert/strict";
import { TOOL_SCHEMAS, mandateFromTask, parseAmount, toRequestArgs, type ToolCall } from "./tools.js";
import { demoTask, names } from "./test-support.js";

const mandate = mandateFromTask(demoTask());
const ctx = { taskId: 7, mandate };
const call = (tool: string, args: Record<string, unknown>): ToolCall => ({ message: "m", tool, args });

function accepted(c: ToolCall, c2 = ctx) {
  const r = toRequestArgs(c, c2);
  if (!r.ok) assert.fail(`rejected: ${r.reason}`);
  return r.value;
}

function rejected(c: ToolCall, reason: RegExp, c2 = ctx) {
  const r = toRequestArgs(c, c2);
  if (r.ok) assert.fail(`accepted: ${JSON.stringify(r.value)}`);
  assert.match(r.reason, reason);
}

test("mandateFromTask: slots in order, labels, resolvers", () => {
  assert.deepEqual(mandate, {
    instruction: demoTask().instruction,
    signedPayees: [{ slot: 0, accountId: names.alice, label: "Alice — logo", maxAmount: "20000000" }],
    resolvers: [names.registry],
  });
});

test("tool schemas: the three tools, with their required arguments", () => {
  assert.deepEqual(
    TOOL_SCHEMAS.map((t) => [t.name, t.parameters.required]),
    [
      ["pay_signed_payee", ["slot", "amount", "memo"]],
      ["pay_registered_service", ["reference", "max_price", "memo"]],
      ["pay_account", ["account_id", "amount", "memo"]],
    ],
  );
});

test("pay_signed_payee → Signed slot", () => {
  assert.deepEqual(accepted(call("pay_signed_payee", { slot: 0, amount: "18", memo: "Invoice A-102" })), {
    task_id: 7,
    payee: { Signed: { slot: 0 } },
    amount: "18000000",
    memo: "Invoice A-102",
  });
});

test("pay_registered_service → Resolved via the task's first pinned resolver, amount = ceiling", () => {
  assert.deepEqual(accepted(call("pay_registered_service", { reference: "translate-hi", max_price: "30", memo: "hi" })), {
    task_id: 7,
    payee: { Resolved: { resolver: names.registry, reference: "translate-hi" } },
    amount: "30000000",
    memo: "hi",
  });
});

test("pay_account → Raw account id", () => {
  assert.deepEqual(accepted(call("pay_account", { account_id: names.vendorPayments, amount: "49", memo: "urgent" })), {
    task_id: 7,
    payee: { Raw: { account_id: names.vendorPayments } },
    amount: "49000000",
    memo: "urgent",
  });
});

test("memo is optional and defaults to empty", () => {
  assert.equal(accepted(call("pay_signed_payee", { slot: 0, amount: "1" })).memo, "");
});

test("memo is cut to 200 UTF-8 bytes on a character boundary (the vault's String::truncate panics mid-character)", () => {
  const memo = "a".repeat(199) + "—tail";
  const out = accepted(call("pay_signed_payee", { slot: 0, amount: "1", memo })).memo;
  assert.equal(out, "a".repeat(199));
  assert.ok(Buffer.byteLength(out) <= 200);
  const exact = "b".repeat(200);
  assert.equal(accepted(call("pay_signed_payee", { slot: 0, amount: "1", memo: exact })).memo, exact);
});

test("amounts: decimal tUSDC strings convert exactly with BigInt", () => {
  const cases: [string, bigint][] = [
    ["18", 18_000_000n],
    ["0.5", 500_000n],
    ["0.000001", 1n],
    ["1.123456", 1_123_456n],
    ["49.000000", 49_000_000n],
    ["123456789012345678901234567890", 123456789012345678901234567890_000000n],
  ];
  for (const [input, expected] of cases) {
    const r = parseAmount(input);
    if (!r.ok) assert.fail(`${input} rejected: ${r.reason}`);
    assert.equal(r.value, expected, input);
  }
});

test("amounts: bad values are rejected with a reason", () => {
  const cases: [unknown, RegExp][] = [
    ["", /empty/],
    ["-1", /negative/],
    ["-0.5", /negative/],
    ["abc", /not a decimal number/],
    ["1e3", /not a decimal number/],
    [" 18", /not a decimal number/],
    [".5", /not a decimal number/],
    ["1.2345678", /more than 6 decimals/],
    [18, /must be a string/],
    [undefined, /must be a string/],
  ];
  for (const [input, reason] of cases) {
    const r = parseAmount(input);
    if (r.ok) assert.fail(`${JSON.stringify(input)} accepted as ${r.value}`);
    assert.match(r.reason, reason, JSON.stringify(input));
  }
  rejected(call("pay_account", { account_id: names.vendorPayments, amount: "1.2345678", memo: "" }), /amount.*more than 6 decimals/);
  rejected(call("pay_registered_service", { reference: "translate-hi", max_price: "-3", memo: "" }), /max_price.*negative/);
});

test("slots: must be a non-negative integer", () => {
  for (const slot of ["0", -1, 1.5, "zero", null, 2 ** 32]) {
    rejected(call("pay_signed_payee", { slot, amount: "1", memo: "" }), /slot/);
  }
});

test("other malformed calls are rejected with a reason", () => {
  rejected(call("transfer_everything", { to: "x.testnet" }), /unknown tool/);
  rejected(call("pay_account", { account_id: "Vendor Payments", amount: "1", memo: "" }), /account id/);
  rejected(call("pay_account", { account_id: "a", amount: "1", memo: "" }), /account id/);
  rejected(call("pay_account", { amount: "1", memo: "" }), /account id/);
  rejected(call("pay_registered_service", { reference: "", max_price: "1", memo: "" }), /reference/);
  rejected(call("pay_signed_payee", { slot: 0, amount: "1", memo: 5 }), /memo/);
  rejected(
    call("pay_registered_service", { reference: "translate-hi", max_price: "1", memo: "" }),
    /no pinned resolver/,
    { taskId: 7, mandate: { ...mandate, resolvers: [] } },
  );
});
