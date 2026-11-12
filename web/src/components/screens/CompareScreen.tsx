"use client";

import { useCallback, useState } from "react";
import { readPollCache } from "@/hooks/poll-cache";
import { usePolling } from "@/hooks/usePolling";
import { fmtDate } from "@/lib/format";
import { liveDeps } from "@/lib/live";
import { loadCompareView } from "@/lib/views";
import { CompareStage, compareSummary } from "../compare/CompareStage";
import { ErrorToast, LoadError } from "../live/ScreenState";
import { CompareSkeleton } from "./Skeletons";

function runLine(runId: string, tasks: { vault: number | null; guarded: number | null }): string {
  const at = Date.parse(runId);
  const when = Number.isNaN(at) ? runId : fmtDate(at);
  const task =
    tasks.vault !== null && tasks.vault === tasks.guarded
      ? `Task ${tasks.vault} on both vaults.`
      : `Task ${tasks.vault ?? "?"} on the Lineage vault, task ${tasks.guarded ?? "?"} on the LimitsOnly vault.`;
  return `Demo run ${when}. ${task} Statuses are read live from testnet.`;
}

export function CompareScreen() {
  const load = useCallback(() => loadCompareView(liveDeps()), []);
  // Arrived with data (from the Overview): counters start settled so the shared counter can morph.
  const [settled] = useState(() => readPollCache("compare") !== null);
  const { data, error, refresh } = usePolling(load, 5000, { cacheKey: "compare" });
  if (!data) return error ? <LoadError error={error} onRetry={refresh} /> : <CompareSkeleton />;
  return (
    <>
      <p className="-mt-4 max-w-[44rem] text-lead text-muted-foreground">{compareSummary(data)}</p>
      <CompareStage view={data} settled={settled} />
      <p className="mt-10 text-micro text-faint">{runLine(data.runId, data.taskIds)}</p>
      <ErrorToast error={error} />
    </>
  );
}
