import type { ConfigView, Payment, Task } from "../shared/vault-types";
import type { Chain, PayeeStats, Service } from "./chain";
import { VAULT_KEYS, explorerTx, type DemoRun, type VaultKey } from "./config";
import { fmtUsdc } from "./format";
import { provenanceBadge, statusLabel, type Badge } from "./provenance";
import { assessPayment, type RiskCard } from "./risk";
import type { AccessKeyInfo, AccountInfo } from "./rpc";

export interface PaymentRow {
  payment: Payment;
  badge: Badge;
  statusLabel: string;
  amount: string;
}

export interface TaskRow {
  task: Task;
  label: "verify fixture" | "latest demo run" | null;
  budget: string;
  spent: string;
  inFlight: string;
  cap: string;
  spentPct: number;
  inFlightPct: number;
  expired: boolean;
}

export interface InboxItem {
  row: PaymentRow;
  risk: RiskCard;
  // payments a finding points at (the earlier A-102 payment for duplicate-reference)
  related: PaymentRow[];
}

export type Inbox = { kind: "lineage"; items: InboxItem[] } | { kind: "limits-only"; message: string };

export const LIMITS_ONLY_INBOX =
  "LimitsOnly mode never asks: it pays any request within limits, wherever the address came from.";

export interface VaultFacts {
  key: VaultKey;
  vaultId: string;
  config: ConfigView;
  codeHash: string | null;
  tasks: Task[];
  payments: Payment[];
  payees: Record<string, { account: AccountInfo; stats: PayeeStats }>;
  demoTaskId: number | null;
  now: number;
}

export interface VaultView {
  key: VaultKey;
  vaultId: string;
  config: ConfigView;
  codeHash: string | null;
  balance: string;
  inFlight: string;
  tasks: TaskRow[];
  payments: PaymentRow[];
  inbox: Inbox;
}

export interface CompareSide {
  payment: Payment | null;
  badge: Badge | null;
  statusLabel: string;
  payee: string | null;
  amount: string | null;
  txUrl: string | null;
}

export interface CompareRow {
  message: string;
  subject: string;
  tool: string;
  poisoned: boolean;
  sides: Record<VaultKey, CompareSide>;
}

export interface CompareFacts {
  demoRun: DemoRun;
  // aligned with demoRun.vaults[key].payments; null when the live payment is missing
  payments: Record<VaultKey, (Payment | null)[]>;
  tasks: Record<VaultKey, Task | null>;
  codeHashes: Record<VaultKey, string | null>;
}

export interface CompareView {
  runId: string;
  taskIds: Record<VaultKey, number | null>;
  rows: CompareRow[];
  attacker: string;
  attackerReceived: Record<VaultKey, bigint>;
  attackerReceivedText: Record<VaultKey, string>;
  codeHashes: Record<VaultKey, string | null>;
  sameCode: boolean;
}

export interface KeyProof {
  ok: boolean;
  problems: string[];
  keyCount: number;
  publicKey: string | null;
  receiverId: string | null;
  methodNames: string[];
  allowance: string | null;
}

export interface OverviewFacts {
  vaultIds: Record<VaultKey, string>;
  configs: Record<VaultKey, ConfigView>;
  codeHashes: Record<VaultKey, string | null>;
  keys: Record<VaultKey, AccessKeyInfo[]>;
  awaitingCount: number;
  services: Service[];
  compare: CompareView;
}

export interface Overview {
  vaults: Record<VaultKey, { vaultId: string; config: ConfigView; codeHash: string | null; balance: string }>;
  sameCode: boolean;
  keyProofs: Record<VaultKey, KeyProof>;
  awaitingCount: number;
  services: Service[];
  demo: {
    runId: string;
    attacker: string;
    attackerReceived: Record<VaultKey, bigint>;
    attackerReceivedText: Record<VaultKey, string>;
  };
  compare: CompareView;
}

export interface LoadDeps {
  chain: Chain;
  demoRun: DemoRun;
  vaultIds: Record<VaultKey, string>;
  agentIds: Record<VaultKey, string>;
  now: () => number;
}

const AGENT_METHODS = ["request_payment"];

export function agentKeyProof(keys: AccessKeyInfo[], vaultId: string): KeyProof {
  const problems: string[] = [];
  if (keys.length !== 1) problems.push(`expected exactly 1 access key, found ${keys.length}`);
  const fullAccess = keys.filter((k) => k.permission === "FullAccess").length;
  if (fullAccess) problems.push(`${fullAccess} full-access key${fullAccess > 1 ? "s" : ""}`);
  const first = keys[0];
  const perm = first && first.permission !== "FullAccess" ? first.permission : null;
  for (const k of keys) {
    if (k.permission === "FullAccess") continue;
    if (k.permission.receiverId !== vaultId) problems.push(`key ${k.publicKey} may call ${k.permission.receiverId}, not ${vaultId}`);
    const m = k.permission.methodNames;
    if (m.length !== AGENT_METHODS.length || m.some((x, i) => x !== AGENT_METHODS[i])) {
      problems.push(`key ${k.publicKey} methods are ${JSON.stringify(m)}, expected ${JSON.stringify(AGENT_METHODS)}`);
    }
  }
  return {
    ok: problems.length === 0,
    problems,
    keyCount: keys.length,
    publicKey: first?.publicKey ?? null,
    receiverId: perm?.receiverId ?? null,
    methodNames: perm?.methodNames ?? [],
    allowance: perm?.allowance ?? null,
  };
}

