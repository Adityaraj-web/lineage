import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { KeyPairString } from "near-api-js";

export class RootKeyError extends Error {}

// Owner-side only. Never import from the agent code path (agent.ts, executor.ts, planner-*.ts).
export function loadRootKey(root: string): KeyPairString {
  if (process.env.LINEAGE_ROOT_KEY) return process.env.LINEAGE_ROOT_KEY as KeyPairString;
  const file = path.join(os.homedir(), ".near-credentials", "testnet", `${root}.json`);
  if (!fs.existsSync(file)) {
    throw new RootKeyError(`no key for ${root}: set LINEAGE_ROOT_KEY or create ${file}`);
  }
  const key = JSON.parse(fs.readFileSync(file, "utf8")).private_key;
  if (!key) throw new RootKeyError(`${file} has no private_key field`);
  return key as KeyPairString;
}
