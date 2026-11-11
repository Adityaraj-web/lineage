import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  Account,
  KeyPair,
  KeyPairSigner,
  actions,
  getTransactionLastResult,
  nearToYocto,
  teraToGas,
  type Action,
  type KeyPairString,
} from "near-api-js";
import { AccessKeyDoesNotExistError } from "near-api-js/rpc-errors";
import { REPO_ROOT, upsertEnvLocal } from "./lib/env.js";
import {
  DEFAULT_DEPLOYMENT_FILE,
  DEMO,
  VAULTS,
  namesFor,
  readDeployment,
  writeDeployment,
  type Deployment,
  type VaultKey,
} from "./lib/deployment.js";
import { info, skip, step } from "./lib/log.js";
import {
  accountExists,
  errorMessage,
  explorerTx,
  fmtNear,
  fmtUsdc,
  makeProvider,
  rpcUrls,
  txHash,
  view,
} from "./lib/near.js";

const DRY = process.argv.includes("--dry-run");
const FAUCET = "https://near-faucet.io (or `near account create-account sponsor-by-faucet-service`)";
const ONE_YOCTO = 1n;
const FT_STORAGE_DEPOSIT = 1_250_000_000_000_000_000_000n;
const YOCTO_PER_BYTE = 10n ** 19n;
const EMPTY_CODE_HASH = "11111111111111111111111111111111";
const AGENT_ENV: Record<VaultKey, string> = { vault: "AGENT_L_KEY", guarded: "AGENT_G_KEY" };

const WASM = {
  vault: path.join(REPO_ROOT, "target/near/lineage_vault/lineage_vault.wasm"),
  registry: path.join(REPO_ROOT, "target/near/lineage_registry/lineage_registry.wasm"),
  usdc: path.join(REPO_ROOT, "target/near/lineage_mock_usdc/lineage_mock_usdc.wasm"),
};

class DeployError extends Error {}

interface ConfigView {
  balance: string;
  task_count: number;
}
interface ServiceView {
  status: "Pending" | "Verified" | "Revoked";
}

let sentAny = false;

async function send(
  signerAccount: Account,
  receiverId: string,
  acts: Action[],
  what: string,
): Promise<{ hash: string; result: unknown }> {
  if (DRY) {
    info(`(dry run) would send: ${what}`);
    return { hash: "", result: undefined };
  }
  const res = await signerAccount.signAndSendTransaction({ receiverId, actions: acts, waitUntil: "FINAL" });
  sentAny = true;
  const hash = txHash(res);
  info(explorerTx(hash));
  return { hash, result: getTransactionLastResult(res) };
}

function loadRootKey(root: string): KeyPairString {
  if (process.env.LINEAGE_ROOT_KEY) return process.env.LINEAGE_ROOT_KEY as KeyPairString;
  const file = path.join(os.homedir(), ".near-credentials", "testnet", `${root}.json`);
  if (!fs.existsSync(file)) {
    throw new DeployError(`no key for ${root}: set LINEAGE_ROOT_KEY or create ${file}`);
  }
  const key = JSON.parse(fs.readFileSync(file, "utf8")).private_key;
  if (!key) throw new DeployError(`${file} has no private_key field`);
  return key as KeyPairString;
}

