import { cn } from "@/components/cn";
import { needsYouText, Shared } from "../transitions";

// Placeholders sized like the real sections, so data arriving doesn't shift the page much.
export function Block({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-white/[0.04] motion-reduce:animate-none", className)} />;
}

// `awaiting` (from the Overview's cached data) puts the real inbox heading in place before the vault
// loads, so "1 payment needs you" can morph across from the Overview.
export function VaultSkeleton({ awaiting = null }: { awaiting?: number | null }) {
  return (
    <div className="flex flex-col gap-16 pt-14 md:gap-20 md:pt-20" aria-busy="true" aria-label="Loading vault from testnet">
      <div>
        <Block className="h-4 w-40" />
        <Block className="mt-4 h-16 w-80" />
        <Block className="mt-4 h-5 w-full max-w-2xl" />
        <Block className="mt-10 h-56" />
      </div>
      {awaiting !== null ? (
        <div id="inbox" className="scroll-mt-24">
          <h2 className="mb-6 font-serif text-title">
            <Shared name="needs-you">
              <span className="inline-block">{needsYouText(awaiting)}</span>
            </Shared>
          </h2>
          <Block className="h-[34rem]" />
        </div>
      ) : (
        <Block className="h-[34rem]" />
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Block className="h-96" />
        <Block className="h-96" />
        <Block className="h-96" />
      </div>
    </div>
  );
}

export function CompareSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading the comparison from testnet" className="flex flex-col gap-8">
      <Block className="h-16" />
      <Block className="h-[38rem]" />
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading live state from testnet" className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[1.6fr_1fr]">
        <Block className="h-56" />
        <Block className="h-56" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Block className="h-64" />
        <Block className="h-64" />
      </div>
    </div>
  );
}
