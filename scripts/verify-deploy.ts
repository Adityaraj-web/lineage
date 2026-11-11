import fs from "node:fs";
import path from "node:path";
import { Account, KeyPairSigner, actions, teraToGas, type KeyPairString, type Provider } from "near-api-js";
import {
  AccessKeyMethodNameMismatchActionError,
  AccessKeyReceiverMismatchActionError,
} from "near-api-js/rpc-errors";
import "./lib/env.js";
import {
  DEFAULT_DEPLOYMENT_FILE,
  DEMO,
  VAULTS,
  readDeployment,
  type Deployment,
  type VaultKey,
} from "./lib/deployment.js";
import { CheckFailed, Checklist, expect, expectEq } from "./lib/log.js";
import { accountExists, errorMessage, explorerTx, fmtUsdc, makeProvider, rpcUrls, usdc, view } from "./lib/near.js";

interface ConfigView {
  owner: string;
  token: string;
  mode: string;
  frozen: boolean;
  balance: string;
  total_reserved: string;
  task_count: number;
  payment_count: number;
}

interface TaskView {
  id: number;
  agent: string;
  budget: string;
  max_per_payment: string;
  expires_at_ms: number;
  signed_payees: { account_id: string; max_amount: string; label: string }[];
  resolvers: string[];
}

interface Resolution {
  payee: string;
  amount: string;
}

function parseFileArg(): string {
  const i = process.argv.indexOf("--file");
  if (i >= 0) {
    const p = process.argv[i + 1];
    if (!p) throw new Error("--file needs a path");
    return path.resolve(p);
  }
  return DEFAULT_DEPLOYMENT_FILE;
}

async function main(): Promise<number> {
  const file = parseFileArg();
  const list = new Checklist();
  const shown = path.relative(process.cwd(), file);
  console.log(`Lineage deployment check · ${shown.startsWith("..") ? file : shown} · RPC ${rpcUrls()[0]}\n`);

  if (!fs.existsSync(file)) {
    console.log(`✘ deployment file — ${file} not found; run \`npm run deploy\` first (or pass --file <path>)`);
    return 1;
  }
  let d: Deployment;
  try {
    d = readDeployment(file);
  } catch (e) {
    console.log(`✘ deployment file — cannot parse: ${errorMessage(e)}`);
    return 1;
  }

  const provider = makeProvider();
  const { contracts: c } = d;

  for (const v of VAULTS) {
    await list.check(`${v}: config (${c[v]})`, async () => {
      const cfg = await view<ConfigView>(provider, c[v], "get_config");
      expectEq(cfg.mode, DEMO.vaultModes[v], "mode");
      expectEq(cfg.owner, d.root, "owner");
      expectEq(cfg.token, c.usdc, "token");
      expectEq(cfg.frozen, false, "frozen");
      return `mode ${cfg.mode}, owner ${cfg.owner}, token ${cfg.token}, not frozen`;
    });
  }

  for (const v of VAULTS) {
    await list.check(`${v}: vault books match the token ledger`, async () => {
      const cfg = await view<ConfigView>(provider, c[v], "get_config");
      const onLedger = BigInt(await view<string>(provider, c.usdc, "ft_balance_of", { account_id: c[v] }));
      const books = BigInt(cfg.balance);
      expect(onLedger === books, `ft_balance_of ${fmtUsdc(onLedger)} != vault balance ${fmtUsdc(books)}`);
      if (cfg.payment_count === 0) {
        expect(books === DEMO.vaultTarget, `no payments yet, expected ${fmtUsdc(DEMO.vaultTarget)}, got ${fmtUsdc(books)}`);
      }
      return `${fmtUsdc(books)} (${cfg.payment_count} payments)`;
    });
  }

  await list.check(`registry: "${DEMO.service.id}" resolves to ${d.actors.hindiTranslator}`, async () => {
    const r = await view<Resolution | null>(provider, c.registry, "lineage_resolve", { reference: DEMO.service.id });
    expect(r !== null && r !== undefined, "lineage_resolve returned null (service missing or not Verified)");
    expectEq(r.payee, d.actors.hindiTranslator, "payee");
    expectEq(r.amount, DEMO.service.price.toString(), "amount");
    return `payee ${r.payee}, ${fmtUsdc(r.amount)}`;
  });

  await list.check(`registry: "vendor-payments" does not resolve`, async () => {
    const r = await view<Resolution | null>(provider, c.registry, "lineage_resolve", { reference: "vendor-payments" });
    expect(r === null, `expected null, got ${JSON.stringify(r)}`);
    return "null";
  });

  for (const v of VAULTS) {
    const agent = d.agents[v];
    await list.check(`${agent.account}: exactly one key, function-call only, ${c[v]} / request_payment`, async () => {
      const { keys } = await provider.viewAccessKeyList({ accountId: agent.account });
      if (keys.length === 0 && !(await accountExists(provider, agent.account))) {
        throw new CheckFailed(`account ${agent.account} does not exist`);
      }
      expect(keys.length === 1, `expected 1 access key, found ${keys.length}`);
      const [k] = keys;
      const perm = k.access_key.permission;
      expect(typeof perm === "object" && "FunctionCall" in perm, `key is ${JSON.stringify(perm)}, not a FunctionCall key`);
      const fc = (perm as { FunctionCall: { receiver_id: string; method_names: string[] } }).FunctionCall;
      expectEq(fc.receiver_id, c[v], "receiver");
      expectEq(fc.method_names, DEMO.agentMethods, "method_names");
      expectEq(k.public_key, agent.publicKey, "public key");
      return `${k.public_key}\n    created (no full-access key ever added): ${explorerTx(agent.createTx)}`;
    });
  }

  for (const v of VAULTS) {
    const taskId = d.tasks[v];
    await list.check(`${v}: task ${taskId} mandate`, async () => {
      const t = await view<TaskView | null>(provider, c[v], "get_task", { task_id: taskId });
      expect(t !== null && t !== undefined, `no task ${taskId}`);
      expectEq(t.agent, d.agents[v].account, "agent");
      expectEq(t.budget, DEMO.task.budget.toString(), "budget");
      expectEq(t.max_per_payment, DEMO.task.maxPerPayment.toString(), "max_per_payment");
      expect(t.signed_payees.length === 1, `expected 1 signed payee, got ${t.signed_payees.length}`);
      expectEq(t.signed_payees[0].account_id, d.actors.alice, "signed payee");
      expectEq(t.signed_payees[0].max_amount, DEMO.task.aliceMax.toString(), "signed payee max_amount");
      expectEq(t.resolvers, [c.registry], "resolvers");
      return `agent ${t.agent}, budget ${fmtUsdc(t.budget)}, max ${fmtUsdc(t.max_per_payment)}, alice ≤ ${fmtUsdc(
        t.signed_payees[0].max_amount,
      )}, resolver ${t.resolvers[0]}, expires ${new Date(t.expires_at_ms).toISOString()}`;
    });
  }

  await signedNegativeChecks(list, provider, d);

  console.log(`\n${list.passed} passed, ${list.failed} failed`);
  return list.ok ? 0 : 1;
}

