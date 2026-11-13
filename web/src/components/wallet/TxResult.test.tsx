import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { explorerTx } from "@/lib/config";
import { renderUI } from "@/test/render";
import { FAKE_HASH } from "./test-wallet";
import { TxResult } from "./TxResult";

describe("TxResult", () => {
  it("success: Sent, the hash, and an explorer link", () => {
    renderUI(<TxResult state={{ kind: "done", id: "freeze", result: { hash: FAKE_HASH, ok: true, error: null, value: null } }} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Sent/);
    expect(status).toHaveTextContent(FAKE_HASH);
    expect(screen.getByRole("link")).toHaveAttribute("href", explorerTx(FAKE_HASH));
  });

  it("failed on chain: the contract's message and the explorer link", () => {
    renderUI(<TxResult state={{ kind: "done", id: "freeze", result: { hash: FAKE_HASH, ok: false, error: "Smart contract panicked: Owner only", value: null } }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Failed: Smart contract panicked: Owner only");
    expect(screen.getByRole("link")).toHaveAttribute("href", explorerTx(FAKE_HASH));
  });

  it("no hash: the message only, no link", () => {
    renderUI(<TxResult state={{ kind: "done", id: "freeze", result: { hash: null, ok: false, error: "The wallet returned no result. The refresh shows what happened.", value: null } }} />);
    expect(screen.getByRole("status")).toHaveTextContent("The wallet returned no result. The refresh shows what happened.");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("wallet error: the message only", () => {
    renderUI(<TxResult state={{ kind: "failed", id: "freeze", message: "Cancelled in the wallet" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Cancelled in the wallet");
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("markup in an error stays text", () => {
    const { container } = renderUI(<TxResult state={{ kind: "failed", id: "x", message: "<img src=x onerror=alert(1)>" }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("<img src=x onerror=alert(1)>");
  });

  it("idle and signing render nothing", () => {
    const { container } = renderUI(<TxResult state={{ kind: "signing", id: "x" }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
