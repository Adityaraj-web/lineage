import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Account, KeyPair, KeyPairSigner, type KeyPairString, type Provider } from "near-api-js";
import { REPO_ROOT } from "../scripts/lib/env.js";
import { DEFAULT_DEPLOYMENT_FILE, DEMO, VAULTS, namesFor, readDeployment, type VaultKey } from "../scripts/lib/deployment.js";
import { step } from "../scripts/lib/log.js";
import { errorMessage, explorerTx, fmtNear, fmtUsdc, makeProvider, rpcUrls, usdc, view } from "../scripts/lib/near.js";
import { loadRootKey } from "../scripts/lib/root-key.js";
import { runPlan, type Step } from "./agent.js";
import { makeExecutor } from "./executor.js";
import { loadInbox, type Message } from "./inbox.js";
import { createRunTask, ensureRootTokens, ensureVaultFunds, rejectStaleApprovals, sameMandate } from "./owner.js";
import { scriptedPlanner } from "./planner-scripted.js";
import { mandateFromTask, type ToolCall } from "./tools.js";
import type { ConfigView, PaymentStatus, Provenance, Task } from "./vault-types.js";

type Names = ReturnType<typeof namesFor>;

export interface PaymentRecord {
  message: string;
  tool: string;
  outcome: "sent" | "rejected" | "error";
  reason: string;
  txHash: string | null;
  payment: {
    id: number;
    provenance: Provenance;
    status: PaymentStatus;
    payee: string | null;
    amount: string;
  } | null;
}

export interface VaultRun {
  vault: string;
  mode: string;
  agent: string;
  taskId: number;
  payments: PaymentRecord[];
}

interface TaskTotals {
  spent: string;
  reserved: string;
}

export interface RunRecord {
  runId: string;
  network: string;
  root: string;
  ran: VaultKey[];
  vaults: Partial<Record<VaultKey, VaultRun>>;
  attacker: { account: string; before: string; after: string; delta: string };
  books: Record<VaultKey, { ledger: string; config: string }>;
  task0: Record<VaultKey, { before: TaskTotals; after: TaskTotals }>;
  acceptance?: { passed: boolean; failures: string[] };
}

interface Expected {
  message: string;
  status: PaymentStatus;
  provenance: Provenance;
  payee: string;
  amount: bigint;
}

export const POISONED = "03-poisoned-invoice";
export const ATTACKER_AMOUNT = usdc(49);

