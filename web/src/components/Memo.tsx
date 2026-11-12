import { cn } from "@/components/cn";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Agent memos are untrusted (the attacker wrote one). Only React text nodes: no HTML, no markdown,
// no auto-linking. `tokens` (e.g. "A-102") are wrapped in <mark> by splitting the string.
export function Memo({
  text,
  tokens = [],
  className,
  markClassName,
  markRef,
}: {
  text: string;
  tokens?: string[];
  className?: string;
  markClassName?: string;
  markRef?: (el: HTMLElement | null) => void;
}) {
  if (!text) return <span className={cn("text-faint", className)}>—</span>;
  const live = tokens.filter(Boolean);
  if (live.length === 0) return <span className={cn("break-words", className)}>{text}</span>;
  const parts = text.split(new RegExp(`(${live.map(escape).join("|")})`, "g"));
  let first = true;
  return (
    <span className={cn("break-words", className)}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const ref = first ? markRef : undefined;
        first = false;
        return (
          <mark
            key={i}
            ref={ref}
            data-token={part}
            className={cn("rounded-[3px] bg-attacker-soft px-0.5 text-attacker", markClassName)}
          >
            {part}
          </mark>
        );
      })}
    </span>
  );
}
