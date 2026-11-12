import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Account, KeyPairSigner, actions, baseEncode } from "near-api-js";
import { REPO_ROOT } from "./lib/env.js";
import { DEFAULT_DEPLOYMENT_FILE, VAULTS, namesFor, readDeployment } from "./lib/deployment.js";
import { info, skip, step } from "./lib/log.js";
import { RootKeyError, loadRootKey } from "./lib/root-key.js";
import { errorMessage, explorerTx, fmtUsdc, makeProvider, rpcUrls, txHash, view } from "./lib/near.js";

// Code-only upgrade: one deployContract action, no `new` call, so vault state is kept.

const DRY = process.argv.includes("--dry-run");
const WASM = path.join(REPO_ROOT, "target/near/lineage_vault/lineage_vault.wasm");

class UpgradeError extends Error {}

interface ConfigView {
  mode: string;
  balance: string;
  task_count: number;
  payment_count: number;
}

async function main(): Promise<void> {
  const d = readDeployment(DEFAULT_DEPLOYMENT_FILE);
  const n = namesFor(d.root);
  const provider = makeProvider();
  console.log(`Lineage vault upgrade${DRY ? " (DRY RUN: nothing is signed)" : ""} · root ${d.root} · RPC ${rpcUrls()[0]}\n`);

  if (!fs.existsSync(WASM)) throw new UpgradeError(`missing ${path.relative(REPO_ROOT, WASM)}; run \`npm run build\` first`);
  const wasm = new Uint8Array(fs.readFileSync(WASM));
  const localHash = baseEncode(crypto.createHash("sha256").update(wasm).digest());
  step(`local vault wasm ${path.relative(REPO_ROOT, WASM)} (${(wasm.length / 1000).toFixed(1)} KB), code hash ${localHash}`);

  const signer = DRY ? null : KeyPairSigner.fromSecretKey(loadRootKey(d.root));

  for (const v of VAULTS) {
    const id = n[v];
    const onChain = (await provider.viewAccount({ accountId: id })).code_hash;
    if (onChain === localHash) {
      skip(`${id} already runs ${localHash}`);
      continue;
    }
    step(`upgrading ${id}: ${onChain} → ${localHash} (deployContract only, state kept)`);
    if (!signer) {
      info(`(dry run) would send: [deployContract(${(wasm.length / 1000).toFixed(1)} KB)] → ${id}, signed by ${d.root}'s key`);
      continue;
    }
    const res = await new Account(id, provider, signer).signAndSendTransaction({
      receiverId: id,
      actions: [actions.deployContract(wasm)],
      waitUntil: "FINAL",
    });
    info(explorerTx(txHash(res)));
    const after = (await provider.viewAccount({ accountId: id })).code_hash;
    if (after !== localHash) throw new UpgradeError(`${id} code hash is ${after} after upgrade, expected ${localHash}`);
    const cfg = await view<ConfigView>(provider, id, "get_config");
    info(`old state readable: mode ${cfg.mode}, balance ${fmtUsdc(cfg.balance)}, ${cfg.task_count} tasks, ${cfg.payment_count} payments`);
  }

  console.log(DRY ? "\nDry run complete. Nothing was signed." : "\nDone. Next: npm run verify:deploy");
}

main().catch((e) => {
  console.error(`\n✘ ${e instanceof UpgradeError || e instanceof RootKeyError ? e.message : errorMessage(e)}`);
  process.exit(1);
});
