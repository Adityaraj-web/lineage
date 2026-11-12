"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { WalletDriver, WalletPort } from "@/lib/wallet";
import { loadNearConnect } from "./connector";

export type WalletStatus = "loading" | "ready" | "unavailable";
export interface WalletState {
  status: WalletStatus;
  port: WalletPort | null;
}

// The default (and the server render) is "loading" with no port: no wallet UI until the client knows.
const WalletContext = createContext<WalletState>({ status: "loading", port: null });
export const useWallet = (): WalletState => useContext(WalletContext);

// Loads the wallet library on the client, restores a saved session silently, and follows sign-in/out.
// Any failure leaves the site read-only, exactly as without a wallet.
export function WalletProvider({ children, load = loadNearConnect }: { children: React.ReactNode; load?: () => Promise<WalletDriver> }) {
  const loadRef = useRef(load);
  const [driver, setDriver] = useState<WalletDriver | null>(null);
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const d = await loadRef.current();
        const restored = await d.restore();
        if (!alive) return;
        unsubscribe = d.onAccountChange((id) => alive && setAccountId(id));
        setAccountId(restored);
        setDriver(d);
        setStatus("ready");
      } catch {
        if (alive) setStatus("unavailable");
      }
    })();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const port = useMemo<WalletPort | null>(
    () =>
      driver && {
        accountId,
        connect: async () => setAccountId(await driver.connect()),
        disconnect: async () => {
          await driver.disconnect();
          setAccountId(null);
        },
        send: (tx) => driver.send(tx),
      },
    [driver, accountId],
  );
  const value = useMemo(() => ({ status, port }), [status, port]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
