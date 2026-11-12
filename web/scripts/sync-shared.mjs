import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(web, "..");
const out = path.join(web, "src", "shared");
const files = ["deployments/testnet.json", "deployments/demo-run.json", "agent/vault-types.ts"];

fs.mkdirSync(out, { recursive: true });
for (const rel of files) {
  const src = path.join(repo, rel);
  if (!fs.existsSync(src)) {
    console.error(`sync-shared: missing ${rel}`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(out, path.basename(rel)));
}
console.log(`sync-shared: ${files.join(", ")} → src/shared/`);
