import { describe, expect, it } from "vitest";
import {
  GAS,
  ONE_YOCTO,
  REJECT_REASON_MAX,
  approveTx,
  defaultRejectReason,
  freezeTx,
  rejectTx,
  unfreezeTx,
  type OwnerTx,
} from "./actions";
import { assessPayment, type RiskCard } from "./risk";
import { GUARDED, NO_STATS, PLAIN_ACCOUNT, VAULT, demoTask, p3Translation, p4Alice, p5Poisoned } from "./test-fixtures";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const deposit = (tx: OwnerTx) => tx.actions[0].params.deposit;

describe("owner action builders", () => {
  it("constants are exact decimal strings", () => {
    expect(ONE_YOCTO).toBe("1");
    expect(GAS).toStrictEqual({
      approve: "100000000000000",
      reject: "30000000000000",
      freeze: "30000000000000",
      unfreeze: "30000000000000",
    });
    expect(REJECT_REASON_MAX).toBe(140);
  });

  it("approveTx: payment_id only, 100 Tgas, exactly 1 yocto", () => {
    expect(approveTx(VAULT, 5)).toStrictEqual({
      receiverId: VAULT,
      actions: [
        {
          type: "FunctionCall",
          params: { methodName: "approve_payment", args: { payment_id: 5 }, gas: "100000000000000", deposit: "1" },
        },
      ],
    });
    expect(deposit(approveTx(VAULT, 0))).toBe("1");
  });

  it("rejectTx: payment_id and reason, 30 Tgas, exactly 1 yocto", () => {
    expect(rejectTx(VAULT, 5, "Not approved by owner")).toStrictEqual({
      receiverId: VAULT,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "reject_payment",
            args: { payment_id: 5, reason: "Not approved by owner" },
            gas: "30000000000000",
            deposit: "1",
          },
        },
      ],
    });
  });

  it("freezeTx: no args, 30 Tgas, zero deposit", () => {
    expect(freezeTx(GUARDED)).toStrictEqual({
      receiverId: GUARDED,
      actions: [{ type: "FunctionCall", params: { methodName: "freeze", args: {}, gas: "30000000000000", deposit: "0" } }],
    });
  });

  it("unfreezeTx: no args, 30 Tgas, exactly 1 yocto", () => {
    expect(unfreezeTx(GUARDED)).toStrictEqual({
      receiverId: GUARDED,
      actions: [{ type: "FunctionCall", params: { methodName: "unfreeze", args: {}, gas: "30000000000000", deposit: "1" } }],
    });
  });

  it("deposits: 1 yocto for every full-access call, 0 only for freeze", () => {
    expect(deposit(approveTx(VAULT, 1))).toBe(ONE_YOCTO);
    expect(deposit(rejectTx(VAULT, 1, "x"))).toBe(ONE_YOCTO);
    expect(deposit(unfreezeTx(VAULT))).toBe(ONE_YOCTO);
    expect(deposit(freezeTx(VAULT))).toBe("0");
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 32])("payment_id %s throws", (id) => {
    expect(() => approveTx(VAULT, id)).toThrow(/payment id/i);
    expect(() => rejectTx(VAULT, id, "x")).toThrow(/payment id/i);
  });

  it("accepts the largest u32 payment id", () => {
    expect(approveTx(VAULT, 2 ** 32 - 1).actions[0].params.args).toStrictEqual({ payment_id: 4294967295 });
  });
});

describe("rejectTx reason", () => {
  const reason = (r: string) => rejectTx(VAULT, 5, r).actions[0].params.args.reason as string;

  it("trims surrounding whitespace", () => {
    expect(reason("  wrong payee \n")).toBe("wrong payee");
  });

  it("whitespace-only and empty become the contract's default text", () => {
    expect(reason(" \t\n ")).toBe("Rejected by owner");
    expect(reason("")).toBe("Rejected by owner");
  });

  it("cuts a 200-char reason to 140 code points without splitting an emoji", () => {
    const long = "a".repeat(139) + "🚨" + "b".repeat(60);
    expect(long.length).toBe(201);
    const r = reason(long);
    expect(Array.from(r)).toHaveLength(140);
    expect(r.endsWith("🚨")).toBe(true);
    expect(LONE_SURROGATE.test(r)).toBe(false);
  });

  it("cuts all-emoji text on code points", () => {
    const r = reason("🔥".repeat(200));
    expect(Array.from(r)).toHaveLength(REJECT_REASON_MAX);
    expect(LONE_SURROGATE.test(r)).toBe(false);
  });

  it("keeps a 140-code-point reason unchanged", () => {
    const exact = "x".repeat(140);
    expect(reason(exact)).toBe(exact);
  });
});

describe("defaultRejectReason", () => {
  const card = (level: RiskCard["level"]): RiskCard => ({ level, findings: [], summary: "", advice: null });

  it("high risk names the missing mandate and unconfirmed payout change", () => {
    const risk = assessPayment({
      payment: p5Poisoned(),
      task: demoTask(),
      mode: "Lineage",
      taskPayments: [p3Translation(), p4Alice(), p5Poisoned()],
      account: PLAIN_ACCOUNT,
      stats: NO_STATS,
    });
    expect(risk.level).toBe("high");
    expect(defaultRejectReason(risk)).toBe("Payee not in the signed mandate; payout change not confirmed with the payee");
  });

  it("medium and low risk use a neutral line", () => {
    expect(defaultRejectReason(card("medium"))).toBe("Not approved by owner");
    expect(defaultRejectReason(card("low"))).toBe("Not approved by owner");
  });

  it("defaults fit the on-chain reason cap", () => {
    for (const level of ["high", "medium", "low"] as const) {
      expect(Array.from(defaultRejectReason(card(level))).length).toBeLessThanOrEqual(REJECT_REASON_MAX);
    }
  });
});
