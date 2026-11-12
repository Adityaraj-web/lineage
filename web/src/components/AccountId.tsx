import { ArrowUpRight } from "lucide-react";
import { cn } from "cn";
import { DEPLOYMENT, explorerAccount } from "@/lib/config";

const SUFFIX = `.${DEPLOYMENT.root}`;

// Mono account id with the deployment root dimmed: vendor-payments.lineage-aditya.testnet.
// The full id is always in the DOM.
export function AccountId({ id, link = false, className }: { id: string; link?: boolean; className?: string }) {
  const head = id.endsWith(SUFFIX) ? id.slice(0, -SUFFIX.length) : id;
  const tail = id.endsWith(SUFFIX) ? SUFFIX : "";
  const body = (
    <>
      <span className="text-foreground">{head}</span>
      {tail && (
        <>
          <wbr />
          <span className="whitespace-nowrap text-faint">{tail}</span>
        </>
      )}
    </>
  );
  const cls = cn("font-mono text-[12.5px] [overflow-wrap:anywhere]", className);
  if (!link) return <span className={cls}>{body}</span>;
  return (
    <a
      href={explorerAccount(id)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(cls, "group inline rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2")}
    >
      {body}
      <ArrowUpRight
        className="ml-0.5 inline size-3 align-[-1px] text-faint opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </a>
  );
}
