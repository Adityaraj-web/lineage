import { DEPLOYMENT } from "@/lib/config";
import type { WalletDriver } from "@/lib/wallet";
import { FakeWallet, okOutcome } from "./test-wallet";

// `next dev` only (see WalletProvider): ?fakewallet=owner|viewer. Nothing is signed or sent.
export function devWallet(mode: string): WalletDriver {
  const account = mode === "viewer" ? "viewer-demo.testnet" : DEPLOYMENT.root;
  const wallet = new FakeWallet({ account, connectAs: account });
  wallet.sendImpl = () => new Promise((resolve) => setTimeout(() => resolve(okOutcome()), 1200));
  console.warn(`[dev] fakewallet=${mode} as ${account}: nothing is sent`);
  return wallet;
}
