"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useChanges } from "@/hooks/useChanges";
import { usePolling } from "@/hooks/usePolling";
import type { VaultKey } from "@/lib/config";
import { liveDeps } from "@/lib/live";
import { loadVaultView } from "@/lib/views";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { VaultDashboard } from "../vault/VaultDashboard";
import { VaultSkeleton } from "./Skeletons";

export function VaultScreen({ vaultKey }: { vaultKey: VaultKey }) {
  const load = useCallback(() => loadVaultView(vaultKey, liveDeps()), [vaultKey]);
  const { data, error, refresh } = usePolling(load);
  const payments = useMemo(() => data?.payments.map((r) => r.payment) ?? null, [data]);
  const marks = useChanges(payments);

  // /vault/vault#inbox: the section only exists once data has loaded.
  const scrolled = useRef(false);
  useEffect(() => {
    if (!data || scrolled.current) return;
    scrolled.current = true;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [data]);

  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <VaultSkeleton />;
  return (
    <>
      <VaultDashboard view={data} marks={marks} now={Date.now()} />
      <ErrorToast error={error} />
    </>
  );
}
