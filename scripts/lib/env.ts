import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
export const ENV_LOCAL = path.join(REPO_ROOT, ".env.local");

// Shell environment wins over .env.local.
dotenv.config({ path: ENV_LOCAL, quiet: true });

export function upsertEnvLocal(key: string, value: string): void {
  const lines = fs.existsSync(ENV_LOCAL) ? fs.readFileSync(ENV_LOCAL, "utf8").split("\n") : [];
  const entry = `${key}=${value}`;
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = entry;
  else {
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    lines.push(entry, "");
  }
  fs.writeFileSync(ENV_LOCAL, lines.join("\n"), { mode: 0o600 });
  fs.chmodSync(ENV_LOCAL, 0o600);
  process.env[key] = value;
}
