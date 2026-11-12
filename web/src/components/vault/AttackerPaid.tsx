import { fmtUsdc } from "@/lib/format";
import type { AttackerPayments } from "@/lib/story";
import { AccountId, shortId } from "../AccountId";
import { CountUp } from "../CountUp";
import { Memo } from "../Memo";

// LimitsOnly has no inbox: what stands in its place is what it paid the attacker, over every run.
export function AttackerPaid({ paid, attacker, note }: { paid: AttackerPayments; attacker: string; note: string }) {
  return (
    <section id="attacker" aria-labelledby="attacker-title" className="scroll-mt-24">
      <h2 id="attacker-title" className="font-serif text-title">
        Paid to the attacker
      </h2>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
        <div className="stat-box" style={{ "--stat-chars": paid.totalText.length } as React.CSSProperties}>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <CountUp value={paid.total} format={fmtUsdc} className={`stat [--stat-max:5rem] ${paid.total > 0n ? "text-attacker" : "text-p1"}`} />
            {paid.runs > 0 && <span className="text-lead text-muted-foreground">{paid.runsText}</span>}
          </p>
          <p className="mt-4 flex flex-wrap items-baseline gap-1.5 text-small text-muted-foreground">
            to <AccountId id={attacker} link className="text-[13px]" />
          </p>
          <p className="mt-6 max-w-[34rem] text-body text-muted-foreground">{note}</p>
        </div>
        {paid.payments.length > 0 && (
          <ul aria-label="Payments to the attacker" className="surface divide-y divide-white/[0.05] overflow-hidden">
            {paid.payments.map((r) => (
              <li key={r.payment.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 bg-attacker-soft px-5 py-4">
                <span className="num text-small text-muted-foreground">#{r.payment.id}</span>
                <span className="min-w-0 text-small">
                  <Memo text={r.payment.memo} className="line-clamp-1" />
                  <span className="mt-0.5 block text-micro text-faint">
                    task #{r.payment.task_id}, paid without asking to {shortId(attacker)}
                  </span>
                </span>
                <span className="num text-body whitespace-nowrap text-attacker">{r.amount}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
