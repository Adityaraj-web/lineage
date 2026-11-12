import fs from "node:fs";
import path from "node:path";

export const INBOX_DIR = path.join(import.meta.dirname, "inbox");

export interface Message {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  body: string;
}

export function parseMessage(id: string, text: string): Message {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blank = lines.findIndex((l) => l.trim() === "");
  const headerLines = blank < 0 ? lines : lines.slice(0, blank);
  const headers = new Map<string, string>();
  for (const line of headerLines) {
    const m = /^([A-Za-z-]+):\s*(.*)$/.exec(line);
    if (m) headers.set(m[1].toLowerCase(), m[2].trim());
  }
  const from = headers.get("from") ?? "";
  return {
    id,
    from,
    fromName: from.split("<")[0].trim(),
    subject: headers.get("subject") ?? "",
    body: blank < 0 ? "" : lines.slice(blank + 1).join("\n").trim(),
  };
}

// Untrusted text: only {{root}} is substituted so the demo works for any deployer.
export function loadInbox(root: string, dir = INBOX_DIR): Message[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => parseMessage(f.replace(/\.md$/, ""), fs.readFileSync(path.join(dir, f), "utf8").replaceAll("{{root}}", root)));
}
