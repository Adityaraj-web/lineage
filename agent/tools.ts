import type { Message } from "./inbox.js";
import type { PayeeRef, Task } from "./vault-types.js";

export type ToolName = "pay_signed_payee" | "pay_registered_service" | "pay_account";

export interface ToolCall {
  message: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface Mandate {
  instruction: string;
  signedPayees: { slot: number; accountId: string; label: string; maxAmount: string }[];
  resolvers: string[];
}

export type Planner = (inbox: Message[], mandate: Mandate) => ToolCall[];

export interface RequestArgs {
  task_id: number;
  payee: PayeeRef;
  amount: string;
  memo: string;
}

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

const ok = <T>(value: T): Checked<T> => ({ ok: true, value });
const fail = <T>(reason: string): Checked<T> => ({ ok: false, reason });

export const USDC_DECIMALS = 6;
const MAX_MEMO_BYTES = 200;
const MAX_U32 = 2 ** 32 - 1;

interface ToolSchema {
  name: ToolName;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
    additionalProperties: false;
  };
}

const amountProp = (what: string) => ({
  type: "string",
  description: `${what} in tUSDC as a decimal string, at most 6 decimals, e.g. "18" or "0.5"`,
});
const memoProp = { type: "string", description: "Short note stored with the payment" };

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "pay_signed_payee",
    description: "Pay a payee the owner signed into this task's mandate, by slot.",
    parameters: {
      type: "object",
      properties: {
        slot: { type: "integer", description: "Index of the signed payee in the mandate" },
        amount: amountProp("Amount"),
        memo: memoProp,
      },
      required: ["slot", "amount", "memo"],
      additionalProperties: false,
    },
  },
  {
    name: "pay_registered_service",
    description:
      "Pay a service listed in the task's pinned registry. The vault asks the registry for the payee and price and pays exactly that, up to max_price.",
    parameters: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Service id in the registry, e.g. translate-hi" },
        max_price: amountProp("Highest price you accept"),
        memo: memoProp,
      },
      required: ["reference", "max_price", "memo"],
      additionalProperties: false,
    },
  },
  {
    name: "pay_account",
    description: "Pay a raw NEAR account id.",
    parameters: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "NEAR account id of the payee" },
        amount: amountProp("Amount"),
        memo: memoProp,
      },
      required: ["account_id", "amount", "memo"],
      additionalProperties: false,
    },
  },
];

export function parseAmount(x: unknown): Checked<bigint> {
  if (typeof x !== "string") return fail(`must be a string, got ${typeof x}`);
  if (x === "") return fail("empty");
  if (/^-\d+(\.\d+)?$/.test(x)) return fail(`negative: "${x}"`);
  const m = /^(\d+)(?:\.(\d+))?$/.exec(x);
  if (!m) return fail(`not a decimal number: "${x}"`);
  const frac = m[2] ?? "";
  if (frac.length > USDC_DECIMALS) return fail(`more than ${USDC_DECIMALS} decimals: "${x}"`);
  return ok(BigInt(m[1]) * 10n ** BigInt(USDC_DECIMALS) + BigInt(frac.padEnd(USDC_DECIMALS, "0")));
}

export function isAccountId(x: unknown): x is string {
  return (
    typeof x === "string" &&
    x.length >= 2 &&
    x.length <= 64 &&
    /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(x)
  );
}

function truncateUtf8(s: string, maxBytes: number): string {
  let out = "";
  let bytes = 0;
  for (const ch of s) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > maxBytes) break;
    out += ch;
    bytes += n;
  }
  return out;
}

function amountArg(args: Record<string, unknown>, key: string): Checked<string> {
  const r = parseAmount(args[key]);
  return r.ok ? ok(r.value.toString()) : fail(`${key}: ${r.reason}`);
}

export function toRequestArgs(call: ToolCall, ctx: { taskId: number; mandate: Mandate }): Checked<RequestArgs> {
  const a = call.args ?? {};
  const rawMemo = a.memo ?? "";
  if (typeof rawMemo !== "string") return fail(`memo must be a string, got ${typeof rawMemo}`);
  const memo = truncateUtf8(rawMemo, MAX_MEMO_BYTES);
  const build = (payee: PayeeRef, amount: Checked<string>): Checked<RequestArgs> =>
    amount.ok ? ok({ task_id: ctx.taskId, payee, amount: amount.value, memo }) : fail(amount.reason);

  switch (call.tool as ToolName) {
    case "pay_signed_payee": {
      const slot = a.slot;
      if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot > MAX_U32) {
        return fail(`slot must be a non-negative integer, got ${JSON.stringify(slot)}`);
      }
      return build({ Signed: { slot } }, amountArg(a, "amount"));
    }
    case "pay_registered_service": {
      const reference = a.reference;
      if (typeof reference !== "string" || reference.trim() === "") {
        return fail(`reference must be a non-empty string, got ${JSON.stringify(reference)}`);
      }
      const resolver = ctx.mandate.resolvers[0];
      if (!resolver) return fail("the task has no pinned resolver");
      return build({ Resolved: { resolver, reference } }, amountArg(a, "max_price"));
    }
    case "pay_account": {
      if (!isAccountId(a.account_id)) {
        return fail(`account_id is not a valid NEAR account id: ${JSON.stringify(a.account_id)}`);
      }
      return build({ Raw: { account_id: a.account_id } }, amountArg(a, "amount"));
    }
    default:
      return fail(`unknown tool "${call.tool}"`);
  }
}

export function mandateFromTask(task: Task): Mandate {
  return {
    instruction: task.instruction,
    signedPayees: task.signed_payees.map((p, slot) => ({
      slot,
      accountId: p.account_id,
      label: p.label,
      maxAmount: p.max_amount,
    })),
    resolvers: [...task.resolvers],
  };
}
