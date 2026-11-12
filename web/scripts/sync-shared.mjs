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

// The demo inbox the agent reads, as raw text: lib/emails.ts parses it, the UI renders it as text.
const inboxDir = path.join(repo, "agent", "inbox");
const inbox = fs
  .readdirSync(inboxDir)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => ({ id: f.replace(/\.md$/, ""), raw: fs.readFileSync(path.join(inboxDir, f), "utf8") }));
fs.writeFileSync(path.join(out, "inbox.json"), `${JSON.stringify(inbox, null, 2)}\n`);

console.log(`sync-shared: ${files.join(", ")}, agent/inbox (${inbox.length}) → src/shared/`);
