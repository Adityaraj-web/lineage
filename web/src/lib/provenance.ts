import type { Payment, PaymentStatus, Task } from "../shared/vault-types";
import type { VaultMode } from "./config";
import { fmtUsdc } from "./format";

export type BadgeTone = "green" | "blue" | "amber" | "grey" | "red";

export interface Badge {
  code: "P1" | "P2" | "P3";
  label: string;
  tone: BadgeTone;
  detail: string;
}

export function provenanceBadge(payment: Payment, task: Task | null, mode: VaultMode): Badge {
  const p = payment.provenance;
  if (p !== "Untrusted" && "UserSigned" in p) {
    const slot = p.UserSigned.slot;
    const signed = task?.signed_payees[slot];
    const detail = !task
      ? `slot ${slot}`
      : signed
        ? `${signed.label}, max ${fmtUsdc(signed.max_amount)} (task #${task.id})`
        : `slot ${slot} (task #${task.id})`;
    return { code: "P1", label: "Signed by you", tone: "green", detail };
  }
  if (p !== "Untrusted") {
    return {
      code: "P2",
      label: "Resolved via registry",
      tone: "blue",
      detail: `${p.Resolved.resolver} → ${p.Resolved.reference}`,
    };
  }
  const p3 = (label: string, tone: BadgeTone, detail = ""): Badge => ({
    code: "P3",
    label: `Untrusted — ${label}`,
    tone,
    detail,
  });
  switch (payment.status) {
    case "Blocked":
    case "Failed":
      return p3("blocked", "grey", payment.reason);
    case "Rejected":
      return p3("rejected by you", "grey", payment.reason);
    case "AwaitingApproval":
      return p3("needs you", "amber", "Raw address from the agent; waits for you");
    case "Paid":
    case "Sending":
      return mode === "LimitsOnly" ? p3("paid without asking", "red") : p3("approved by you", "grey");
    default:
      return { code: "P3", label: "Untrusted", tone: "grey", detail: "" };
  }
}

export function statusLabel(status: PaymentStatus): string {
  return status === "AwaitingApproval" ? "Needs you" : status;
}
