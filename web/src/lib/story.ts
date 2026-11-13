import type { DemoRun } from "./config";
import { fmtUsdc } from "./format";
import type { PaymentRow, TaskRow, VaultView } from "./views";

export type StoryTone = "neutral" | "p1" | "p3" | "attacker";

export interface StoryStep {
  text: string;
  tone: StoryTone;
}

export interface StoryStrip {
  emails: number;
  asked: number;
  paid: number;
  held: number;
  rejected: number;
  paidAttacker: boolean;
  steps: StoryStep[];
  sentence: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function joinSentence(parts: string[]): string {
  if (parts.length === 0) return "";
  const s = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `${s}.`;
}

// What the agent did in the latest demo run on this vault: demo-run.json for what it read and asked,
// the live payments of that task for what happened to each request.
export function storyStrip(view: VaultView, demoRun: DemoRun): StoryStrip | null {
  const run = demoRun.vaults[view.key];
  if (!run) return null;
  const ids = new Set(run.payments.flatMap((r) => (r.payment ? [r.payment.id] : [])));
  const live = view.payments
    .map((r) => r.payment)
    .filter((p) => p.task_id === run.taskId && ids.has(p.id));
  const emails = run.payments.length;
  const asked = ids.size;
  const paid = live.filter((p) => p.status === "Paid").length;
  const held = live.filter((p) => p.status === "AwaitingApproval").length;
  const rejected = live.filter((p) => p.status === "Rejected").length;
  const paidAttacker = live.some((p) => p.status === "Paid" && p.payee === demoRun.attacker.account);

  const steps: StoryStep[] = [
    { text: `Read ${plural(emails, "email", "emails")}`, tone: "neutral" },
    { text: `asked for ${plural(asked, "payment", "payments")}`, tone: "neutral" },
  ];
  if (paid > 0) {
    const all = paid === asked && asked > 1 ? `paid all ${paid}` : `paid ${paid}`;
    steps.push(
      paidAttacker
        ? { text: `${all}, including the attacker`, tone: "attacker" }
        : { text: all, tone: "p1" },
    );
  }
  if (held > 0) steps.push({ text: `held ${held} for you`, tone: "p3" });
  if (rejected > 0) steps.push({ text: `held ${rejected}, rejected by you`, tone: "neutral" });

  return { emails, asked, paid, held, rejected, paidAttacker, steps, sentence: joinSentence(steps.map((s) => s.text)) };
}

export interface AttackerPayments {
  total: bigint;
  totalText: string;
  runs: number;
  runsText: string;
  payments: PaymentRow[];
}

// Everything this vault actually paid to the attacker, over every task (each demo run is a task).
export function attackerPayments(view: VaultView, attacker: string): AttackerPayments {
  const payments = view.payments.filter((r) => r.payment.status === "Paid" && r.payment.payee === attacker);
  const total = payments.reduce((sum, r) => sum + BigInt(r.payment.amount), 0n);
  const runs = new Set(payments.map((r) => r.payment.task_id)).size;
  return {
    total,
    totalText: fmtUsdc(total),
    runs,
    runsText: runs === 1 ? "in 1 run" : `across ${runs} runs`,
    payments,
  };
}

// The latest demo-run task up front; the rest (verify fixture, earlier runs) folded, newest first.
export function splitTasks(view: VaultView): { latest: TaskRow | null; earlier: TaskRow[] } {
  const [latest = null, ...earlier] = [...view.tasks].sort((a, b) => b.task.id - a.task.id);
  return { latest, earlier };
}
