import { actions, getTransactionLastResult, teraToGas, type Account } from "near-api-js";
import { view } from "../scripts/lib/near.js";
import type { Execute } from "./agent.js";
import type { LineageEvent, Payment } from "./vault-types.js";

const REQUEST_GAS = teraToGas(150);
const EVENT_PREFIX = "EVENT_JSON:";

export function parseEvents(outcome: { receipts_outcome: { outcome: { logs: string[] } }[] }): LineageEvent[] {
  const events: LineageEvent[] = [];
  for (const r of outcome.receipts_outcome) {
    for (const line of r.outcome.logs) {
      if (!line.startsWith(EVENT_PREFIX)) continue;
      try {
        const e = JSON.parse(line.slice(EVENT_PREFIX.length));
        if (e?.standard === "lineage") events.push(e as LineageEvent);
      } catch {
        // not NEP-297 JSON
      }
    }
  }
  return events;
}

// The agent account must carry only its function-call key (receiver = vaultId, method = request_payment).
export function makeExecutor(agent: Account, vaultId: string): Execute {
  return async (args) => {
    const res = await agent.signAndSendTransaction({
      receiverId: vaultId,
      actions: [actions.functionCall("request_payment", { ...args }, REQUEST_GAS, 0n)],
      waitUntil: "FINAL",
    });
    const txHash = res.transaction.hash;
    const last = getTransactionLastResult(res) as Payment | null;
    if (!last || typeof last.id !== "number") {
      throw new Error(`request_payment returned no Payment (tx ${txHash})`);
    }
    const payment = await view<Payment | null>(agent.provider, vaultId, "get_payment", { payment_id: last.id });
    if (!payment) throw new Error(`get_payment(${last.id}) returned null (tx ${txHash})`);
    return { payment, txHash, events: parseEvents(res) };
  };
}
