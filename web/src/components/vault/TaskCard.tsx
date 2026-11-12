import { cn } from "@/components/cn";
import { fmtAgo, fmtDate, fmtUsdc } from "@/lib/format";
import type { TaskRow } from "@/lib/views";
import { AccountId } from "../AccountId";
import { Glass } from "@/components/Glass";

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-micro font-medium", className)}>
      {children}
    </span>
  );
}

export function TaskCard({ row, now }: { row: TaskRow; now: number }) {
  const t = row.task;
  const spent = Math.min(100, row.spentPct);
  const inFlight = Math.min(100 - spent, row.inFlightPct);
  return (
    <Glass as="article" className="flex flex-col gap-5 p-6" aria-labelledby={`task-${t.id}-title`}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 id={`task-${t.id}-title`} className="num text-small text-muted-foreground">
          Task #{t.id}
        </h3>
        {row.label && (
          <Chip
            className={
              row.label === "latest demo run" ? "border-p2-ring bg-p2-soft text-p2" : "border-white/10 text-muted-foreground"
            }
          >
            {row.label}
          </Chip>
        )}
        {t.closed && <Chip className="border-white/10 text-muted-foreground">closed</Chip>}
        {row.expired && <Chip className="border-white/10 text-muted-foreground">expired</Chip>}
      </header>

      <p className="text-body text-foreground">{t.instruction}</p>

      <div>
        <div
          className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]"
          role="img"
          aria-label={`${row.spent} spent and ${row.inFlight} in flight of a ${row.budget} budget`}
        >
          <span className="h-full bg-foreground/80 transition-[width] duration-500" style={{ width: `${spent}%` }} />
          <span
            className="h-full bg-[repeating-linear-gradient(135deg,var(--color-p3)_0_4px,rgb(251_191_36/0.45)_4px_8px)] transition-[width] duration-500"
            style={{ width: `${inFlight}%` }}
          />
        </div>
        <p className="mt-2 flex flex-wrap justify-between gap-x-4 num text-micro text-muted-foreground">
          <span>
            <span className="text-foreground">{row.spent}</span> spent, <span className="text-p3">{row.inFlight}</span> in
            flight
          </span>
          <span>of {row.budget}</span>
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-small">
        <div>
          <dt className="label">Cap per payment</dt>
          <dd className="mt-1 num">{row.cap}</dd>
        </div>
        <div>
          <dt className="label">Expires</dt>
          <dd className="mt-1 font-mono text-[12.5px]">
            {fmtDate(t.expires_at_ms)} <span className="text-muted-foreground">({fmtAgo(t.expires_at_ms, now)})</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <p className="label">
          <span className="text-p1">P1</span> Payees you signed
        </p>
        {t.signed_payees.length === 0 ? (
          <p className="text-small text-faint">None.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {t.signed_payees.map((s, i) => (
              <li key={i} className="rounded-xl border border-p1-ring/50 bg-p1-soft/60 px-3 py-2">
                <p className="text-small text-p1">{s.label}</p>
                <AccountId id={s.account_id} link />
                <p className="mt-0.5 num text-micro text-muted-foreground">
                  max {fmtUsdc(s.max_amount)}, committed {fmtUsdc(s.committed)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="label">
          <span className="text-p2">P2</span> Resolvers you pinned
        </p>
        {t.resolvers.length === 0 ? (
          <p className="text-small text-faint">None.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {t.resolvers.map((r) => (
              <li key={r} className="rounded-xl border border-p2-ring/50 bg-p2-soft/60 px-3 py-1.5">
                <AccountId id={r} link />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Glass>
  );
}
