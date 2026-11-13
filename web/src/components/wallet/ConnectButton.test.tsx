import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROOT } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { ConnectButton } from "./ConnectButton";
import { FakeWallet } from "./test-wallet";
import { WalletProvider } from "./WalletProvider";

async function mount(fake: FakeWallet) {
  const r = renderUI(
    <WalletProvider load={async () => fake}>
      <ConnectButton />
    </WalletProvider>,
  );
  await act(async () => {});
  return r;
}

describe("ConnectButton", () => {
  it("disconnected: a Connect wallet button that opens the wallet", async () => {
    const fake = new FakeWallet();
    await mount(fake);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect wallet" })));
    expect(fake.calls.connect).toBe(1);
    expect(screen.getByRole("button", { name: new RegExp(ROOT) })).toBeInTheDocument();
  });

  it("closing the wallet picker is silent", async () => {
    const fake = new FakeWallet();
    fake.connectImpl = () => Promise.reject(new Error("User rejected"));
    await mount(fake);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect wallet" })));
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeEnabled();
  });

  it("other connect failures say so on the button", async () => {
    const fake = new FakeWallet();
    fake.connectImpl = () => Promise.reject(new Error("iframe blocked"));
    await mount(fake);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Connect wallet" })));
    expect(screen.getByRole("button", { name: "Couldn't connect, try again" })).toBeInTheDocument();
  });

  it("connected: the account chip opens a menu; Escape returns focus to it", async () => {
    await mount(new FakeWallet({ account: ROOT }));
    const chip = screen.getByRole("button", { name: new RegExp(ROOT) });
    expect(chip).toHaveTextContent(ROOT);
    expect(chip).toHaveAttribute("aria-expanded", "false");
    act(() => chip.focus());
    act(() => fireEvent.click(chip));
    expect(chip).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    act(() => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" }));
    expect(chip).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(chip).toHaveFocus());
  });

  it("Disconnect signs out and moves focus to the Connect button", async () => {
    const fake = new FakeWallet({ account: ROOT });
    await mount(fake);
    act(() => fireEvent.click(screen.getByRole("button", { name: new RegExp(ROOT) })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Disconnect" })));
    expect(fake.calls.disconnect).toBe(1);
    expect(screen.getByRole("button", { name: "Connect wallet" })).toHaveFocus();
  });

  it("does not show the role", async () => {
    await mount(new FakeWallet({ account: ROOT }));
    expect(screen.queryByText(/owner|viewer/i)).toBeNull();
  });
});