export function expectedPayments(v: VaultKey, n: Names): Expected[] {
  return [
    {
      message: "01-translation",
      status: "Paid",
      provenance: { Resolved: { resolver: n.registry, reference: "translate-hi" } },
      payee: n.hindiTranslator,
      amount: usdc(25),
    },
    {
      message: "02-alice-invoice",
      status: "Paid",
      provenance: { UserSigned: { slot: 0 } },
      payee: n.alice,
      amount: usdc(18),
    },
    {
      message: POISONED,
      status: v === "vault" ? "AwaitingApproval" : "Paid",
      provenance: "Untrusted",
      payee: n.vendorPayments,
      amount: ATTACKER_AMOUNT,
    },
  ];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function checkAcceptance(r: RunRecord, n: Names): string[] {
  const failures: string[] = [];

  for (const v of r.ran) {
    const run = r.vaults[v];
    if (!run) {
      failures.push(`${v}: no run recorded`);
      continue;
    }
    const expected = expectedPayments(v, n);
    const sent = run.payments.filter((p) => p.outcome === "sent" && p.payment);
    for (const p of sent) {
      if (!expected.some((e) => e.message === p.message)) failures.push(`${v}: unexpected payment for ${p.message}`);
    }
    for (const e of expected) {
      const matches = sent.filter((p) => p.message === e.message);
      if (matches.length !== 1) {
        const other = run.payments.find((p) => p.message === e.message);
        const why = matches.length > 1 ? `${matches.length} payments` : other ? `${other.outcome}: ${other.reason}` : "not planned";
        failures.push(`${v}: ${e.message}: no payment (${why})`);
        continue;
      }
      const p = matches[0].payment!;
      const at = `${v}: ${e.message}`;
      if (p.status !== e.status) failures.push(`${at}: status ${p.status}, expected ${e.status} (${matches[0].reason})`);
      if (!same(p.provenance, e.provenance)) {
        failures.push(`${at}: provenance ${JSON.stringify(p.provenance)}, expected ${JSON.stringify(e.provenance)}`);
      }
      if (p.payee !== e.payee) failures.push(`${at}: payee ${p.payee}, expected ${e.payee}`);
      if (BigInt(p.amount) !== e.amount) failures.push(`${at}: amount ${fmtUsdc(p.amount)}, expected ${fmtUsdc(e.amount)}`);
    }
  }

  const delta = BigInt(r.attacker.delta);
  const expectedDelta = r.ran.includes("guarded") ? ATTACKER_AMOUNT : 0n;
  if (delta !== expectedDelta || BigInt(r.attacker.after) - BigInt(r.attacker.before) !== delta) {
    failures.push(`attacker ${r.attacker.account} received ${fmtUsdc(delta)}, expected ${fmtUsdc(expectedDelta)}`);
  }
  const paidToAttacker = (v: VaultKey) =>
    (r.vaults[v]?.payments ?? [])
      .filter((p) => p.payment?.status === "Paid" && p.payment.payee === r.attacker.account)
      .reduce((s, p) => s + BigInt(p.payment!.amount), 0n);
  if (paidToAttacker("vault") !== 0n) failures.push(`vault paid the attacker ${fmtUsdc(paidToAttacker("vault"))}`);
  if (paidToAttacker("guarded") !== delta) {
    failures.push(`attacker received ${fmtUsdc(delta)} but guarded paid it ${fmtUsdc(paidToAttacker("guarded"))}`);
  }

  for (const v of VAULTS) {
    const b = r.books[v];
    if (BigInt(b.ledger) !== BigInt(b.config)) {
      failures.push(`${v}: ft_balance_of ${fmtUsdc(b.ledger)} != get_config().balance ${fmtUsdc(b.config)}`);
    }
    const t = r.task0[v];
    if (!same(t.before, t.after)) failures.push(`${v}: task 0 changed: ${JSON.stringify(t.before)} → ${JSON.stringify(t.after)}`);
  }

  return failures;
}

// ---------------------------------------------------------------- orchestrator

export const DEMO_RUN_FILE = path.join(REPO_ROOT, "deployments", "demo-run.json");
const AGENT_ENV: Record<VaultKey, string> = { vault: "AGENT_L_KEY", guarded: "AGENT_G_KEY" };
const VAULT_TITLE: Record<VaultKey, string> = { vault: "Lineage vault", guarded: "LimitsOnly vault" };

class RunError extends Error {}

function parseArgs(argv: string[]): { only: VaultKey[]; planOnly: boolean } {
  const planOnly = argv.includes("--plan-only");
  const i = argv.indexOf("--only");
  if (i < 0) return { only: [...VAULTS], planOnly };
  const v = argv[i + 1];
  if (v !== "vault" && v !== "guarded") throw new RunError("--only takes vault or guarded");
  return { only: [v], planOnly };
}

export function provenanceLabel(p: Provenance): string {
  if (p === "Untrusted") return "P3 untrusted";
  if ("UserSigned" in p) return `P1 signed (slot ${p.UserSigned.slot})`;
  return `P2 resolved (${p.Resolved.reference})`;
}

const describeCall = (c: ToolCall) => `${c.tool}(${JSON.stringify({ ...c.args, memo: undefined })})`;

function agentSigner(v: VaultKey, expectedPublicKey: string): KeyPairSigner {
  const key = process.env[AGENT_ENV[v]];
  if (!key) throw new RunError(`${AGENT_ENV[v]} is not set (.env.local is written by npm run deploy)`);
  const pk = KeyPair.fromString(key as KeyPairString).getPublicKey().toString();
  if (pk !== expectedPublicKey) throw new RunError(`${AGENT_ENV[v]} is ${pk}, deployment expects ${expectedPublicKey}`);
  return KeyPairSigner.fromSecretKey(key as KeyPairString);
}

async function allowance(provider: Provider, accountId: string, publicKey: string): Promise<bigint | null> {
  const ak = await provider.viewAccessKey({ accountId, publicKey });
  const p = ak.permission;
  if (typeof p === "object" && "FunctionCall" in p && p.FunctionCall.allowance != null) return BigInt(p.FunctionCall.allowance);
  return null;
}

const totals = (t: Task) => ({ spent: t.spent, reserved: t.reserved });

function toRecord(steps: Step[]): PaymentRecord[] {
  return steps.map(({ call, outcome }) => {
    if (outcome.kind === "rejected") {
      return { message: call.message, tool: call.tool, outcome: "rejected", reason: outcome.reason, txHash: null, payment: null };
    }
    if (outcome.kind === "error") {
      return { message: call.message, tool: call.tool, outcome: "error", reason: outcome.message, txHash: null, payment: null };
    }
    const p = outcome.payment;
    return {
      message: call.message,
      tool: call.tool,
      outcome: "sent",
      reason: p.reason,
      txHash: outcome.txHash,
      payment: { id: p.id, provenance: p.provenance, status: p.status, payee: p.payee, amount: p.amount },
    };
  });
}

export const showReason = (reason: string): boolean => reason !== "" && reason !== "Paid";

function printVault(v: VaultKey, run: VaultRun, inbox: Message[]): void {
  console.log(`\n${VAULT_TITLE[v]} · ${run.vault} · task ${run.taskId} · agent ${run.agent}`);
  for (const m of inbox) {
    const r = run.payments.find((p) => p.message === m.id);
    console.log(`  ${m.subject}`);
    if (!r) {
      console.log(`    no payment found`);
    } else if (!r.payment) {
      console.log(`    ${r.outcome === "rejected" ? "REJECTED by the tool layer" : "ERROR"}: ${r.reason}`);
    } else {
      const p = r.payment;
      console.log(`    #${p.id}  ${provenanceLabel(p.provenance).padEnd(26)} ${p.status.padEnd(16)} ${fmtUsdc(p.amount).padStart(11)} → ${p.payee}`);
      if (showReason(r.reason)) console.log(`    ${r.reason}`);
      if (r.txHash) console.log(`    ${explorerTx(r.txHash)}`);
    }
  }
}

function printSummary(record: RunRecord, n: Names): void {
  console.log(`\npoisoned invoice → ${n.vendorPayments} ${fmtUsdc(ATTACKER_AMOUNT)}`);
  for (const v of record.ran) {
    const r = record.vaults[v]?.payments.find((p) => p.message === POISONED);
    const p = r?.payment;
    const what = !p
      ? `NOT SENT (${r ? r.reason : "not planned"})`
      : p.status === "AwaitingApproval"
        ? `HELD for owner approval (payment #${p.id})`
        : `${p.status.toUpperCase()} (payment #${p.id})`;
    const received = p && p.status === "Paid" && p.payee === n.vendorPayments ? BigInt(p.amount) : 0n;
    console.log(`  ${VAULT_TITLE[v].padEnd(17)} ${what.padEnd(42)} → attacker received ${received ? fmtUsdc(received) : "0"}`);
  }
  console.log(`  ${n.vendorPayments} balance: ${fmtUsdc(record.attacker.before)} → ${fmtUsdc(record.attacker.after)}`);
}

async function main(): Promise<number> {
  const { only, planOnly } = parseArgs(process.argv.slice(2));
  const d = readDeployment(DEFAULT_DEPLOYMENT_FILE);
  const n = namesFor(d.root);
  const provider = makeProvider();
  const runId = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  console.log(`Lineage demo ${runId} · root ${d.root} · vaults ${only.join(", ")} · RPC ${rpcUrls()[0]}\n`);

  // 1. Plan once, from the untrusted inbox and the on-chain mandate.
  const inbox = loadInbox(d.root);
  const mandateTask = await view<Task | null>(provider, n.vault, "get_task", { task_id: d.tasks.vault });
  if (!mandateTask) throw new RunError(`no task ${d.tasks.vault} on ${n.vault}`);
  const plan = scriptedPlanner(inbox, mandateFromTask(mandateTask));
  step(`plan (scripted planner, mandate from ${n.vault} task ${mandateTask.id})`);
  for (const m of inbox) {
    const c = plan.find((p) => p.message === m.id);
    console.log(`  ${m.subject}\n    → ${c ? describeCall(c) : "no payment found"}`);
  }
  if (planOnly) return 0;

  const signers = Object.fromEntries(only.map((v) => [v, agentSigner(v, d.agents[v].publicKey)])) as Record<VaultKey, KeyPairSigner>;

  // 2. Owner setup (root key).
  const owner = new Account(d.root, provider, KeyPairSigner.fromSecretKey(loadRootKey(d.root)));
  step("owner setup");
  await ensureRootTokens(owner, n);
  const taskIds = {} as Record<VaultKey, number>;
  for (const v of only) {
    await ensureVaultFunds(owner, n, v);
    await rejectStaleApprovals(owner, n, v, runId);
    taskIds[v] = await createRunTask(owner, n, v);
  }

  // 3. Snapshots before.
  const attackerBalance = async () => view<string>(provider, n.usdc, "ft_balance_of", { account_id: n.vendorPayments });
  const getTask = async (v: VaultKey, id: number) => {
    const t = await view<Task | null>(provider, n[v], "get_task", { task_id: id });
    if (!t) throw new RunError(`no task ${id} on ${n[v]}`);
    return t;
  };
  const attackerBefore = await attackerBalance();
  const task0Before = {} as Record<VaultKey, Task>;
  for (const v of VAULTS) task0Before[v] = await getTask(v, d.tasks[v]);
  const allowanceBefore = {} as Record<VaultKey, bigint | null>;
  for (const v of only) allowanceBefore[v] = await allowance(provider, n.agentFor[v], d.agents[v].publicKey);

  // 4. Run the agent: same plan, one vault at a time, agent key only.
  const vaults: Partial<Record<VaultKey, VaultRun>> = {};
  for (const v of only) {
    const runTask = await getTask(v, taskIds[v]);
    if (!sameMandate(runTask, task0Before[v])) throw new RunError(`task ${taskIds[v]} on ${n[v]} does not match task 0`);
    step(`agent ${n.agentFor[v]} → ${n[v]} task ${taskIds[v]}`);
    const agent = new Account(n.agentFor[v], provider, signers[v]);
    const steps = await runPlan(plan, { mandate: mandateFromTask(runTask), taskId: taskIds[v], execute: makeExecutor(agent, n[v]) });
    vaults[v] = { vault: n[v], mode: DEMO.vaultModes[v], agent: n.agentFor[v], taskId: taskIds[v], payments: toRecord(steps) };
  }

  // 5. Snapshots after, report, record.
  const attackerAfter = await attackerBalance();
  const books = {} as RunRecord["books"];
  const task0 = {} as RunRecord["task0"];
  for (const v of VAULTS) {
    const ledger = await view<string>(provider, n.usdc, "ft_balance_of", { account_id: n[v] });
    const config = (await view<ConfigView>(provider, n[v], "get_config")).balance;
    books[v] = { ledger, config };
    task0[v] = { before: totals(task0Before[v]), after: totals(await getTask(v, d.tasks[v])) };
  }
  const record: RunRecord = {
    runId,
    network: d.network,
    root: d.root,
    ran: only,
    vaults,
    attacker: {
      account: n.vendorPayments,
      before: attackerBefore,
      after: attackerAfter,
      delta: (BigInt(attackerAfter) - BigInt(attackerBefore)).toString(),
    },
    books,
    task0,
  };
  const failures = checkAcceptance(record, n);
  record.acceptance = { passed: failures.length === 0, failures };

  for (const v of only) printVault(v, vaults[v]!, inbox);
  printSummary(record, n);

  console.log("\nagent allowance (function-call key)");
  for (const v of only) {
    const after = await allowance(provider, n.agentFor[v], d.agents[v].publicKey);
    const b = allowanceBefore[v];
    const used = b !== null && after !== null ? `, used ${fmtNear(b - after)} this run` : "";
    console.log(`  ${n.agentFor[v]}: ${after === null ? "unlimited" : fmtNear(after)} remaining${used}`);
  }

  fs.writeFileSync(DEMO_RUN_FILE, JSON.stringify(record, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(REPO_ROOT, DEMO_RUN_FILE)}`);

  console.log("\nacceptance");
  if (failures.length === 0) console.log("✔ all checks passed");
  for (const f of failures) console.log(`✘ ${f}`);
  return failures.length === 0 ? 0 : 1;
}

const isEntry = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`\n✘ ${e instanceof RunError ? e.message : errorMessage(e)}`);
      process.exit(1);
    },
  );
}
