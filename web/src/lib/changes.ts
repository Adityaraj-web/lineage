// Decides what the UI may animate: data changes only, never every poll.
import type { Payment, PaymentStatus } from "../shared/vault-types";
import { statusLabel } from "./provenance";

export function fingerprint(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? `${v}n` : v));
}

export type Mark = { kind: "added" } | { kind: "changed"; from: PaymentStatus; to: PaymentStatus };

const sig = (p: Payment) => `${p.status}|${p.updated_at_ms}|${p.payee}|${p.amount}`;

export function diffPayments(prev: readonly Payment[] | null, next: readonly Payment[]): Map<number, Mark> {
  const marks = new Map<number, Mark>();
  if (prev === null) return marks;
  const before = new Map(prev.map((p) => [p.id, p]));
  for (const p of next) {
    const old = before.get(p.id);
    if (!old) marks.set(p.id, { kind: "added" });
    else if (sig(old) !== sig(p)) marks.set(p.id, { kind: "changed", from: old.status, to: p.status });
  }
  return marks;
}

export function announceChanges(marks: ReadonlyMap<number, Mark>): string {
  return [...marks]
    .map(([id, m]) =>
      m.kind === "added"
        ? `New payment #${id}.`
        : m.from === m.to
          ? `Payment #${id} updated.`
          : `Payment #${id}: ${statusLabel(m.from)} → ${statusLabel(m.to)}.`,
    )
    .join(" ");
}
