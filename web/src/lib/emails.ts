// The demo inbox (agent/inbox/*.md): untrusted text, rendered only as React text nodes.
export interface Email {
  id: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  excerpt: string;
  body: string;
}

const MIN_LINE = 20;

export function parseEmail(id: string, raw: string, root: string): Email {
  const text = raw.replaceAll("{{root}}", root).replace(/\r\n/g, "\n");
  const split = text.indexOf("\n\n");
  const hasHeader = /^[A-Za-z-]+:/.test(text) && split > 0;
  const head = hasHeader ? text.slice(0, split) : "";
  const body = (hasHeader ? text.slice(split + 2) : text).trim();
  const header = (name: string) => head.match(new RegExp(`^${name}:\\s*(.*)$`, "mi"))?.[1].trim() ?? "";

  const from = header("From");
  const m = from.match(/^(.*?)\s*<([^>]*)>\s*$/);
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").trim());
  const first = paragraphs.find((p) => p.length >= MIN_LINE) ?? paragraphs[0] ?? "";
  const excerpt = first.match(/^.*?[.?!](?=\s|$)/)?.[0] ?? first;

  return {
    id,
    fromName: m ? m[1].replace(/^"|"$/g, "") : from,
    fromAddress: m ? m[2] : "",
    subject: header("Subject"),
    excerpt,
    body,
  };
}
