import type { Payment, Task } from "../shared/vault-types";
import type { PayeeStats } from "./chain";
import { fmtDate, fmtUsdc } from "./format";
import { provenanceBadge } from "./provenance";
import type { VaultMode } from "./config";
import type { AccountInfo } from "./rpc";

export type FindingId =
  | "untrusted-source"
  | "not-signed"
  | "signed-match"
  | "account-missing"
  | "contract-account"
  | "plain-account"
  | "never-paid"
  | "paid-before"
  | "duplicate-reference"
  | "pressure-language"
  | "near-cap";

export type FindingTone = "danger" | "warn" | "info" | "ok";
export type RiskLevel = "high" | "medium" | "low";

export interface Finding {
  id: FindingId;
  tone: FindingTone;
  text: string;
  short: string;
  // duplicate-reference only: the shared token and the earlier payment that carried it.
  ref?: { token: string; paymentId: number };
}

export interface RiskCard {
  level: RiskLevel;
  findings: Finding[];
  summary: string;
  advice: string | null;
}

export interface RiskFacts {
  payment: Payment;
  task: Task | null;
  mode: VaultMode;
  taskPayments: Payment[];
  account: AccountInfo;
  stats: PayeeStats;
}

export const RISK_DISCLAIMER = "The vault already refused to auto-pay this. This card helps you decide.";
export const HIGH_ADVICE = "Reject unless you confirmed the new address with the payee through a channel the agent didn't use.";

export const MEDIUM_ADVICE = "Check the payee with the sender through a channel the agent didn't use before you approve.";

const INVOICE_TOKEN = /\b[A-Z]{1,5}-\d{1,8}\b/g;
const PRESSURE =
  /\b(new|changed?|updated?)\b.{0,20}\b(payout|bank|wallet|payment|account)\b|\burgent\b|\blate fee\b/i;

const tokens = (memo: string): string[] => [...new Set(memo.match(INVOICE_TOKEN) ?? [])];

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function assessPayment(facts: RiskFacts): RiskCard {
  const { payment, task, mode, taskPayments, account, stats } = facts;
  const payee = payment.payee ?? "(unresolved payee)";
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  if (payment.provenance === "Untrusted") {
    add({
      id: "untrusted-source",
      tone: "danger",
      text: "The agent took this address from a message it read. You did not sign it, and no resolver you pinned returned it.",
      short: "the address came from a message the agent read",
    });
  }

  const signed = task?.signed_payees ?? [];
  const match = signed.find((s) => s.account_id === payment.payee);
  if (match) {
    add({
      id: "signed-match",
      tone: "ok",
      text: `${payee} is a payee you signed: ${match.label}, up to ${fmtUsdc(match.max_amount)}.`,
      short: "it's a payee you signed",
    });
  } else {
    const list = signed.map((s) => `${s.label} → ${s.account_id}`).join("; ");
    add({
      id: "not-signed",
      tone: "warn",
      text: `${payee} is not a payee you signed for this task. ${list ? `You signed: ${list}.` : "This task has no signed payees."}`,
      short: "it isn't a payee you signed",
    });
  }

  if (!account.exists) {
    add({
      id: "account-missing",
      tone: "danger",
      text: `${payee} does not exist on NEAR testnet.`,
      short: "the payee account doesn't exist",
    });
  } else if (account.isContract) {
    add({
      id: "contract-account",
      tone: "warn",
      text: `${payee} is a smart contract, not a plain wallet.`,
      short: "the payee is a contract",
    });
  } else {
    add({
      id: "plain-account",
      tone: "info",
      text: `${payee} is a plain account with no contract code.`,
      short: "it's a plain account",
    });
  }

  if (stats.payments === 0) {
    add({ id: "never-paid", tone: "warn", text: `This vault has never paid ${payee}.`, short: "this vault has never paid it" });
  } else {
    const n = stats.payments;
    add({
      id: "paid-before",
      tone: "info",
      text: `This vault has paid ${payee} before: ${n} ${n === 1 ? "payment" : "payments"}, ${fmtUsdc(stats.total)} in total, last on ${fmtDate(stats.last_paid_at_ms)}.`,
      short: "this vault has paid it before",
    });
  }

  dup: for (const token of tokens(payment.memo)) {
    for (const other of taskPayments) {
      if (other.id === payment.id || other.task_id !== payment.task_id) continue;
      if (other.status !== "Paid" && other.status !== "Sending") continue;
      if (!other.payee || other.payee === payment.payee) continue;
      if (!tokens(other.memo).includes(token)) continue;
      const b = provenanceBadge(other, task, mode);
      add({
        id: "duplicate-reference",
        tone: "danger",
        text: `Invoice ${token} was already paid in this task to ${other.payee} (${b.code}, ${b.label.toLowerCase()}, ${fmtUsdc(other.amount)}).`,
        short: `invoice ${token} was already paid in this task to ${other.payee}`,
        ref: { token, paymentId: other.id },
      });
      break dup;
    }
  }

  if (PRESSURE.test(payment.memo)) {
    add({
      id: "pressure-language",
      tone: "warn",
      text: "The memo claims the payout details changed or pushes urgency, a common invoice-fraud pattern.",
      short: "the memo pushes new payout details or urgency",
    });
  }

  if (task && BigInt(payment.amount) * 10n >= BigInt(task.max_per_payment) * 9n) {
    const pct = (BigInt(payment.amount) * 100n) / BigInt(task.max_per_payment || "1");
    add({
      id: "near-cap",
      tone: "info",
      text: `${fmtUsdc(payment.amount)} is ${pct}% of this task's ${fmtUsdc(task.max_per_payment)} per-payment cap.`,
      short: "the amount is close to the per-payment cap",
    });
  }

  const danger = findings.filter((f) => f.tone === "danger");
  const warn = findings.filter((f) => f.tone === "warn");
  const level: RiskLevel = danger.length ? "high" : warn.length ? "medium" : "low";
  let summary: string;
  if (level === "low") {
    const ok = findings.filter((f) => f.tone === "ok").map((f) => f.short);
    summary = ok.length ? `Nothing stands out: ${joinClauses(ok)}.` : "Nothing stands out.";
  } else {
    const clauses = [...danger, ...warn].slice(0, 3).map((f) => f.short);
    summary = `${level === "high" ? "Don't pay this yet" : "Check before paying"}: ${joinClauses(clauses)}.`;
  }
  const advice = level === "high" ? HIGH_ADVICE : level === "medium" ? MEDIUM_ADVICE : null;
  return { level, findings, summary, advice };
}
