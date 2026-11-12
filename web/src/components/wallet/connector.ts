import type { ConnectorAction } from "@hot-labs/near-connect";
import type { WalletDriver } from "@/lib/wallet";

// The only module that touches NEAR Connect. It reads window, localStorage and IndexedDB, so it is
// loaded with a dynamic import from a client effect, never at module scope.
const NETWORK = "testnet" as const;

type Accounts = ReadonlyArray<{ accountId: string }> | undefined;
const firstAccount = (accounts: Accounts): string | null => accounts?.[0]?.accountId ?? null;

async function create(): Promise<WalletDriver> {
  const { NearConnector } = await import("@hot-labs/near-connect");
  // No signIn/addFunctionCallKey: the owner account must never get a function-call key from this site.
  const connector = new NearConnector({ network: NETWORK });
  // whenManifestLoaded never rejects: a failed manifest fetch just leaves no wallets.
  await connector.whenManifestLoaded;
  if (connector.availableWallets.length === 0) throw new Error("No NEAR wallets available");

  return {
    restore: () => connector.getConnectedWallet().then((r) => firstAccount(r.accounts), () => null),
    connect: async () => {
      const wallet = await connector.connect();
      return firstAccount(await wallet.getAccounts({ network: NETWORK }));
    },
    disconnect: () => connector.disconnect(),
    send: async (tx) => {
      const { wallet, accounts } = await connector.getConnectedWallet();
      const actions: ConnectorAction[] = tx.actions;
      return wallet.signAndSendTransaction({
        receiverId: tx.receiverId,
        actions,
        signerId: firstAccount(accounts) ?? undefined,
        network: NETWORK,
      });
    },
    onAccountChange: (cb) => {
      const signIn = (e: { accounts: Accounts }) => cb(firstAccount(e.accounts));
      const signOut = () => cb(null);
      connector.on("wallet:signIn", signIn);
      connector.on("wallet:signOut", signOut);
      return () => {
        connector.off("wallet:signIn", signIn);
        connector.off("wallet:signOut", signOut);
      };
    },
  };
}

// One connector per page load: its window listeners cannot be removed. A failed load is not cached.
let shared: Promise<WalletDriver> | null = null;
export function loadNearConnect(): Promise<WalletDriver> {
  shared ??= create().catch((e: unknown) => {
    shared = null;
    throw e;
  });
  return shared;
}