const modeOf = (config: ConfigView) => config.mode;

function paymentRow(payment: Payment, task: Task | null, config: ConfigView): PaymentRow {
  return {
    payment,
    badge: provenanceBadge(payment, task, modeOf(config)),
    statusLabel: statusLabel(payment.status),
    amount: fmtUsdc(payment.amount),
  };
}

const pct = (part: string, whole: string): number => {
  const w = BigInt(whole);
  return w === 0n ? 0 : Number((BigInt(part) * 10_000n) / w) / 100;
};

export function buildVaultView(f: VaultFacts): VaultView {
  const taskById = new Map(f.tasks.map((t) => [t.id, t]));
  const taskOf = (p: Payment) => taskById.get(p.task_id) ?? null;
  const tasks: TaskRow[] = f.tasks.map((task) => ({
    task,
    label: task.id === 0 ? "verify fixture" : task.id === f.demoTaskId ? "latest demo run" : null,
    budget: fmtUsdc(task.budget),
    spent: fmtUsdc(task.spent),
    inFlight: fmtUsdc(task.reserved),
    cap: fmtUsdc(task.max_per_payment),
    spentPct: pct(task.spent, task.budget),
    inFlightPct: pct(task.reserved, task.budget),
    expired: task.expires_at_ms <= f.now,
  }));
  const sorted = [...f.payments].sort((a, b) => b.id - a.id);
  const payments = sorted.map((p) => paymentRow(p, taskOf(p), f.config));
  const rowById = new Map(payments.map((r) => [r.payment.id, r]));

  let inbox: Inbox;
  if (f.config.mode === "LimitsOnly") {
    inbox = { kind: "limits-only", message: LIMITS_ONLY_INBOX };
  } else {
    const items: InboxItem[] = [];
    for (const row of payments) {
      const p = row.payment;
      if (p.status !== "AwaitingApproval") continue;
      const facts = p.payee ? f.payees[p.payee] : undefined;
      const risk = assessPayment({
        payment: p,
        task: taskOf(p),
        mode: f.config.mode,
        taskPayments: f.payments.filter((o) => o.task_id === p.task_id),
        account: facts?.account ?? { exists: false },
        stats: facts?.stats ?? { payments: 0, total: "0", first_paid_at_ms: 0, last_paid_at_ms: 0 },
      });
      const related = risk.findings
        .map((x) => (x.ref ? rowById.get(x.ref.paymentId) : undefined))
        .filter((r): r is PaymentRow => !!r);
      items.push({ row, risk, related });
    }
    inbox = { kind: "lineage", items };
  }

  return {
    key: f.key,
    vaultId: f.vaultId,
    config: f.config,
    codeHash: f.codeHash,
    balance: fmtUsdc(f.config.balance),
    inFlight: fmtUsdc(f.config.total_reserved),
    tasks,
    payments,
    inbox,
  };
}

const emptySide = (txHash?: string): CompareSide => ({
  payment: null,
  badge: null,
  statusLabel: "not found",
  payee: null,
  amount: null,
  txUrl: txHash ? explorerTx(txHash) : null,
});

export function buildCompareView(f: CompareFacts): CompareView {
  const attacker = f.demoRun.attacker.account;
  const messages: { message: string; tool: string }[] = [];
  for (const key of VAULT_KEYS) {
    for (const r of f.demoRun.vaults[key]?.payments ?? []) {
      if (!messages.some((m) => m.message === r.message)) messages.push({ message: r.message, tool: r.tool });
    }
  }
  const received: Record<VaultKey, bigint> = { vault: 0n, guarded: 0n };

  const rows: CompareRow[] = messages.map(({ message, tool }) => {
    const sides = {} as Record<VaultKey, CompareSide>;
    let subject = "";
    let poisoned = false;
    for (const key of VAULT_KEYS) {
      const recs = f.demoRun.vaults[key]?.payments ?? [];
      const i = recs.findIndex((r) => r.message === message);
      const rec = i >= 0 ? recs[i] : undefined;
      const live = i >= 0 ? (f.payments[key][i] ?? null) : null;
      if (rec?.payment?.payee === attacker) poisoned = true;
      if (!live) {
        sides[key] = emptySide(rec?.txHash);
        continue;
      }
      subject ||= live.memo;
      if (live.payee === attacker) poisoned = true;
      if (live.payee === attacker && live.status === "Paid") received[key] += BigInt(live.amount);
      const mode = f.demoRun.vaults[key]?.mode ?? (key === "vault" ? "Lineage" : "LimitsOnly");
      sides[key] = {
        payment: live,
        badge: provenanceBadge(live, f.tasks[key], mode),
        statusLabel: statusLabel(live.status),
        payee: live.payee,
        amount: fmtUsdc(live.amount),
        txUrl: rec?.txHash ? explorerTx(rec.txHash) : null,
      };
    }
    return { message, subject: subject || message, tool, poisoned, sides };
  });

  const h = f.codeHashes;
  return {
    runId: f.demoRun.runId,
    taskIds: { vault: f.demoRun.vaults.vault?.taskId ?? null, guarded: f.demoRun.vaults.guarded?.taskId ?? null },
    rows,
    attacker,
    attackerReceived: received,
    attackerReceivedText: { vault: fmtUsdc(received.vault), guarded: fmtUsdc(received.guarded) },
    codeHashes: h,
    sameCode: h.vault !== null && h.vault === h.guarded,
  };
}

