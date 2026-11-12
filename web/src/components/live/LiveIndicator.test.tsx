import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUI } from "@/test/render";
import { LiveIndicator } from "./LiveIndicator";

const setup = () => renderUI(<LiveIndicator />).store;

describe("LiveIndicator", () => {
  it("says how long ago the data was updated", () => {
    const store = setup();
    act(() => store.set({ status: "live", updatedAt: Date.now() - 3200 }));
    expect(screen.getByRole("status")).toHaveTextContent("updated 3 s ago");
  });

  it("says paused while the tab is hidden", () => {
    const store = setup();
    act(() => store.set({ status: "paused", updatedAt: Date.now() }));
    expect(screen.getByRole("status")).toHaveTextContent("paused while the tab is hidden");
  });

  it("shows an RPC error with a retry countdown", () => {
    const store = setup();
    act(() =>
      store.set({
        status: "error",
        error: { name: "TIMEOUT_ERROR", message: "all endpoints failed" },
        retryAt: Date.now() + 10_000,
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("RPC error, retrying in 10 s");
  });

  it("refresh button calls the page's refresh", () => {
    const store = setup();
    let calls = 0;
    store.setRefresh(() => calls++);
    act(() => screen.getByRole("button", { name: "Refresh now" }).click());
    expect(calls).toBe(1);
  });
});