async function signedNegativeChecks(list: Checklist, provider: Provider, d: Deployment): Promise<void> {
  const labels = [
    `agent-l key cannot call approve_payment on ${d.contracts.vault}`,
    `agent-l key cannot call ${d.contracts.guarded}`,
  ];
  const key = process.env.AGENT_L_KEY;
  if (!key) {
    for (const l of labels) list.skipped(l, "no agent keys (run as the deployer)");
    return;
  }
  const signer = KeyPairSigner.fromSecretKey(key as KeyPairString);
  const agentL = new Account(d.agents.vault.account, provider, signer);

  await list.check(labels[0], async () => {
    const pk = (await signer.getPublicKey()).toString();
    expectEq(pk, d.agents.vault.publicKey, "AGENT_L_KEY public key");
    const err = await sendExpectingRejection(agentL, d.contracts.vault, "approve_payment", { payment_id: 0 });
    expect(
      err instanceof AccessKeyMethodNameMismatchActionError,
      `expected AccessKeyMethodNameMismatchActionError, got ${errorMessage(err)}`,
    );
    expectEq((err as AccessKeyMethodNameMismatchActionError).methodName, "approve_payment", "rejected method");
    return "rejected by the protocol: MethodNameMismatch(approve_payment)";
  });

  await list.check(labels[1], async () => {
    const err = await sendExpectingRejection(agentL, d.contracts.guarded, "request_payment", {
      task_id: d.tasks.guarded,
      payee: { Raw: { account_id: d.actors.vendorPayments } },
      amount: usdc(1).toString(),
      memo: "verify-deploy negative check",
    });
    expect(
      err instanceof AccessKeyReceiverMismatchActionError,
      `expected AccessKeyReceiverMismatchActionError, got ${errorMessage(err)}`,
    );
    const rm = err as AccessKeyReceiverMismatchActionError;
    expectEq(rm.akReceiver, d.contracts.vault, "key receiver");
    expectEq(rm.txReceiver, d.contracts.guarded, "tx receiver");
    return `rejected by the protocol: ReceiverMismatch(key ${rm.akReceiver}, tx ${rm.txReceiver})`;
  });
}

// Zero deposit, so the protocol's access-key check (not the contract) decides.
async function sendExpectingRejection(
  account: Account,
  receiverId: string,
  method: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    const res = await account.signAndSendTransaction({
      receiverId,
      actions: [actions.functionCall(method, args, teraToGas(30), 0n)],
    });
    throw new CheckFailed(`transaction was accepted (tx ${res.transaction.hash})`);
  } catch (e) {
    if (e instanceof CheckFailed) throw e;
    return e;
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`✘ ${errorMessage(e)}`);
    process.exit(1);
  },
);
