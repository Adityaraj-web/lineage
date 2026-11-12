"use client";

import { Check, KeyRound, X } from "lucide-react";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import type { VaultKey } from "@/lib/config";
import type { KeyProof } from "@/lib/views";
import { AccountId } from "../AccountId";
import { EASE_OUT } from "../motion";
import { Glass } from "@/components/Glass";

// Owner-only vault methods: each needs a full-access key, which the agent doesn't have.
const CANNOT = [
  { method: "approve_payment", what: "approve a held payment" },
  { method: "withdraw", what: "withdraw funds" },
  { method: "unfreeze", what: "unfreeze the vault" },
  { method: "create_task", what: "change limits or sign a new mandate" },
];

const YOCTO = 10n ** 24n;
function fmtNear(yocto: string): string {
  const v = BigInt(yocto);
  return `${v / YOCTO}.${((v % YOCTO) / 10n ** 22n).toString().padStart(2, "0")} NEAR`;
}

export function AgentKeyCard({ vault, agentId, proof }: { vault: VaultKey; agentId: string; proof: KeyProof }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const strike = reduced || inView;
  const vaultName = vault === "vault" ? "Lineage vault" : "LimitsOnly vault";

  return (
    <Glass as="article" ref={ref} className="flex flex-col gap-5 p-6" aria-labelledby={`key-${vault}-title`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`key-${vault}-title`} className="label flex items-center gap-2">
            <KeyRound className="size-3.5" aria-hidden="true" /> Agent key for the {vaultName}
          </h3>
          <AccountId id={agentId} link className="mt-1.5 block text-[13px]" />
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[12px]",
            proof.ok ? "border-p1-ring bg-p1-soft text-p1" : "border-attacker-ring bg-attacker-soft text-attacker",
          )}
        >
          {proof.ok ? "One function-call key" : "Key check failed"}
        </span>
      </header>

      {proof.ok ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="label mb-2 text-p1">Can</p>
            <ul aria-label="The agent's key can" className="flex flex-col gap-2">
              <li className="flex items-start gap-2 rounded-xl border border-p1-ring/50 bg-p1-soft/50 px-3 py-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-p1" aria-hidden="true" />
                <span className="min-w-0 text-small">
                  <span className="font-mono text-foreground">{proof.methodNames.join(", ")}</span>
                  <span className="text-muted-foreground"> on </span>
                  {proof.receiverId && <AccountId id={proof.receiverId} className="text-[12px]" />}
                  <span className="mt-1 block text-[12px] text-muted-foreground">
                    ask the vault to pay; the vault decides
                  </span>
                </span>
              </li>
            </ul>
            <p className="mt-2 text-micro text-faint">
              {proof.allowance ? `${fmtNear(proof.allowance)} allowance left for gas` : "unlimited gas allowance"}
            </p>
          </div>
          <div>
            <p className="label mb-2 text-attacker">Cannot</p>
            <ul aria-label="The agent's key cannot" className="flex flex-col gap-1.5">
              {CANNOT.map((c, i) => (
                <li key={c.method} className="flex items-start gap-2 px-1 py-1 text-small">
                  <X className="mt-0.5 size-4 shrink-0 text-attacker" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="relative inline-block">
                      <del className="font-mono text-muted-foreground decoration-attacker/70">{c.method}</del>
                      <motion.span
                        aria-hidden="true"
                        className="absolute inset-x-0 top-1/2 h-px origin-left bg-attacker"
                        initial={reduced ? false : { scaleX: 0 }}
                        animate={{ scaleX: strike ? 1 : 0 }}
                        transition={{ duration: 0.4, delay: 0.2 + i * 0.1, ease: EASE_OUT }}
                      />
                    </span>
                    <span className="block text-[12px] text-faint">{c.what}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5 text-small text-attacker" aria-label="Key problems">
          {proof.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </Glass>
  );
}
