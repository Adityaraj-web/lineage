import { describe, expect, it } from "vitest";
import { parseOutcome, walletErrorMessage } from "./tx";

const HASH = "8pDqvWm5DPGbxQoVZRqTiyvqMxgSj2mGbjJVhQwsWPZe";
const OWNER_ONLY = "Smart contract panicked: Owner only";
const NO_RESULT = "The wallet returned no result. The refresh shows what happened.";

const failure = (msg: string) => ({
  Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: msg } } } },
});
const receipt = (status: unknown) => ({ id: "r", outcome: { status, logs: [] } });

const success = {
  status: { SuccessValue: "" },
  transaction: { hash: HASH, signer_id: "lineage-aditya.testnet" },
  transaction_outcome: { id: HASH, outcome: { status: { SuccessReceiptId: "r" } } },
  receipts_outcome: [receipt({ SuccessValue: "" }), receipt({ SuccessValue: "eyJpZCI6NX0=" })],
};

describe("parseOutcome", () => {
  it("full success", () => {
    expect(parseOutcome(success)).toStrictEqual({ hash: HASH, ok: true, error: null });
  });

  it("top-level Failure carries the contract message", () => {
    const raw = { ...success, status: failure(OWNER_ONLY), receipts_outcome: [receipt(failure(OWNER_ONLY))] };
    expect(parseOutcome(raw)).toStrictEqual({ hash: HASH, ok: false, error: OWNER_ONLY });
  });

  it("success at the top but a failed receipt is not ok", () => {
    const msg = "Smart contract panicked: The account doesn't have enough balance";
    const raw = { ...success, receipts_outcome: [receipt({ SuccessValue: "" }), receipt(failure(msg))] };
    expect(parseOutcome(raw)).toStrictEqual({ hash: HASH, ok: false, error: msg });
  });

  it("non-FunctionCall failures are named by kind", () => {
    const raw = { ...success, status: { Failure: { ActionError: { index: 0, kind: { AccountDoesNotExist: { account_id: "x" } } } } } };
    expect(parseOutcome(raw)).toStrictEqual({ hash: HASH, ok: false, error: "ActionError: AccountDoesNotExist" });
    const inv = { ...success, status: { Failure: { InvalidTxError: { InvalidNonce: {} } } } };
    expect(parseOutcome(inv)).toStrictEqual({ hash: HASH, ok: false, error: "InvalidTxError: InvalidNonce" });
  });

  it("hash-only shape counts as submitted", () => {
    expect(parseOutcome({ transaction: { hash: HASH } })).toStrictEqual({ hash: HASH, ok: true, error: null });
  });

  it("falls back to transaction_outcome.id for the hash", () => {
    expect(parseOutcome({ transaction_outcome: { id: HASH } })).toStrictEqual({ hash: HASH, ok: true, error: null });
  });

  it.each([null, undefined, 42, "ok", {}, [], { transaction: { hash: 7 } }, { status: "weird" }])(
    "garbage %j has no hash and a readable message",
    (raw) => {
      expect(parseOutcome(raw)).toStrictEqual({ hash: null, ok: false, error: NO_RESULT });
    },
  );

  it("caps a long contract message at 160 characters", () => {
    const raw = { ...success, status: failure("x".repeat(500)) };
    expect(parseOutcome(raw).error).toHaveLength(160);
  });
});

describe("walletErrorMessage", () => {
  it.each(["User rejected the request", "User closed the modal", "User cancelled", "Request rejected by user", "Popup closed"])(
    "%s → cancelled",
    (msg) => {
      expect(walletErrorMessage(new Error(msg))).toBe("Cancelled in the wallet");
    },
  );

  it("passes other messages through", () => {
    expect(walletErrorMessage(new Error(OWNER_ONLY))).toBe(OWNER_ONLY);
    expect(walletErrorMessage({ message: "Network down" })).toBe("Network down");
    expect(walletErrorMessage("plain string error")).toBe("plain string error");
  });

  it("cuts long messages to 160 characters", () => {
    expect(walletErrorMessage(new Error("e".repeat(300)))).toHaveLength(160);
  });

  it("unknown values get a generic line", () => {
    expect(walletErrorMessage(undefined)).toBe("Wallet error");
    expect(walletErrorMessage(new Error(""))).toBe("Wallet error");
  });
});
