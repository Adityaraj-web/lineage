import { describe, expect, it } from "vitest";
import { announceChanges, diffPayments, fingerprint } from "./changes";
import { p3Translation, p4Alice, p5Poisoned } from "./test-fixtures";

describe("fingerprint", () => {
  it("is equal for equal data, bigints included", () => {
    const a = { total: 49_000_000n, rows: [{ id: 1, s: "Paid" }] };
    const b = { total: 49_000_000n, rows: [{ id: 1, s: "Paid" }] };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it("differs when a bigint differs, even above 2^53", () => {
    expect(fingerprint({ v: 2n ** 60n })).not.toBe(fingerprint({ v: 2n ** 60n + 1n }));
  });
});

describe("diffPayments", () => {
  const before = [p5Poisoned(), p4Alice(), p3Translation()];

  it("marks nothing on the first load", () => {
    expect(diffPayments(null, before).size).toBe(0);
  });

  it("marks nothing when nothing changed", () => {
    const again = [p5Poisoned(), p4Alice(), p3Translation()];
    expect(diffPayments(before, again).size).toBe(0);
  });

  it("marks a new payment as added", () => {
    const six = { ...p4Alice(), id: 6, created_at_ms: 1794479999000, updated_at_ms: 1794479999000 };
    const marks = diffPayments(before, [six, ...before]);
    expect([...marks]).toEqual([[6, { kind: "added" }]]);
  });

  it("marks a status change with from and to", () => {
    const rejected = { ...p5Poisoned("Rejected"), updated_at_ms: p5Poisoned().updated_at_ms + 60_000 };
    const marks = diffPayments(before, [rejected, p4Alice(), p3Translation()]);
    expect([...marks]).toEqual([[5, { kind: "changed", from: "AwaitingApproval", to: "Rejected" }]]);
  });

  it("announces changes in plain words", () => {
    const rejected = p5Poisoned("Rejected");
    const marks = diffPayments(before, [rejected, p4Alice(), p3Translation()]);
    expect(announceChanges(marks)).toBe("Payment #5: Needs you → Rejected.");
    expect(announceChanges(new Map([[6, { kind: "added" as const }]]))).toBe("New payment #6.");
  });
});
