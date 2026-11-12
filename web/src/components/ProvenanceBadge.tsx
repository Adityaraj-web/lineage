"use client";

import { cn } from "@/components/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Badge } from "@/lib/provenance";
import { accentClass, badgeAccent } from "./tone";

// Badges carry text (code + label), never colour alone.
export function ProvenanceBadge({
  badge,
  compact = false,
  wrap = false,
  className,
}: {
  badge: Badge;
  compact?: boolean;
  wrap?: boolean;
  className?: string;
}) {
  const a = accentClass[badgeAccent[badge.tone]];
  const needsYou = badge.tone === "amber";
  const chip = (
    <span
      data-tone={badge.tone}
      data-code={badge.code}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border py-0.5 pr-2.5 pl-1 text-micro leading-5 whitespace-nowrap",
        a.soft,
        a.border,
        wrap && "items-start rounded-[11px] whitespace-normal",
        needsYou && "animate-glow-amber motion-reduce:animate-none motion-reduce:shadow-[0_0_14px_1px_rgb(251_191_36/0.28)]",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full px-1.5 num text-[11px] font-semibold text-ink",
          a.solid,
        )}
      >
        {badge.code}
      </span>
      <span className={cn("font-medium", !wrap && "truncate", a.text)}>{badge.label}</span>
    </span>
  );

  if (!badge.detail) return chip;
  if (compact) {
    return (
      <span className="inline-flex max-w-full">
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex max-w-full rounded-full outline-none focus-visible:ring-2">
              {chip}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-micro" aria-hidden="true">
            {badge.detail}
          </TooltipContent>
        </Tooltip>
        <span className="sr-only">{badge.detail}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full flex-col items-start gap-1">
      {chip}
      <span className="max-w-full pl-1 text-micro break-words text-muted-foreground">{badge.detail}</span>
    </span>
  );
}
