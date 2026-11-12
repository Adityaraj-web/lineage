import { Check, X } from "lucide-react";
import { cn } from "@/components/cn";

export const shortHash = (h: string): string => (h.length > 12 ? `${h.slice(0, 4)}…${h.slice(-4)}` : h);

// "Same code" seal: both vaults' code hashes match. Full hash for screen readers and on hover.
export function Seal({
  hashes,
  sameCode,
  className,
}: {
  hashes: { vault: string | null; guarded: string | null };
  sameCode: boolean;
  className?: string;
}) {
  const ring = sameCode ? "var(--color-p1)" : "var(--color-attacker)";
  return (
    <div
      data-testid="same-code-seal"
      title={sameCode && hashes.vault ? hashes.vault : undefined}
      className={cn(
        "relative grid size-32 place-items-center rounded-full border bg-ink",
        sameCode ? "border-p1-ring" : "border-attacker-ring",
        className,
      )}
    >
      <svg viewBox="0 0 128 128" className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <path id="seal-ring" d="M64,64 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0" />
          <radialGradient id="seal-glow">
            <stop offset="0.6" stopColor={ring} stopOpacity="0" />
            <stop offset="1" stopColor={ring} stopOpacity="0.18" />
          </radialGradient>
        </defs>
        <circle cx="64" cy="64" r="63" fill="url(#seal-glow)" />
        <circle cx="64" cy="64" r="58" fill="none" stroke={ring} strokeOpacity="0.3" strokeDasharray="2 4" />
        <text className="fill-muted-foreground text-[10px] font-medium">
          <textPath href="#seal-ring">same agent, same plan, same contract,</textPath>
        </text>
      </svg>
      <div className="relative flex flex-col items-center gap-0.5 text-center">
        {sameCode ? <Check className="size-4 text-p1" aria-hidden="true" /> : <X className="size-4 text-attacker" aria-hidden="true" />}
        <span className={cn("text-[1rem] leading-tight font-semibold", sameCode ? "text-p1" : "text-attacker")}>
          {sameCode ? "same code" : "different code"}
        </span>
        {sameCode && hashes.vault && (
          <>
            <span className="font-mono text-[10px] text-muted-foreground" aria-hidden="true">
              {shortHash(hashes.vault)}
            </span>
            <span className="sr-only">{hashes.vault}</span>
          </>
        )}
        {!sameCode && (
          <span className="sr-only">
            Lineage {hashes.vault ?? "no code"}, LimitsOnly {hashes.guarded ?? "no code"}
          </span>
        )}
      </div>
    </div>
  );
}
