import type { Task } from "../shared/vault-types";
import { ONE_YOCTO, type OwnerTx } from "./actions";
import type { TxResult } from "./tx";

export const TASK_GAS = "50000000000000";
export const INSTRUCTION_MAX_BYTES = 1000;
export const LABEL_MAX = 64;
export const BUDGET_MAX = 10_000n * 1_000_000n;
export const TTL_OPTIONS = [60, 1440, 10080, 20160] as const;

export interface MandateForm {
  agent: string;
  instruction: string;
  budget: string;
  maxPerPayment: string;
  ttlMinutes: number;
  payees: { accountId: string; max: string; label: string }[];
  resolvers: string[];
}
export interface CreateTaskArgs {
  agent: string;
  instruction: string;
  budget: string;
  max_per_payment: string;
  ttl_minutes: number;
  signed_payees: { account_id: string; max_amount: string; label: string }[];
  resolvers: string[];
}
export type FieldErrors = Partial<Record<string, string>>;

const USDC_RE = /^\d+(\.\d{1,6})?$/;
const ACCOUNT_RE = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const U32_MAX = 0xffffffff;
const MAX_PAYEES = 20;
const MAX_RESOLVERS = 5;
const UNIT = 1_000_000n;

export function parseUsdc(s: string): bigint | null {
  const t = s.trim();
  if (!USDC_RE.test(t)) return null;
  const [int, frac = ""] = t.split(".");
  return BigInt(int) * UNIT + BigInt(frac.padEnd(6, "0"));
}

export function toUsdcInput(base: string): string {
  const n = BigInt(base);
  const frac = (n % UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${n / UNIT}.${frac}` : `${n / UNIT}`;
}

export function isAccountId(s: string): boolean {
  return s.length >= 2 && s.length <= 64 && ACCOUNT_RE.test(s);
}

function accountError(s: string): string | null {
  if (isAccountId(s)) return null;
  if (s === "") return "Required";
  if (s !== s.toLowerCase() && isAccountId(s.toLowerCase())) return "Use lowercase";
  return "Not a valid account id";
}

function amountError(s: string, cap: bigint | null, capName: string): { value: bigint | null; error: string | null } {
  if (s.trim() === "") return { value: null, error: "Required" };
  const v = parseUsdc(s);
  if (v === null) return { value: null, error: "Use a number with up to 6 decimals" };
  if (v <= 0n) return { value: null, error: "Must be more than 0" };
  if (cap !== null && v > cap) return { value: null, error: `Can't exceed ${capName}` };
  return { value: v, error: null };
}

export function validateMandate(f: MandateForm): { ok: true; args: CreateTaskArgs } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const agent = f.agent.trim();
  const agentErr = accountError(agent);
  if (agentErr) errors.agent = agentErr;

  const instruction = f.instruction.trim();
  if (instruction === "") errors.instruction = "Required";
  else if (new TextEncoder().encode(instruction).length > INSTRUCTION_MAX_BYTES) errors.instruction = `Too long (max ${INSTRUCTION_MAX_BYTES} bytes)`;

  const budget = amountError(f.budget, BUDGET_MAX, "10,000 tUSDC");
  if (budget.error) errors.budget = budget.error;
  const cap = budget.value;

  const max = amountError(f.maxPerPayment, cap, "the budget");
  if (max.error) errors.maxPerPayment = max.error;

  if (!(TTL_OPTIONS as readonly number[]).includes(f.ttlMinutes)) errors.ttlMinutes = "Pick an expiry";

  const payeeRows = f.payees
    .map((p, i) => ({ i, accountId: p.accountId.trim(), max: p.max.trim(), label: p.label.trim() }))
    .filter((p) => p.accountId !== "" || p.max !== "" || p.label !== "");
  if (payeeRows.length > MAX_PAYEES) errors.payees = `At most ${MAX_PAYEES} payees`;
  const seenPayees = new Set<string>();
  const signed_payees: CreateTaskArgs["signed_payees"] = [];
  for (const p of payeeRows) {
    const accErr = accountError(p.accountId) ?? (seenPayees.has(p.accountId) ? "Already listed" : null);
    if (accErr) errors[`payees.${p.i}.accountId`] = accErr;
    seenPayees.add(p.accountId);
    const pm = amountError(p.max, cap, "the budget");
    if (pm.error) errors[`payees.${p.i}.max`] = pm.error;
    const len = Array.from(p.label).length;
    if (len === 0) errors[`payees.${p.i}.label`] = "Required";
    else if (len > LABEL_MAX) errors[`payees.${p.i}.label`] = `At most ${LABEL_MAX} characters`;
    if (pm.value !== null) signed_payees.push({ account_id: p.accountId, max_amount: pm.value.toString(), label: p.label });
  }

  const resolverRows = f.resolvers.map((r, i) => ({ i, id: r.trim() })).filter((r) => r.id !== "");
  if (resolverRows.length > MAX_RESOLVERS) errors.resolvers = `At most ${MAX_RESOLVERS} resolvers`;
  const seenResolvers = new Set<string>();
  for (const r of resolverRows) {
    const err = accountError(r.id) ?? (seenResolvers.has(r.id) ? "Already listed" : null);
    if (err) errors[`resolvers.${r.i}`] = err;
    seenResolvers.add(r.id);
  }

  if (Object.keys(errors).length > 0 || budget.value === null || max.value === null) return { ok: false, errors };
  return {
    ok: true,
    args: {
      agent,
      instruction,
      budget: budget.value.toString(),
      max_per_payment: max.value.toString(),
      ttl_minutes: f.ttlMinutes,
      signed_payees,
      resolvers: resolverRows.map((r) => r.id),
    },
  };
}

export function createTaskTx(vault: string, args: CreateTaskArgs): OwnerTx {
  return {
    receiverId: vault,
    actions: [{ type: "FunctionCall", params: { methodName: "create_task", args: { ...args }, gas: TASK_GAS, deposit: ONE_YOCTO } }],
  };
}

export function demoMandateForm(task0: Task): MandateForm {
  const minutes = (task0.expires_at_ms - task0.created_at_ms) / 60_000;
  return {
    agent: task0.agent,
    instruction: task0.instruction,
    budget: toUsdcInput(task0.budget),
    maxPerPayment: toUsdcInput(task0.max_per_payment),
    ttlMinutes: (TTL_OPTIONS as readonly number[]).includes(minutes) ? minutes : 1440,
    payees: task0.signed_payees.map((p) => ({ accountId: p.account_id, max: toUsdcInput(p.max_amount), label: p.label })),
    resolvers: [...task0.resolvers],
  };
}

export function createdTaskId(result: TxResult): number | null {
  if (!result.ok || !result.value) return null;
  let v: unknown;
  try {
    v = JSON.parse(result.value);
  } catch {
    return null;
  }
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= U32_MAX ? v : null;
}

export function emptyMandateForm(agent: string, registry: string): MandateForm {
  return { agent, instruction: "", budget: "", maxPerPayment: "", ttlMinutes: 1440, payees: [], resolvers: [registry] };
}
