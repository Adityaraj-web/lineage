"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useChanges } from "@/hooks/useChanges";
import { usePolling } from "@/hooks/usePolling";
import type { VaultKey } from "@/lib/config";
import { DEMO_RUN, liveDeps } from "@/lib/live";
import { roleFor } from "@/lib/wallet";
import { loadVaultView, type Overview } from "@/lib/views";
import { readPollCache } from "@/hooks/poll-cache";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { VaultDashboard } from "../vault/VaultDashboard";
import { useOwnerAction } from "../wallet/useOwnerAction";
import { useWallet } from "../wallet/WalletProvider";
import { VaultSkeleton } from "./Skeletons";

export function VaultScreen({ vaultKey }: { vaultKey: VaultKey }) {
  const load = useCallback(() => loadVaultView(vaultKey, liveDeps()), [vaultKey]);
  const { data, error, refresh } = usePolling(load, 5000, { cacheKey: `vault:${vaultKey}` });
  const payments = useMemo(() => data?.payments.map((r) => r.payment) ?? null, [data]);
  const marks = useChanges(payments);
  const { port } = useWallet();
  const accountId = port?.accountId ?? null;
  const action = useOwnerAction(port?.send ?? null, refresh);

  // /vault/vault#inbox: the section only exists once data has loaded.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!data || scrolled.current) return;
    scrolled.current = true;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [data]);

  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <VaultSkeleton awaiting={vaultKey === "vault" ? (readPollCache<Overview>("overview")?.awaitingCount ?? null) : null} />;
  return (
    <>
      <VaultDashboard
        view={data}
        demoRun={DEMO_RUN}
        marks={marks}
        now={Date.now()}
        wallet={{ role: roleFor(accountId, data.config.owner), accountId, action }}
      />
      <ErrorToast error={error} />
    </>
  );
}
