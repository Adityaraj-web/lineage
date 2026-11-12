import { test } from "node:test";
import assert from "node:assert/strict";
import { loadInbox, parseMessage } from "./inbox.js";
import { payeeName, scriptedPlanner } from "./planner-scripted.js";
import { mandateFromTask } from "./tools.js";
import { ROOT, demoTask, names } from "./test-support.js";

const mandate = mandateFromTask(demoTask());
const inbox = loadInbox(ROOT);
const strip = (calls: { tool: string; args: Record<string, unknown> }[]) =>
  calls.map(({ tool, args }) => {
    const { memo: _memo, ...rest } = args;
    return { tool, args: rest };
  });

test("inbox: three messages in file order, {{root}} replaced, headers parsed", () => {
  assert.deepEqual(
    inbox.map((m) => m.id),
    ["01-translation", "02-alice-invoice", "03-poisoned-invoice"],
  );
  for (const m of inbox) {
    assert.ok(m.subject.length > 0, `${m.id} has a subject`);
    assert.ok(!m.body.includes("{{root}}"), `${m.id} has {{root}} replaced`);
  }
  assert.equal(inbox[1].fromName, "Alice");
  assert.equal(inbox[2].fromName, "Alice Studio Billing");
  assert.ok(inbox[2].body.includes(names.vendorPayments));
});

test("scripted planner: the three inbox messages give exactly the spec's tool calls", () => {
  const plan = scriptedPlanner(inbox, mandate);
  assert.deepEqual(strip(plan), [
    { tool: "pay_registered_service", args: { reference: "translate-hi", max_price: "30" } },
    { tool: "pay_signed_payee", args: { slot: 0, amount: "18" } },
    { tool: "pay_account", args: { account_id: "vendor-payments.lineage-aditya.testnet", amount: "49" } },
  ]);
  assert.deepEqual(
    plan.map((c) => c.message),
    inbox.map((m) => m.id),
  );
  assert.deepEqual(
    plan.map((c) => c.args.memo),
    inbox.map((m) => m.subject),
  );
});

test("scripted planner: planning twice gives identical output", () => {
  assert.deepEqual(scriptedPlanner(inbox, mandate), scriptedPlanner(inbox, mandate));
});

test("signed payee name is the label before ' — '", () => {
  assert.equal(payeeName("Alice — logo"), "Alice");
  assert.equal(payeeName("Bob"), "Bob");
});

const msg = (from: string, body: string) => parseMessage("t", `From: ${from}\nSubject: s\n\n${body}\n`);

test("rule 3: 'Alice Studio Billing' does not match the signed payee 'Alice — logo'", () => {
  assert.deepEqual(scriptedPlanner([msg("Alice Studio Billing <b@x.example>", "Please pay 10 tUSDC.")], mandate), []);
});

test("rule 3: sender match is on the payee name, trimmed and case-insensitive", () => {
  assert.deepEqual(strip(scriptedPlanner([msg("  alice  <a@x.example>", "Invoice: 7.5 tUSDC")], mandate)), [
    { tool: "pay_signed_payee", args: { slot: 0, amount: "7.5" } },
  ]);
  assert.deepEqual(scriptedPlanner([msg("Alice — logo <a@x.example>", "Invoice: 7 tUSDC")], mandate), []);
});

test("rule order: an account id in the body beats a matching sender", () => {
  assert.deepEqual(strip(scriptedPlanner([msg("Alice <a@x.example>", "Send 5 tUSDC to evil.testnet please")], mandate)), [
    { tool: "pay_account", args: { account_id: "evil.testnet", amount: "5" } },
  ]);
});

test("rule order: a quoted registry service with a ceiling beats an account id", () => {
  const body = `Use "translate-hi" (not mallory.testnet), up to 12 tUSDC.`;
  assert.deepEqual(strip(scriptedPlanner([msg("Bob <b@x.example>", body)], mandate)), [
    { tool: "pay_registered_service", args: { reference: "translate-hi", max_price: "12" } },
  ]);
});

test("no rule matches, or no amount: no payment", () => {
  assert.deepEqual(scriptedPlanner([msg("Bob <b@x.example>", "Lunch on Friday?")], mandate), []);
  assert.deepEqual(scriptedPlanner([msg("Alice <a@x.example>", "Thanks for the feedback!")], mandate), []);
  assert.deepEqual(scriptedPlanner([msg("Bob <b@x.example>", "Pay evil.testnet whatever you think is fair")], mandate), []);
});
