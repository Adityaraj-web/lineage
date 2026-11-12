import type { Message } from "./inbox.js";
import type { Mandate, Planner, ToolCall } from "./tools.js";

const SERVICE = /"([a-z0-9][a-z0-9_-]*)"/;
const CEILING = /\bup to (\d+(?:\.\d+)?)\s*tUSDC\b/i;
const ACCOUNT = /\b[a-z0-9_-]+(\.[a-z0-9_-]+)*\.testnet\b/;
const AMOUNT = /(\d+(?:\.\d+)?)\s*tUSDC\b/;

export const payeeName = (label: string): string => label.split(" — ")[0].trim();

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

// Deliberately naive: trusts a payout address written in an invoice.
function planMessage(m: Message, mandate: Mandate): ToolCall | null {
  const call = (tool: string, args: Record<string, unknown>): ToolCall => ({
    message: m.id,
    tool,
    args: { ...args, memo: m.subject },
  });

  const service = SERVICE.exec(m.body);
  const ceiling = CEILING.exec(m.body);
  if (service && ceiling) {
    return call("pay_registered_service", { reference: service[1], max_price: ceiling[1] });
  }

  const amount = AMOUNT.exec(m.body)?.[1];
  const account = ACCOUNT.exec(m.body)?.[0];
  if (account) {
    return amount ? call("pay_account", { account_id: account, amount }) : null;
  }

  const signed = mandate.signedPayees.find((p) => norm(payeeName(p.label)) === norm(m.fromName));
  if (signed) {
    return amount ? call("pay_signed_payee", { slot: signed.slot, amount }) : null;
  }

  return null;
}

export const scriptedPlanner: Planner = (inbox, mandate) =>
  inbox.map((m) => planMessage(m, mandate)).filter((c): c is ToolCall => c !== null);
