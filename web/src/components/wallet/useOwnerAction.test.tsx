import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freezeTx, rejectTx } from "@/lib/actions";
import { VAULT } from "@/lib/test-fixtures";
import { FAKE_HASH, FakeWallet } from "./test-wallet";
import { REFRESH_AGAIN_MS, useOwnerAction } from "./useOwnerAction";

const OWNER_ONLY = "Smart contract panicked: Owner only";

function setup(fake = new FakeWallet()) {
  const refresh = vi.fn();
  const hook = renderHook(() => useOwnerAction(fake.send, refresh));
  return { fake, refresh, hook, action: () => hook.result.current };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useOwnerAction", () => {
  it("starts idle", () => {
    const { action } = setup();
    expect(action().state).toStrictEqual({ kind: "idle" });
    expect(action().busy).toBe(false);
  });

  it("signing → done with the parsed outcome, then refreshes now and once 2 s later", async () => {
    const { fake, refresh, action } = setup();
    const d = fake.defer();
    let p!: Promise<void>;
    act(() => {
      p = action().run("freeze", freezeTx(VAULT));
    });
    expect(action().state).toStrictEqual({ kind: "signing", id: "freeze" });
    expect(action().busy).toBe(true);
    expect(fake.sent).toStrictEqual([freezeTx(VAULT)]);
    await act(async () => {
      d.resolve({ status: { SuccessValue: "" }, transaction: { hash: FAKE_HASH } });
      await p;
    });
    expect(action().state).toStrictEqual({ kind: "done", id: "freeze", result: { hash: FAKE_HASH, ok: true, error: null } });
    expect(action().busy).toBe(false);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(REFRESH_AGAIN_MS - 1));
    expect(refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("a failed transaction keeps the contract's message", async () => {
    const { fake, action } = setup();
    fake.sendImpl = async () => ({
      transaction: { hash: FAKE_HASH },
      status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: OWNER_ONLY } } } } },
    });
    await act(() => action().run("reject:5", rejectTx(VAULT, 5, "x")));
    expect(action().state).toStrictEqual({ kind: "done", id: "reject:5", result: { hash: FAKE_HASH, ok: false, error: OWNER_ONLY } });
  });

  it("closing the wallet is failed 'Cancelled in the wallet', and refreshes at most twice", async () => {
    const { fake, refresh, action } = setup();
    fake.sendImpl = () => Promise.reject(new Error("User rejected"));
    await act(() => action().run("freeze", freezeTx(VAULT)));
    expect(action().state).toStrictEqual({ kind: "failed", id: "freeze", message: "Cancelled in the wallet" });
    expect(action().busy).toBe(false);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("one action at a time: a second run while signing sends nothing", async () => {
    const { fake, action } = setup();
    const d = fake.defer();
    let p!: Promise<void>;
    act(() => {
      p = action().run("freeze", freezeTx(VAULT));
    });
    await act(() => action().run("reject:5", rejectTx(VAULT, 5, "x")));
    expect(fake.sent).toHaveLength(1);
    expect(action().state).toStrictEqual({ kind: "signing", id: "freeze" });
    await act(async () => {
      d.resolve({ transaction: { hash: FAKE_HASH } });
      await p;
    });
  });

  it("a new action cancels the pending second refresh of the previous one", async () => {
    const { refresh, action } = setup();
    await act(() => action().run("freeze", freezeTx(VAULT)));
    await act(() => action().run("reject:5", rejectTx(VAULT, 5, "x")));
    expect(refresh).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(60_000));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it("clear() returns to idle", async () => {
    const { action } = setup();
    await act(() => action().run("freeze", freezeTx(VAULT)));
    act(() => action().clear());
    expect(action().state).toStrictEqual({ kind: "idle" });
  });

  it("no refresh after unmount", async () => {
    const { fake, refresh, hook, action } = setup();
    const d = fake.defer();
    let p!: Promise<void>;
    act(() => {
      p = action().run("freeze", freezeTx(VAULT));
    });
    hook.unmount();
    await act(async () => {
      d.resolve({ transaction: { hash: FAKE_HASH } });
      await p;
    });
    vi.advanceTimersByTime(60_000);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("without a wallet, run does nothing", async () => {
    const refresh = vi.fn();
    const { result } = renderHook(() => useOwnerAction(null, refresh));
    await act(() => result.current.run("freeze", freezeTx(VAULT)));
    expect(result.current.state).toStrictEqual({ kind: "idle" });
    expect(refresh).not.toHaveBeenCalled();
  });
});