export function buildOverview(f: OverviewFacts): Overview {
  const vault = (key: VaultKey) => ({
    vaultId: f.vaultIds[key],
    config: f.configs[key],
    codeHash: f.codeHashes[key],
    balance: fmtUsdc(f.configs[key].balance),
  });
  return {
    vaults: { vault: vault("vault"), guarded: vault("guarded") },
    sameCode: f.codeHashes.vault !== null && f.codeHashes.vault === f.codeHashes.guarded,
    keyProofs: {
      vault: agentKeyProof(f.keys.vault, f.vaultIds.vault),
      guarded: agentKeyProof(f.keys.guarded, f.vaultIds.guarded),
    },
    awaitingCount: f.awaitingCount,
    services: f.services,
    demo: {
      runId: f.compare.runId,
      attacker: f.compare.attacker,
      attackerReceived: f.compare.attackerReceived,
      attackerReceivedText: f.compare.attackerReceivedText,
    },
    compare: f.compare,
  };
}

export async function loadVaultView(key: VaultKey, deps: LoadDeps): Promise<VaultView> {
  const { chain, demoRun } = deps;
  const vaultId = deps.vaultIds[key];
  const [config, codeHash, tasks, payments] = await Promise.all([
    chain.getConfig(vaultId),
    chain.codeHash(vaultId),
    chain.getAllTasks(vaultId),
    chain.getAllPayments(vaultId),
  ]);
  const payees: VaultFacts["payees"] = {};
  if (config.mode === "Lineage") {
    const held = [...new Set(payments.filter((p) => p.status === "AwaitingApproval" && p.payee).map((p) => p.payee!))];
    await Promise.all(
      held.map(async (payee) => {
        const [account, stats] = await Promise.all([chain.viewAccount(payee), chain.getPayeeStats(vaultId, payee)]);
        payees[payee] = { account, stats };
      }),
    );
  }
  return buildVaultView({
    key,
    vaultId,
    config,
    codeHash,
    tasks,
    payments,
    payees,
    demoTaskId: demoRun.vaults[key]?.taskId ?? null,
    now: deps.now(),
  });
}

async function compareFacts(deps: LoadDeps): Promise<CompareFacts> {
  const { chain, demoRun } = deps;
  const perVault = await Promise.all(
    VAULT_KEYS.map(async (key) => {
      const vaultId = deps.vaultIds[key];
      const run = demoRun.vaults[key];
      const [payments, task, codeHash] = await Promise.all([
        Promise.all((run?.payments ?? []).map((r) => (r.payment ? chain.getPayment(vaultId, r.payment.id) : null))),
        run ? chain.getTask(vaultId, run.taskId) : null,
        chain.codeHash(vaultId),
      ]);
      return { payments, task, codeHash };
    }),
  );
  const [v, g] = perVault;
  return {
    demoRun,
    payments: { vault: v.payments, guarded: g.payments },
    tasks: { vault: v.task, guarded: g.task },
    codeHashes: { vault: v.codeHash, guarded: g.codeHash },
  };
}

export async function loadCompareView(deps: LoadDeps): Promise<CompareView> {
  return buildCompareView(await compareFacts(deps));
}

export async function loadOverview(deps: LoadDeps): Promise<Overview> {
  const { chain, vaultIds, agentIds } = deps;
  const [configV, configG, keysV, keysG, awaiting, services, facts] = await Promise.all([
    chain.getConfig(vaultIds.vault),
    chain.getConfig(vaultIds.guarded),
    chain.accessKeys(agentIds.vault),
    chain.accessKeys(agentIds.guarded),
    chain.getAwaitingApproval(vaultIds.vault),
    chain.listServices(),
    compareFacts(deps),
  ]);
  return buildOverview({
    vaultIds,
    configs: { vault: configV, guarded: configG },
    codeHashes: facts.codeHashes,
    keys: { vault: keysV, guarded: keysG },
    awaitingCount: awaiting.length,
    services,
    compare: buildCompareView(facts),
  });
}
