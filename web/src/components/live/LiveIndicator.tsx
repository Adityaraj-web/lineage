"use client";

import { RotateCw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/components/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveStatus, useLiveStore } from "@/hooks/live-store";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { fmtAgo } from "@/lib/format";
import { EASE_OUT } from "../motion";

// Re-render every second; the clock is read at render so status changes never show a stale time.
function useNow(ms = 1000): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return Date.now();
}

export function LiveIndicator() {
  const live = useLiveStatus();
  const store = useLiveStore();
  const reduced = useReducedMotionPref();
  const now = useNow();

  const text =
    live.status === "loading"
      ? "connecting…"
      : live.status === "paused"
        ? "paused · tab hidden"
        : live.status === "error"
          ? live.retryAt
            ? `RPC error · retry in ${Math.max(0, Math.ceil((live.retryAt - now) / 1000))} s`
            : "RPC error"
          : live.updatedAt
            ? `updated ${fmtAgo(live.updatedAt, now)}`
            : "live";

  const dot =
    live.status === "live"
      ? "bg-p1"
      : live.status === "error"
        ? "bg-p3"
        : live.status === "paused"
          ? "bg-neutral"
          : "bg-neutral/60";

  const label = (
    <span
      className="flex items-center gap-2.5 num text-micro text-muted-foreground"
      data-status={live.status}
    >
      <span className="relative grid size-2.5 place-items-center" aria-hidden="true">
        {live.status === "live" && !reduced && (
          <span className="absolute inset-0 animate-breathe rounded-full bg-p1/50" />
        )}
        {live.status === "live" && live.changedAt && !reduced && (
          <motion.span
            key={live.changedAt}
            className="absolute inset-0 rounded-full border border-p1"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 3, opacity: 0 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          />
        )}
        <span className={cn("relative size-2 rounded-full", dot)} />
      </span>
      <span className="min-w-[13ch]" role="status">
        {text}
      </span>
    </span>
  );

  return (
    <div className="flex items-center gap-1.5">
      {live.error ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="cursor-help rounded-md px-1 outline-none focus-visible:ring-2">
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm text-micro">
            {live.error.name}: {live.error.message}. Showing the last good data.
          </TooltipContent>
        </Tooltip>
      ) : (
        label
      )}
      <button
        type="button"
        onClick={() => store.refresh()}
        aria-label="Refresh now"
        className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover-fine:bg-white/[0.06] hover-fine:text-foreground focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCw className="size-3.5" />
      </button>
    </div>
  );
}
