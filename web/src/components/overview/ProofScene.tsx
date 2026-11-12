"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { cn } from "@/components/cn";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { AGENT_IDS, VAULT_KEYS } from "@/lib/config";
import type { Overview } from "@/lib/views";
import { AccountId } from "../AccountId";
import { Seal } from "../Seal";
import { AgentKeyCard } from "./AgentKeyCard";

// One fact: its heading wipes in left to right as it scrolls up, then the proof under it rises.
function Fact({ title, line, tone, side, children, labelId }: {
  title: string;
  line: string;
  tone?: "attacker";
  // "stack": heading and line above a full-width proof.
  side: "left" | "stack";
  children: React.ReactNode;
  labelId: string;
}) {
  const reduced = useReducedMotionPref();
  const wide = useMediaQuery("(min-width: 768px)");
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", wide ? "start 0.55" : "start 0.7"] });
  const clip = useTransform(scrollYProgress, [0, 0.6], ["inset(0 100% 0 0)", "inset(0 0% 0 0)"]);
  const body = useTransform(scrollYProgress, [0.4, 0.8], [0, 1]);
  const bodyT = useTransform(scrollYProgress, [0.4, 0.8], ["translateY(16px)", "translateY(0px)"]);
  return (
    <section ref={ref} aria-labelledby={labelId} className={cn("flex flex-col gap-8", side === "left" && "md:flex-row md:items-center md:gap-16")}>
      <div className={side === "left" ? "md:w-[44%]" : "max-w-[40rem]"}>
        <motion.h2 id={labelId} className={cn("font-serif text-display", tone === "attacker" && "text-attacker")} style={reduced ? undefined : { clipPath: clip }}>
          {title}
        </motion.h2>
        <motion.p className="mt-5 max-w-[30rem] text-lead text-muted-foreground" style={reduced ? undefined : { opacity: body, transform: bodyT }}>
          {line}
        </motion.p>
      </div>
      <motion.div className="min-w-0 flex-1" style={reduced ? undefined : { opacity: body, transform: bodyT }}>
        {children}
      </motion.div>
    </section>
  );
}

export function ProofScene({ view }: { view: Overview }) {
  const reduced = useReducedMotionPref();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const sealRot = useTransform(scrollYProgress, [0.8, 1], ["rotate(-8deg)", "rotate(0deg)"]);
  const keysOk = VAULT_KEYS.every((k) => view.keyProofs[k].ok);
  return (
    <div className="flex flex-col gap-32 py-24">
      <Fact
        labelId="proof-code-title"
        title={view.sameCode ? "Same code." : "Different code."}
        tone={view.sameCode ? undefined : "attacker"}
        line={
          view.sameCode
            ? "Both vaults run one build. Only the mode differs: Lineage checks where a payee came from, LimitsOnly checks the limits alone."
            : "The two vaults run different builds, so the comparison is not like for like."
        }
        side="left"
      >
        <div ref={ref} className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
          <motion.div style={reduced ? undefined : { transform: sealRot }}>
            <Seal hashes={view.compare.codeHashes} sameCode={view.sameCode} className="size-40" />
          </motion.div>
          <dl className="flex flex-col gap-3 text-small">
            {VAULT_KEYS.map((k) => (
              <div key={k}>
                <dt className="text-muted-foreground">{k === "vault" ? "Lineage vault" : "LimitsOnly vault"}</dt>
                <dd>
                  <AccountId id={view.vaults[k].vaultId} link className="text-[13px]" />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Fact>
      <Fact
        labelId="proof-keys-title"
        title={keysOk ? "The agent can only ask." : "Key check failed."}
        tone={keysOk ? undefined : "attacker"}
        line={
          keysOk
            ? "Each agent holds one function-call key that can call request_payment on its own vault and nothing else. Approving, withdrawing and changing limits need your full-access key."
            : "An agent account holds a key it shouldn't. The problems are listed here."
        }
        side="stack"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          {VAULT_KEYS.map((k) => (
            <AgentKeyCard key={k} vault={k} agentId={AGENT_IDS[k]} proof={view.keyProofs[k]} />
          ))}
        </div>
      </Fact>
    </div>
  );
}
