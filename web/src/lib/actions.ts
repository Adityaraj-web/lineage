import type { RiskCard } from "./risk";

// Same shape as NEAR Connect's ConnectorAction for a function call.
export interface FunctionCallAction {
  type: "FunctionCall";
  params: { methodName: string; args: Record<string, unknown>; gas: string; deposit: string };
}
export interface OwnerTx {
  receiverId: string;
  actions: [FunctionCallAction];
}

export const ONE_YOCTO = "1";
export const GAS = { approve: "100000000000000", reject: "30000000000000", freeze: "30000000000000", unfreeze: "30000000000000" } as const;
export const REJECT_REASON_MAX = 140;
const REJECT_FALLBACK = "Rejected by owner";
const U32_MAX = 0xffffffff;

function call(vault: string, methodName: string, args: Record<string, unknown>, gas: string, deposit: string): OwnerTx {
  return { receiverId: vault, actions: [{ type: "FunctionCall", params: { methodName, args, gas, deposit } }] };
}

function paymentId(id: number): number {
  if (!Number.isInteger(id) || id < 0 || id > U32_MAX) throw new Error(`Invalid payment id: ${id}`);
  return id;
}

export function approveTx(vault: string, id: number): OwnerTx {
  return call(vault, "approve_payment", { payment_id: paymentId(id) }, GAS.approve, ONE_YOCTO);
}

export function rejectTx(vault: string, id: number, reason: string): OwnerTx {
  const cut = Array.from(reason.trim()).slice(0, REJECT_REASON_MAX).join("").trimEnd();
  return call(vault, "reject_payment", { payment_id: paymentId(id), reason: cut || REJECT_FALLBACK }, GAS.reject, ONE_YOCTO);
}

export function freezeTx(vault: string): OwnerTx {
  return call(vault, "freeze", {}, GAS.freeze, "0");
}

export function unfreezeTx(vault: string): OwnerTx {
  return call(vault, "unfreeze", {}, GAS.unfreeze, ONE_YOCTO);
}

export function defaultRejectReason(risk: RiskCard): string {
  return risk.level === "high"
    ? "Payee not in the signed mandate; payout change not confirmed with the payee"
    : "Not approved by owner";
}
