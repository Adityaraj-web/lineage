import { actions, getTransactionLastResult, teraToGas, type Account } from "near-api-js";
import { DEMO, type VaultKey, type namesFor } from "../scripts/lib/deployment.js";
import { info, skip, step } from "../scripts/lib/log.js";
import { explorerTx, fmtUsdc, view } from "../scripts/lib/near.js";
import type { ConfigView, Payment, Task } from "./vault-types.js";

// Owner-signed setup. Called by run.ts before the agent runs; the agent code path never sees this account.

type Names = ReturnType<typeof namesFor>;
const ONE_YOCTO = 1n;

async function call(
  owner: Account,
  receiverId: string,
  method: string,
  args: Record<string, unknown>,
  gasTera: number,
  deposit: bigint,
): Promise<unknown> {
  const res = await owner.signAndSendTransaction({
    receiverId,
    actions: [actions.functionCall(method, args, teraToGas(gasTera), deposit)],
    waitUntil: "FINAL",
  });
  info(explorerTx(res.transaction.hash));
  return getTransactionLastResult(res);
}

const tokenBalance = async (owner: Account, n: Names, accountId: string) =>
  BigInt(await view<string>(owner.provider, n.usdc, "ft_balance_of", { account_id: accountId }));

export async function ensureRootTokens(owner: Account, n: Names): Promise<void> {
  const held = await tokenBalance(owner, n, n.root);
  if (held >= DEMO.run.rootMin) {
    skip(`${n.root} holds ${fmtUsdc(held)}`);
    return;
  }
  step(`minting ${fmtUsdc(DEMO.rootMint)} to ${n.root} (holds ${fmtUsdc(held)})`);
  await call(owner, n.usdc, "mint", { account_id: n.root, amount: DEMO.rootMint.toString() }, 30, 0n);
}

export async function ensureVaultFunds(owner: Account, n: Names, v: VaultKey): Promise<void> {
  const balance = BigInt((await view<ConfigView>(owner.provider, n[v], "get_config")).balance);
  if (balance >= DEMO.run.vaultMin) {
    skip(`${n[v]} holds ${fmtUsdc(balance)}`);
    return;
  }
  const diff = DEMO.run.vaultMin - balance;
  step(`topping up ${n[v]} with ${fmtUsdc(diff)} (holds ${fmtUsdc(balance)})`);
  await call(owner, n.usdc, "ft_transfer_call", { receiver_id: n[v], amount: diff.toString(), msg: "" }, 100, ONE_YOCTO);
}

export async function rejectStaleApprovals(owner: Account, n: Names, v: VaultKey, runId: string): Promise<number> {
  const stale = await view<Payment[]>(owner.provider, n[v], "get_awaiting_approval");
  if (stale.length === 0) {
    skip(`${n[v]} has no payments awaiting approval`);
    return 0;
  }
  for (const p of stale) {
    step(`rejecting stale payment #${p.id} on ${n[v]} (${fmtUsdc(p.amount)} → ${p.payee})`);
    await call(owner, n[v], "reject_payment", { payment_id: p.id, reason: `superseded by demo run ${runId}` }, 30, ONE_YOCTO);
  }
  return stale.length;
}

export function demoTaskArgs(n: Names, v: VaultKey) {
  return {
    agent: n.agentFor[v],
    instruction: DEMO.task.instruction,
    budget: DEMO.task.budget.toString(),
    max_per_payment: DEMO.task.maxPerPayment.toString(),
    ttl_minutes: DEMO.task.ttlMinutes,
    signed_payees: [{ account_id: n.alice, max_amount: DEMO.task.aliceMax.toString(), label: DEMO.task.aliceLabel }],
    resolvers: [n.registry],
  };
}

// The run's task must carry the same mandate as task 0 (only ids, times and counters differ).
export function sameMandate(a: Task, b: Task): boolean {
  const pick = (t: Task) => ({
    agent: t.agent,
    instruction: t.instruction,
    budget: t.budget,
    max_per_payment: t.max_per_payment,
    signed_payees: t.signed_payees.map(({ account_id, max_amount, label }) => ({ account_id, max_amount, label })),
    resolvers: t.resolvers,
  });
  return JSON.stringify(pick(a)) === JSON.stringify(pick(b));
}

export async function createRunTask(owner: Account, n: Names, v: VaultKey): Promise<number> {
  step(`creating this run's task on ${n[v]} for ${n.agentFor[v]}`);
  const id = Number(await call(owner, n[v], "create_task", demoTaskArgs(n, v), 30, ONE_YOCTO));
  if (!Number.isInteger(id)) throw new Error(`create_task on ${n[v]} returned ${id}`);
  info(`task ${id}`);
  return id;
}
