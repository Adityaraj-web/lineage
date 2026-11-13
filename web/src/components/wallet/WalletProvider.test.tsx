import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEMO_RUN_SNAPSHOT, NOW, ROOT } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { VaultDashboard } from "../vault/VaultDashboard";
import { ConnectButton } from "./ConnectButton";
import { FakeWallet } from "./test-wallet";
import { useWallet, WalletProvider } from "./WalletProvider";

function Probe() {
  const { status, port } = useWallet();
  return <output data-testid="probe">{`${status}:${port?.accountId ?? "none"}`}</output>;
}

const flush = () => act(async () => {});

describe("WalletProvider", () => {
  it("first render is loading with no wallet button (same as the server render)", () => {
    renderUI(
      <WalletProvider load={() => new Promise(() => {})}>
        <Probe />
        <ConnectButton />
      </WalletProvider>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("loading:none");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a failed load is unavailable: no Connect button, the dashboard still renders", async () => {
    renderUI(
      <WalletProvider load={() => Promise.reject(new Error("blocked"))}>
        <Probe />
        <ConnectButton />
        <VaultDashboard view={vaultView("vault")} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} />
      </WalletProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe")).toHaveTextContent("unavailable:none");
    expect(screen.queryByRole("button", { name: /connect/i })).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lineage vault");
  });

  it("restores a saved session silently", async () => {
    const fake = new FakeWallet({ account: ROOT });
    renderUI(
      <WalletProvider load={async () => fake}>
        <Probe />
      </WalletProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe")).toHaveTextContent(`ready:${ROOT}`);
  });

  it("follows sign-in and sign-out events from the wallet", async () => {
    const fake = new FakeWallet();
    renderUI(
      <WalletProvider load={async () => fake}>
        <Probe />
      </WalletProvider>,
    );
    await flush();
    expect(screen.getByTestId("probe")).toHaveTextContent("ready:none");
    act(() => fake.emit("alice.testnet"));
    expect(screen.getByTestId("probe")).toHaveTextContent("ready:alice.testnet");
    act(() => fake.emit(null));
    expect(screen.getByTestId("probe")).toHaveTextContent("ready:none");
  });

  it("unsubscribes from the wallet on unmount", async () => {
    const fake = new FakeWallet();
    const { unmount } = renderUI(
      <WalletProvider load={async () => fake}>
        <Probe />
      </WalletProvider>,
    );
    await flush();
    expect(fake.listenerCount).toBe(1);
    unmount();
    expect(fake.listenerCount).toBe(0);
  });
});
