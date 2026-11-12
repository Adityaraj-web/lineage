"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { PollError } from "@/hooks/live-store";
import { EASE_OUT } from "../motion";

// A poll failed while older data is on screen: fixed position, so nothing shifts.
export function ErrorToast({ error }: { error: PollError | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-p3-ring bg-raised-2 px-4 py-3 text-small shadow-2xl"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-p3" aria-hidden="true" />
          <p>
            <span className="text-p3">Can&apos;t reach testnet RPC.</span>{" "}
            <span className="text-muted-foreground">Showing the last good data; retrying.</span>
            <span className="mt-1 block text-micro break-all text-faint">
              {error.name}: {error.message}
            </span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// First load failed: nothing to show yet.
export function LoadError({ error, onRetry }: { error: PollError; onRetry: () => void }) {
  return (
    <div className="surface mt-16 flex flex-col items-start gap-4 p-8">
      <p className="label text-p3">Can&apos;t reach testnet RPC</p>
      <p className="max-w-prose text-muted-foreground">
        The dashboard reads the chain straight from public NEAR RPC in your browser. Every endpoint failed; it
        keeps retrying.
      </p>
      <p className="text-micro break-all text-faint">
        {error.name}: {error.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="press inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-small hover-fine:bg-white/[0.06] focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCw className="size-3.5" aria-hidden="true" /> Retry now
      </button>
    </div>
  );
}

export function Section({
  id,
  label,
  title,
  aside,
  children,
}: {
  id?: string;
  label?: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24" aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 id={id ? `${id}-title` : undefined} className="font-serif text-title">
            {title}
          </h2>
          {label && <p className="label">{label}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}
