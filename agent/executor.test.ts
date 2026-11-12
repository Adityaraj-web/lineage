import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEvents } from "./executor.js";

const ev = (event: string, id: number) => ({ standard: "lineage", version: "1.0.0", event, data: [{ id }] });
const log = (o: unknown) => `EVENT_JSON:${JSON.stringify(o)}`;
const receipt = (logs: string[]) => ({ outcome: { logs } });

test("parseEvents: lineage NEP-297 events from every receipt, in order; other logs ignored", () => {
  const outcome = {
    receipts_outcome: [
      receipt([log(ev("payment_resolving", 4))]),
      receipt(["registry: resolved translate-hi"]),
      receipt([log(ev("payment_sending", 4))]),
      receipt([log({ standard: "nep141", version: "1.0.0", event: "ft_transfer", data: [] })]),
      receipt(["EVENT_JSON:{not json", log(ev("payment_paid", 4))]),
    ],
  };
  assert.deepEqual(parseEvents(outcome), [ev("payment_resolving", 4), ev("payment_sending", 4), ev("payment_paid", 4)]);
});

test("parseEvents: no receipts, no events", () => {
  assert.deepEqual(parseEvents({ receipts_outcome: [] }), []);
});
