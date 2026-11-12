"use client";

import { useCallback, useEffect } from "react";
import { seedPollCache } from "@/hooks/poll-cache";
import { usePolling } from "@/hooks/usePolling";
import { liveDeps } from "@/lib/live";
import { loadOverview } from "@/lib/views";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { OverviewDashboard } from "../overview/OverviewDashboard";
import { OverviewSkeleton } from "./Skeletons";

export function OverviewScreen() {
  const load = useCallback(() => loadOverview(liveDeps()), []);
  const { data, error, refresh } = usePolling(load, 5000, { cacheKey: "overview" });
  // Compare renders from this at once, so the attacker counter can morph across.
  useEffect(() => {
    if (data) seedPollCache("compare", data.compare);
  }, [data]);
  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <OverviewSkeleton />;
  return (
    <>
      <OverviewDashboard view={data} />
      <ErrorToast error={error} />
    </>
  );
}
