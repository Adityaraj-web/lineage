import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@/lib/rpc";
import { createLiveStore, LiveStoreContext, type LiveStore } from "./live-store";
import { usePolling } from "./usePolling";

let visibility: DocumentVisibilityState = "visible";
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

let store: LiveStore;
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(LiveStoreContext.Provider, { value: store }, children);

const flush = () => act(async () => {});
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_794_480_000_000);
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  visibility = "visible";
  store = createLiveStore();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("usePolling", () => {
  it("loads at once, then every interval, never overlapping", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const load = vi.fn(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 7000)); // slower than the interval
      inFlight--;
      return { n: load.mock.calls.length };
    });
    renderHook(() => usePolling(load, 5000), { wrapper });
    expect(load).toHaveBeenCalledTimes(1);
    await advance(7000); // first load done, next scheduled 5 s later
    expect(load).toHaveBeenCalledTimes(1);
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(2);
    await advance(30_000);
    expect(maxInFlight).toBe(1);
  });

  it("keeps the same data reference when a poll returns identical data", async () => {
    const load = vi.fn(async () => ({ total: 49_000_000n, rows: [1, 2, 3] }));
    const { result } = renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    const first = result.current.data;
    expect(first).not.toBeNull();
    const changedAt = store.get().changedAt;
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(first);
    expect(store.get().changedAt).toBe(changedAt);
    expect(store.get().updatedAt).toBe(Date.now());
  });

  it("publishes a new reference and changedAt only when the data changes", async () => {
    let total = 0n;
    const load = vi.fn(async () => ({ total }));
    const { result } = renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    const first = result.current.data;
    expect(store.get().changedAt).toBeNull(); // the first load is not a change
    total = 49_000_000n;
    await advance(5000);
    expect(result.current.data).not.toBe(first);
    expect(result.current.data).toEqual({ total: 49_000_000n });
    expect(store.get().changedAt).toBe(Date.now());
  });

  it("pauses while the tab is hidden and polls at once when it is visible again", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    setVisibility("hidden");
    expect(store.get().status).toBe("paused");
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.get().status).toBe("live");
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("keeps the last good data on error, shows the error, retries with backoff, then clears it", async () => {
    let fail = false;
    const load = vi.fn(async () => {
      if (fail) throw new RpcError("TIMEOUT_ERROR", "all RPC endpoints failed");
      return { ok: 1 };
    });
    const { result } = renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    const good = result.current.data;
    fail = true;
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(good);
    expect(result.current.error).toEqual({ name: "TIMEOUT_ERROR", message: "all RPC endpoints failed" });
    expect(store.get().status).toBe("error");
    await advance(5000); // first retry after the interval
    expect(load).toHaveBeenCalledTimes(3);
    await advance(5000); // then backoff: 10 s
    expect(load).toHaveBeenCalledTimes(3);
    await advance(5000);
    expect(load).toHaveBeenCalledTimes(4);
    fail = false;
    await advance(20_000);
    expect(load).toHaveBeenCalledTimes(5);
    expect(result.current.error).toBeNull();
    expect(result.current.data).toBe(good);
    expect(store.get().status).toBe("live");
  });

  it("refresh polls now and resets the timer", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    const { result } = renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    await advance(3000);
    act(() => result.current.refresh());
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    await advance(3000); // the old timer (due at 5 s) is gone
    expect(load).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("stops polling after unmount", async () => {
    const load = vi.fn(async () => ({ ok: true }));
    const { unmount } = renderHook(() => usePolling(load, 5000), { wrapper });
    await flush();
    unmount();
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