async function main(): Promise<void> {
  const root = process.env.LINEAGE_ROOT;
  if (!root) {
    throw new DeployError("LINEAGE_ROOT is not set. Usage: LINEAGE_ROOT=<your-account>.testnet npm run deploy");
  }
  const n = namesFor(root);
  const provider = makeProvider();
  const rootSigner = KeyPairSigner.fromSecretKey(loadRootKey(root));
  const rootPk = await rootSigner.getPublicKey();
  const rootAcc = new Account(root, provider, rootSigner);

  console.log(`Lineage deploy${DRY ? " (DRY RUN: nothing is signed or written)" : ""} · root ${root} · RPC ${rpcUrls()[0]}\n`);

  // ---------------------------------------------------------------- 1. preflight
  step("preflight");
  for (const [name, file] of Object.entries(WASM)) {
    if (!fs.existsSync(file)) throw new DeployError(`missing ${name} wasm at ${file}; run \`npm run build\` first`);
  }
  const code = {
    vault: new Uint8Array(fs.readFileSync(WASM.vault)),
    registry: new Uint8Array(fs.readFileSync(WASM.registry)),
    usdc: new Uint8Array(fs.readFileSync(WASM.usdc)),
  };
  if (!(await accountExists(provider, root))) throw new DeployError(`root account ${root} does not exist`);
  try {
    const ak = await provider.viewAccessKey({ accountId: root, publicKey: rootPk });
    if (ak.permission !== "FullAccess") throw new DeployError(`root key ${rootPk} is not a full-access key on ${root}`);
  } catch (e) {
    if (e instanceof AccessKeyDoesNotExistError) throw new DeployError(`key ${rootPk} is not an access key of ${root}`);
    throw e;
  }
  info(`root key ${rootPk} (full access)`);

  const contracts = [
    { key: "usdc", id: n.usdc, wasm: code.usdc, extra: nearToYocto("0.5"), args: {} },
    { key: "registry", id: n.registry, wasm: code.registry, extra: nearToYocto("0.5"), args: { curator: root } },
    { key: "vault", id: n.vault, wasm: code.vault, extra: nearToYocto(1), args: { owner: root, token: n.usdc, mode: "Lineage" } },
    { key: "guarded", id: n.guarded, wasm: code.vault, extra: nearToYocto(1), args: { owner: root, token: n.usdc, mode: "LimitsOnly" } },
  ].map((c) => ({ ...c, funding: BigInt(c.wasm.length) * YOCTO_PER_BYTE + c.extra }));
  const plain = [n.hindiTranslator, n.alice, n.vendorPayments];
  const plainFunding = nearToYocto("0.2");
  const agentFunding = nearToYocto(Number(DEMO.agentFunding));

  const exists = new Map<string, boolean>();
  for (const id of [...contracts.map((c) => c.id), ...plain, ...VAULTS.map((v) => n.agentFor[v])]) {
    exists.set(id, await accountExists(provider, id));
  }

  const costLines: [string, bigint][] = [];
  for (const c of contracts) {
    if (!exists.get(c.id)) {
      costLines.push([`${c.id} (code ${(c.wasm.length / 1000).toFixed(1)} KB + ${fmtNear(c.extra)})`, c.funding]);
    }
  }
  for (const id of plain) if (!exists.get(id)) costLines.push([id, plainFunding]);
  for (const v of VAULTS) if (!exists.get(n.agentFor[v])) costLines.push([n.agentFor[v], agentFunding]);
  for (const v of VAULTS) {
    const registered = exists.get(n.usdc)
      ? (await view<unknown>(provider, n.usdc, "storage_balance_of", { account_id: n[v] })) != null
      : false;
    if (!registered) costLines.push([`tUSDC storage registration for ${n[v]}`, FT_STORAGE_DEPOSIT]);
  }
  costLines.push(["gas (estimate)", nearToYocto("0.5")]);
  const needed = costLines.reduce((s, [, a]) => s + a, 0n);
  const state = await rootAcc.getState();
  const available = state.balance.available;
  for (const [what, amount] of costLines) info(`${fmtNear(amount).padStart(13)}  ${what}`);
  info(`${fmtNear(needed).padStart(13)}  total needed`);
  info(`${fmtNear(available).padStart(13)}  root available balance`);
  if (available < needed) {
    throw new DeployError(`root is short by ${fmtNear(needed - available)}. Fund ${root} from the testnet faucet: ${FAUCET}`);
  }

  const existingFile = fs.existsSync(DEFAULT_DEPLOYMENT_FILE) ? readDeployment(DEFAULT_DEPLOYMENT_FILE) : null;
  const prior = existingFile && existingFile.root === root ? existingFile : null;
  const d: Deployment = {
    network: DEMO.network,
    root,
    explorer: DEMO.explorer,
    contracts: { usdc: n.usdc, registry: n.registry, vault: n.vault, guarded: n.guarded },
    agents: {
      vault: { account: n.agentFor.vault, publicKey: "", createTx: prior?.agents.vault.createTx ?? "" },
      guarded: { account: n.agentFor.guarded, publicKey: "", createTx: prior?.agents.guarded.createTx ?? "" },
    },
    actors: { alice: n.alice, hindiTranslator: n.hindiTranslator, vendorPayments: n.vendorPayments },
    registry: { "translate-hi": { payee: n.hindiTranslator, price: DEMO.service.price.toString() } },
    tasks: { vault: prior?.tasks.vault ?? 0, guarded: prior?.tasks.guarded ?? 0 },
    deployedAt: prior?.deployedAt ?? "",
  };

  // ---------------------------------------------------------------- 2. contract accounts
  for (const c of contracts) {
    if (exists.get(c.id)) {
      const acc = await provider.viewAccount({ accountId: c.id });
      if (acc.code_hash === EMPTY_CODE_HASH) throw new DeployError(`${c.id} exists but has no contract deployed`);
      skip(`${c.id} exists with code ${acc.code_hash}`);
      continue;
    }
    step(`creating ${c.id}: deploy ${c.key === "guarded" ? "vault" : c.key} wasm + new(${JSON.stringify(c.args)}), fund ${fmtNear(c.funding)}, root key full access`);
    await send(
      rootAcc,
      c.id,
      [
        actions.createAccount(),
        actions.transfer(c.funding),
        actions.addFullAccessKey(rootPk),
        actions.deployContract(c.wasm),
        actions.functionCall("new", c.args, teraToGas(30), 0n),
      ],
      `[createAccount, transfer, addFullAccessKey, deployContract, functionCall(new)] → ${c.id}`,
    );
  }

  // ---------------------------------------------------------------- 3. plain accounts
  for (const id of plain) {
    if (exists.get(id)) {
      skip(`${id} exists`);
      continue;
    }
    step(`creating ${id}: fund ${fmtNear(plainFunding)}, root key full access`);
    await send(
      rootAcc,
      id,
      [actions.createAccount(), actions.transfer(plainFunding), actions.addFullAccessKey(rootPk)],
      `[createAccount, transfer, addFullAccessKey] → ${id}`,
    );
  }

  // ---------------------------------------------------------------- 4. agent accounts
  for (const v of VAULTS) {
    const id = n.agentFor[v];
    const envName = AGENT_ENV[v];
    const envKey = process.env[envName] as KeyPairString | undefined;

    if (exists.get(id)) {
      if (!envKey) {
        throw new DeployError(
          `${id} exists but ${envName} is not in .env.local. The account has no full-access key, so no new key can ever be added. Use a fresh LINEAGE_ROOT.`,
        );
      }
      const pk = KeyPair.fromString(envKey).getPublicKey().toString();
      const { keys } = await provider.viewAccessKeyList({ accountId: id });
      if (!keys.some((k) => k.public_key === pk)) {
        throw new DeployError(`${envName} (${pk}) is not a key of ${id}. Use a fresh LINEAGE_ROOT.`);
      }
      if (!d.agents[v].createTx) {
        throw new DeployError(`${id} exists but its creation tx is not in deployments/testnet.json; restore that file from git`);
      }
      d.agents[v].publicKey = pk;
      skip(`${id} exists, key ${pk} in .env.local`);
      continue;
    }

    step(`creating ${id} (function-call key only: ${n[v]} / request_payment, allowance ${DEMO.agentAllowanceNear} NEAR, fund ${fmtNear(agentFunding)})`);
    let keyPair: KeyPair;
    if (envKey) {
      keyPair = KeyPair.fromString(envKey);
      info(`reusing ${envName} from .env.local (account was never created)`);
    } else if (DRY) {
      info(`(dry run) would generate an ed25519 key and save it to .env.local as ${envName} before sending`);
      info(`(dry run) would send: [createAccount, transfer, addFunctionCallAccessKey] → ${id}`);
      continue;
    } else {
      keyPair = KeyPair.fromRandom("ed25519");
      upsertEnvLocal(envName, keyPair.toString());
      info(`saved ${envName} to .env.local`);
    }
    const pk = keyPair.getPublicKey();
    const { hash } = await send(
      rootAcc,
      id,
      [
        actions.createAccount(),
        actions.transfer(agentFunding),
        actions.addFunctionCallAccessKey(pk, n[v], DEMO.agentMethods, nearToYocto(DEMO.agentAllowanceNear)),
      ],
      `[createAccount, transfer, addFunctionCallAccessKey] → ${id}`,
    );
    d.agents[v].publicKey = pk.toString();
    if (!DRY) {
      d.agents[v].createTx = hash;
      writeDeployment(DEFAULT_DEPLOYMENT_FILE, d);
      info(`recorded creation tx in deployments/testnet.json`);
    }
  }

  // ---------------------------------------------------------------- 5. token setup
  const usdcLive = !DRY || exists.get(n.usdc);
  for (const v of VAULTS) {
    const registered = usdcLive
      ? (await view<unknown>(provider, n.usdc, "storage_balance_of", { account_id: n[v] })) != null
      : false;
    if (registered) {
      skip(`${n[v]} already registered on ${n.usdc}`);
      continue;
    }
    step(`registering ${n[v]} on ${n.usdc} (storage_deposit, ${fmtNear(FT_STORAGE_DEPOSIT)})`);
    await send(
      rootAcc,
      n.usdc,
      [actions.functionCall("storage_deposit", { account_id: n[v] }, teraToGas(30), FT_STORAGE_DEPOSIT)],
      `storage_deposit({account_id: ${n[v]}}) on ${n.usdc}`,
    );
  }

  const rootUsdc = usdcLive ? BigInt(await view<string>(provider, n.usdc, "ft_balance_of", { account_id: root })) : 0n;
  if (rootUsdc >= DEMO.rootMintThreshold) {
    skip(`${root} holds ${fmtUsdc(rootUsdc)}`);
  } else {
    step(`minting ${fmtUsdc(DEMO.rootMint)} to ${root} (holds ${fmtUsdc(rootUsdc)})`);
    await send(
      rootAcc,
      n.usdc,
      [actions.functionCall("mint", { account_id: root, amount: DEMO.rootMint.toString() }, teraToGas(30), 0n)],
      `mint({account_id: ${root}, amount: ${DEMO.rootMint}}) on ${n.usdc}`,
    );
  }

  for (const v of VAULTS) {
    const balance =
      !DRY || exists.get(n[v]) ? BigInt((await view<ConfigView>(provider, n[v], "get_config")).balance) : 0n;
    if (balance >= DEMO.vaultTarget) {
      skip(`${n[v]} holds ${fmtUsdc(balance)}`);
      continue;
    }
    const diff = DEMO.vaultTarget - balance;
    step(`funding ${n[v]} with ${fmtUsdc(diff)} (holds ${fmtUsdc(balance)}, target ${fmtUsdc(DEMO.vaultTarget)})`);
    await send(
      rootAcc,
      n.usdc,
      [
        actions.functionCall(
          "ft_transfer_call",
          { receiver_id: n[v], amount: diff.toString(), msg: "" },
          teraToGas(100),
          ONE_YOCTO,
        ),
      ],
      `ft_transfer_call({receiver_id: ${n[v]}, amount: ${diff}, msg: ""}) on ${n.usdc}, 1 yocto`,
    );
    if (!DRY) {
      const after = BigInt((await view<ConfigView>(provider, n[v], "get_config")).balance);
      if (after < DEMO.vaultTarget) throw new DeployError(`${n[v]} balance is ${fmtUsdc(after)} after funding`);
    }
  }

  // ---------------------------------------------------------------- 6. registry
  const registryLive = !DRY || exists.get(n.registry);
  const svcId = DEMO.service.id;
  let service = registryLive ? await view<ServiceView | null>(provider, n.registry, "get_service", { id: svcId }) : null;
  if (service) {
    skip(`service "${svcId}" exists (${service.status}); not re-applying (that would reset it to Pending)`);
  } else {
    step(`${n.hindiTranslator} applies for "${svcId}" at ${fmtUsdc(DEMO.service.price)}`);
    const hindi = new Account(n.hindiTranslator, provider, rootSigner);
    await send(
      hindi,
      n.registry,
      [
        actions.functionCall(
          "apply",
          { id: svcId, price: DEMO.service.price.toString(), description: DEMO.service.description },
          teraToGas(30),
          0n,
        ),
      ],
      `apply({id: "${svcId}", price: ${DEMO.service.price}}) on ${n.registry}, signed by ${n.hindiTranslator}`,
    );
    service = DRY ? { status: "Pending" } : await view<ServiceView | null>(provider, n.registry, "get_service", { id: svcId });
  }
  if (service?.status === "Verified") {
    skip(`service "${svcId}" is Verified`);
  } else {
    step(`curator ${root} verifies "${svcId}"`);
    await send(
      rootAcc,
      n.registry,
      [actions.functionCall("verify", { id: svcId }, teraToGas(30), 0n)],
      `verify({id: "${svcId}"}) on ${n.registry}`,
    );
  }

  // ---------------------------------------------------------------- 7. task 0 on both vaults
  for (const v of VAULTS) {
    const taskCount = !DRY || exists.get(n[v]) ? (await view<ConfigView>(provider, n[v], "get_config")).task_count : 0;
    if (taskCount > 0) {
      skip(`${n[v]} already has ${taskCount} task(s); using task ${d.tasks[v]}`);
      continue;
    }
    step(`creating task 0 on ${n[v]} for ${n.agentFor[v]} (budget ${fmtUsdc(DEMO.task.budget)}, max ${fmtUsdc(DEMO.task.maxPerPayment)}, alice ≤ ${fmtUsdc(DEMO.task.aliceMax)}, resolver ${n.registry}, ${DEMO.task.ttlMinutes} min)`);
    const { result } = await send(
      rootAcc,
      n[v],
      [
        actions.functionCall(
          "create_task",
          {
            agent: n.agentFor[v],
            instruction: DEMO.task.instruction,
            budget: DEMO.task.budget.toString(),
            max_per_payment: DEMO.task.maxPerPayment.toString(),
            ttl_minutes: DEMO.task.ttlMinutes,
            signed_payees: [
              { account_id: n.alice, max_amount: DEMO.task.aliceMax.toString(), label: DEMO.task.aliceLabel },
            ],
            resolvers: [n.registry],
          },
          teraToGas(30),
          ONE_YOCTO,
        ),
      ],
      `create_task(...) on ${n[v]}, 1 yocto`,
    );
    if (!DRY) d.tasks[v] = Number(result);
  }

  // ---------------------------------------------------------------- 8. deployments/testnet.json
  const rel = path.relative(REPO_ROOT, DEFAULT_DEPLOYMENT_FILE);
  if (DRY) {
    step(`(dry run) would write ${rel}`);
  } else {
    const strip = (x: Deployment | null) => x && JSON.stringify({ ...x, deployedAt: "" });
    const current = fs.existsSync(DEFAULT_DEPLOYMENT_FILE) ? readDeployment(DEFAULT_DEPLOYMENT_FILE) : null;
    if (!sentAny && current && strip(current) === strip(d)) {
      skip(`${rel} is up to date`);
    } else {
      d.deployedAt = sentAny || !d.deployedAt ? new Date().toISOString() : d.deployedAt;
      writeDeployment(DEFAULT_DEPLOYMENT_FILE, d);
      step(`wrote ${rel}`);
    }
  }

  console.log(DRY ? "\nDry run complete. Nothing was signed or written." : "\nDone. Next: npm run verify:deploy");
}

main().catch((e) => {
  console.error(`\n✘ ${e instanceof DeployError ? e.message : errorMessage(e)}`);
  process.exit(1);
});
