import type { Metadata } from "next";
import { CompareScreen } from "@/components/screens/CompareScreen";

export const metadata: Metadata = { title: "Compare" };

export default function ComparePage() {
  return (
    <div className="flex flex-col gap-10 pt-14 md:gap-12 md:pt-20">
      <header>
        <p className="eyebrow">The demo run, side by side</p>
        <h1 className="mt-3 font-serif text-display">
          One poisoned <em>invoice</em>
        </h1>
        <p className="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed text-muted-foreground">
          The agent read three emails and asked both vaults to pay the same three payments. One email was an
          attacker&apos;s, with new payout details. Lineage checks where each payee came from; LimitsOnly only checks
          the limits.
        </p>
      </header>
      <CompareScreen />
    </div>
  );
}
