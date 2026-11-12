import { toRequestArgs, type Mandate, type RequestArgs, type ToolCall } from "./tools.js";
import type { LineageEvent, Payment } from "./vault-types.js";

export interface Executed {
  payment: Payment;
  txHash: string;
  events: LineageEvent[];
}

export type Execute = (args: RequestArgs) => Promise<Executed>;

export type StepOutcome =
  | { kind: "rejected"; reason: string }
  | ({ kind: "sent" } & Executed)
  | { kind: "error"; message: string };

export interface Step {
  call: ToolCall;
  args: RequestArgs | null;
  outcome: StepOutcome;
}

// Gets an executor already bound to one agent signer and one vault; never sees an owner key.
export async function runPlan(
  plan: ToolCall[],
  ctx: { mandate: Mandate; taskId: number; execute: Execute },
): Promise<Step[]> {
  const steps: Step[] = [];
  for (const call of plan) {
    const checked = toRequestArgs(call, ctx);
    if (!checked.ok) {
      steps.push({ call, args: null, outcome: { kind: "rejected", reason: checked.reason } });
      continue;
    }
    try {
      const executed = await ctx.execute(checked.value);
      steps.push({ call, args: checked.value, outcome: { kind: "sent", ...executed } });
    } catch (e) {
      const message = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
      steps.push({ call, args: checked.value, outcome: { kind: "error", message } });
    }
  }
  return steps;
}
