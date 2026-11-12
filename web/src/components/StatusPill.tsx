"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/components/cn";
import { statusLabel } from "@/lib/provenance";
import type { PaymentStatus } from "@/shared/vault-types";
import { DUR, EASE_OUT } from "./motion";
import { accentClass, type Accent } from "./tone";

const statusAccent: Record<PaymentStatus, Accent | "plain"> = {
  AwaitingApproval: "p3",
  Paid: "plain",
  Sending: "p2",
  Resolving: "p2",
  Rejected: "neutral",
  Blocked: "neutral",
  Failed: "neutral",
};

// The label crossfades and the colour eases when the status changes; never on first render.
export function StatusPill({
  status,
  accent,
  className,
}: {
  status: PaymentStatus;
  accent?: Accent;
  className?: string;
}) {
  const tone = accent ?? statusAccent[status];
  const cls =
    tone === "plain"
      ? "border-white/12 bg-white/[0.05] text-foreground"
      : cn(accentClass[tone].soft, accentClass[tone].border, accentClass[tone].text);
  const label = statusLabel(status);
  return (
    <motion.span
      layout
      data-status={status}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
      className={cn(
        "relative inline-flex h-6 items-center overflow-hidden rounded-full border px-2.5 text-micro font-medium whitespace-nowrap transition-colors duration-300",
        cls,
        status === "AwaitingApproval" && "glow-amber",
        className,
      )}
    >
      {status === "AwaitingApproval" && (
        <span className="mr-1.5 size-1.5 rounded-full bg-p3" aria-hidden="true" />
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={label}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: DUR.base, ease: EASE_OUT }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
