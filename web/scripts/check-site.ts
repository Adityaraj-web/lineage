// Read-only smoke check of a deployed static site: npm run check:site -- <base-url>
import { pathToFileURL } from "node:url";

export const PAGES = ["/", "/vault/vault", "/vault/guarded", "/compare"] as const;
export const FOOTER = "Live data from NEAR testnet.";
export const FORBIDDEN = ["fakewallet", "bg=old", "palette-f07"] as const;

export function pageProblems(status: number, contentType: string | null, html: string): string[] {
  const problems: string[] = [];
  if (status !== 200) problems.push(`status ${status}`);
  if (contentType === null) problems.push("content-type missing");
  else if (!contentType.toLowerCase().includes("text/html")) problems.push(`content-type ${contentType}`);
  if (!html.includes(FOOTER)) problems.push(`no "${FOOTER}"`);
  for (const m of FORBIDDEN) if (html.includes(m)) problems.push(`contains "${m}"`);
  return problems;
}

function baseUrl(arg: string | undefined): string | null {
  if (!arg) return null;
  try {
    const u = new URL(arg);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function reason(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cause = e.cause instanceof Error ? ((e.cause as NodeJS.ErrnoException).code ?? e.cause.message) : null;
  return cause ? `${e.message} (${cause})` : `${e.name}: ${e.message}`;
}

async function main(): Promise<number> {
  const base = baseUrl(process.argv[2]);
  if (!base) {
    console.log("usage: npm --prefix web run check:site -- <http(s)://base-url>");
    return 1;
  }
  console.log(`Lineage site check · ${base}\n`);
  let passed = 0;
  for (const p of PAGES) {
    try {
      const res = await fetch(base + p, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const problems = pageProblems(res.status, res.headers.get("content-type"), await res.text());
      if (problems.length === 0) {
        passed++;
        console.log(`✔ ${p}`);
      } else console.log(`✘ ${p} — ${problems.join("; ")}`);
    } catch (e) {
      console.log(`✘ ${p} — ${reason(e)}`);
    }
  }
  console.log(`\n${passed}/${PAGES.length} pages passed`);
  return passed === PAGES.length ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => (process.exitCode = code));
}
