"use client";

import { useCallback } from "react";
import { usePolling } from "@/hooks/usePolling";
import { liveDeps } from "@/lib/live";
import { loadOverview } from "@/lib/views";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { OverviewDashboard } from "../overview/OverviewDashboard";
import { OverviewSkeleton } from "./Skeletons";

export function OverviewScreen() {
  const load = useCallback(() => loadOverview(liveDeps()), []);
  const { data, error, refresh } = usePolling(load);
  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <OverviewSkeleton />;
  return (
    <>
      <OverviewDashboard view={data} />
      <ErrorToast error={error} />
    </>
  );
}
