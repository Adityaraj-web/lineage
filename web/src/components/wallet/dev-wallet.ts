import type { OwnerTx } from "@/lib/actions";
import { DEPLOYMENT } from "@/lib/config";
import type { WalletDriver } from "@/lib/wallet";
import { FakeWallet, okOutcome } from "./test-wallet";

// `next dev` only (see WalletProvider): ?fakewallet=owner|viewer. Nothing is signed or sent.
export function devWallet(mode: string): WalletDriver {
  const account = mode === "viewer" ? "viewer-demo.testnet" : DEPLOYMENT.root;
  const wallet = new FakeWallet({ account, connectAs: account });
  // create_task answers task 15 so the success line shows in full; the poll never shows that task.
  const value = (tx: OwnerTx) => (tx.actions[0].params.methodName === "create_task" ? "MTU=" : "");
  wallet.sendImpl = (tx) => new Promise((resolve) => setTimeout(() => resolve(okOutcome(undefined, value(tx))), 1200));
  console.warn(`[dev] fakewallet=${mode} as ${account}: nothing is sent`);
  return wallet;
}
