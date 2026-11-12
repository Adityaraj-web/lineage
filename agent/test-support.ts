import { DEMO, namesFor } from "../scripts/lib/deployment.js";
import type { Payment, Task } from "./vault-types.js";

export const ROOT = "lineage-aditya.testnet";
export const names = namesFor(ROOT);

export function demoTask(id = 0): Task {
  return {
    id,
    agent: names.agentFor.vault,
    instruction: DEMO.task.instruction,
    budget: DEMO.task.budget.toString(),
    spent: "0",
    reserved: "0",
    max_per_payment: DEMO.task.maxPerPayment.toString(),
    created_at_ms: 0,
    expires_at_ms: 0,
    signed_payees: [
      { account_id: names.alice, max_amount: DEMO.task.aliceMax.toString(), committed: "0", label: DEMO.task.aliceLabel },
    ],
    resolvers: [names.registry],
    closed: false,
  };
}

export function payment(p: Partial<Payment> & Pick<Payment, "id" | "status" | "provenance">): Payment {
  return {
    task_id: 1,
    agent: names.agentFor.vault,
    payee: null,
    amount: "0",
    reason: "",
    memo: "",
    created_at_ms: 0,
    updated_at_ms: 0,
    ...p,
  };
}
