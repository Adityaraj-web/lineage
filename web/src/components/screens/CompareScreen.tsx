"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/usePolling";
import { liveDeps } from "@/lib/live";
import { loadCompareView } from "@/lib/views";
import { CompareStage } from "../compare/CompareStage";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { CompareSkeleton } from "./Skeletons";

export function CompareScreen() {
  const load = useCallback(() => loadCompareView(liveDeps()), []);
  const { data, error, refresh } = usePolling(load, 5000, { cacheKey: "compare" });
  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <CompareSkeleton />;
  return (
    <>
      <CompareStage view={data} />
      <p className="mt-6 text-center text-micro text-faint">
        demo run {data.runId} · task #{data.taskIds.vault ?? "?"} on the Lineage vault, #{data.taskIds.guarded ?? "?"} on
        the LimitsOnly vault · statuses are read live from testnet
      </p>
      <ErrorToast error={error} />
    </>
  );
}
