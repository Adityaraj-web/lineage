"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { cn } from "@/components/cn";
import { Glass } from "@/components/Glass";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { fmtUsdc } from "@/lib/format";
import {
  INSTRUCTION_MAX_BYTES,
  TTL_OPTIONS,
  createTaskTx,
  demoMandateForm,
  validateMandate,
  type CreateTaskArgs,
  type MandateForm as MandateFormData,
} from "@/lib/mandate";
import type { Task } from "@/shared/vault-types";
import { TxResult } from "../wallet/TxResult";
import { CREATE_TASK_ID, type OwnerControls } from "../wallet/useOwnerAction";
import { Expand, WALLET_NOTE } from "./OwnerActions";
import { BTN, FIELD_ERROR, INPUT, PILL, WAITING } from "./owner-ui";

export const RESOLVER_NOTE = "The vault pays exactly what these return. Add only resolvers you trust.";
export const TTL_LABELS: Record<number, string> = { 60: "1 hour", 1440: "1 day", 10080: "7 days", 20160: "14 days" };
const MAX_PAYEES = 20;
const MAX_RESOLVERS = 5;
const isTtl = (n: number): boolean => (TTL_OPTIONS as readonly number[]).includes(n);
const ttlLabel = (m: number): string => TTL_LABELS[m] ?? `${m} minutes`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type PayeeRow = { uid: number; accountId: string; max: string; label: string };
type ResolverRow = { uid: number; id: string };
type Draft = Omit<MandateFormData, "payees" | "resolvers"> & { payees: PayeeRow[]; resolvers: ResolverRow[] };

const toForm = ({ payees, resolvers, ...rest }: Draft): MandateFormData => ({
  ...rest,
  payees: payees.map(({ accountId, max, label }) => ({ accountId, max, label })),
  resolvers: resolvers.map((r) => r.id),
});

interface FieldA11y {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

function Field({
  label,
  labelClassName,
  error,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  labelClassName?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: (a: FieldA11y) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("label", labelClassName)}>
        {label}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-micro text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={FIELD_ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

function Amount(props: FieldA11y & { value: string; disabled: boolean; label?: string; onChange(v: string): void; onBlur(): void }) {
  const { value, disabled, label, onChange, onBlur, ...a11y } = props;
  return (
    <div className="relative">
      <input
        {...a11y}
        aria-label={label}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(INPUT, "num pr-16")}
      />
      <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-small text-muted-foreground">
        tUSDC
      </span>
    </div>
  );
}

function Mono({ children }: { children: string }) {
  return <span className="font-mono text-[13px] text-foreground [overflow-wrap:anywhere]">{children}</span>;
}

function RemoveButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick(): void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="press inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover-fine:bg-white/[0.06] hover-fine:text-foreground focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  );
}

function Confirm({ args }: { args: CreateTaskArgs }) {
  return (
    <>
      <dl className="grid gap-x-6 gap-y-4 text-small sm:grid-cols-3">
        <div className="sm:col-span-3">
          <dt className="label">Agent</dt>
          <dd className="mt-1">
            <Mono>{args.agent}</Mono>
          </dd>
        </div>
        <div>
          <dt className="label">Budget</dt>
          <dd className="mt-1 num text-body text-foreground">{fmtUsdc(args.budget)}</dd>
        </div>
        <div>
          <dt className="label">Max per payment</dt>
          <dd className="mt-1 num text-body text-foreground">{fmtUsdc(args.max_per_payment)}</dd>
        </div>
        <div>
          <dt className="label">Expires in</dt>
          <dd className="mt-1 num text-body text-foreground">{ttlLabel(args.ttl_minutes)}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="label">Instruction</dt>
          <dd className="mt-1 text-body whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{args.instruction}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <p className="label">
          <span className="text-p1">P1</span> Payees you sign
        </p>
        {args.signed_payees.length === 0 ? (
          <p className="text-small text-muted-foreground">None.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {args.signed_payees.map((p) => (
              <li key={p.account_id} className="flex flex-col gap-0.5 rounded-xl border border-p1-ring/50 bg-p1-soft/60 px-3 py-2">
                <span className="text-small text-p1 [overflow-wrap:anywhere]">{p.label}</span>
                <Mono>{p.account_id}</Mono>
                <span className="num text-micro text-muted-foreground">max {fmtUsdc(p.max_amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="label">
          <span className="text-p2">P2</span> Resolvers you pin
        </p>
        {args.resolvers.length === 0 ? (
          <p className="text-small text-muted-foreground">None.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {args.resolvers.map((r) => (
              <li key={r} className="rounded-xl border border-p2-ring/50 bg-p2-soft/60 px-3 py-1.5">
                <Mono>{r}</Mono>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

// Owner only, inline in the Tasks section. The confirm and the transaction come from the validated
// args, never from the raw inputs.
export function MandateForm({
  owner,
  initial,
  demoAgent,
  task0,
  onClose,
}: {
  owner: OwnerControls;
  initial: MandateFormData;
  demoAgent: string;
  task0: Task | null;
  onClose(): void;
}) {
  const { state, busy, run } = owner.action;
  const uid = useRef(0);
  const toDraft = (f: MandateFormData): Draft => ({
    ...f,
    payees: f.payees.map((p) => ({ uid: ++uid.current, ...p })),
    resolvers: f.resolvers.map((id) => ({ uid: ++uid.current, id })),
  });
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [attempted, setAttempted] = useState(false);
  const [args, setArgs] = useState<CreateTaskArgs | null>(null);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const focusNext = useRef<string | null>("input");
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const ttlId = useId();

  useEffect(() => {
    const sel = focusNext.current;
    if (!sel) return;
    focusNext.current = null;
    formRef.current?.querySelector<HTMLElement>(sel)?.focus();
  });

  const mine = sent && state.kind !== "idle" && state.id === CREATE_TASK_ID;
  const succeeded = mine && state.kind === "done" && state.result.ok;
  useEffect(() => {
    if (succeeded) closeRef.current();
  }, [succeeded]);

  const result = validateMandate(toForm(draft));
  const errors = result.ok ? {} : result.errors;
  const show = (key: string, touchKey = key) => (attempted || touched.has(touchKey) ? errors[key] : undefined);
  const touch = (key: string) => () => setTouched((t) => (t.has(key) ? t : new Set(t).add(key)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setPayee = (uidOf: number, patch: Partial<PayeeRow>) =>
    setDraft((d) => ({ ...d, payees: d.payees.map((p) => (p.uid === uidOf ? { ...p, ...patch } : p)) }));
  const setResolver = (uidOf: number, id: string) =>
    setDraft((d) => ({ ...d, resolvers: d.resolvers.map((r) => (r.uid === uidOf ? { ...r, id } : r)) }));

  const addPayee = () => {
    const row = { uid: ++uid.current, accountId: "", max: "", label: "" };
    focusNext.current = `[data-row="p${row.uid}"] input`;
    setDraft((d) => ({ ...d, payees: [...d.payees, row] }));
  };
  const addResolver = () => {
    const row = { uid: ++uid.current, id: "" };
    focusNext.current = `[data-row="r${row.uid}"] input`;
    setDraft((d) => ({ ...d, resolvers: [...d.resolvers, row] }));
  };
  const removePayee = (uidOf: number) => {
    focusNext.current = '[data-add="payee"]';
    setDraft((d) => ({ ...d, payees: d.payees.filter((p) => p.uid !== uidOf) }));
  };
  const removeResolver = (uidOf: number) => {
    focusNext.current = '[data-add="resolver"]';
    setDraft((d) => ({ ...d, resolvers: d.resolvers.filter((r) => r.uid !== uidOf) }));
  };

  const fillDemo = () => {
    if (!task0) return;
    setDraft(toDraft(demoMandateForm(task0)));
    setTouched(new Set());
    setAttempted(false);
    setArgs(null);
    focusNext.current = "input";
  };

  const review = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (result.ok) {
      setArgs(result.args);
      focusNext.current = '[data-action="sign"]';
    } else {
      focusNext.current = '[aria-invalid="true"]';
    }
  };
  const edit = () => {
    setArgs(null);
    focusNext.current = '[data-action="review"]';
  };
  const sign = () => {
    if (!args || busy) return;
    setSent(true);
    void run(CREATE_TASK_ID, createTaskTx(owner.vault, args));
  };

  const bytes = new TextEncoder().encode(draft.instruction.trim()).length;
  const left = INSTRUCTION_MAX_BYTES - bytes;
  const signing = busy && state.kind === "signing" && state.id === CREATE_TASK_ID;
  const failed = mine && (state.kind === "failed" || (state.kind === "done" && !state.result.ok));

  return (
    <Glass as="form" ref={formRef} aria-labelledby={titleId} noValidate onSubmit={review} className="flex flex-col gap-7 p-6 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={titleId} className="text-body font-medium text-foreground">
          New task
        </h3>
        <div className="flex flex-wrap gap-2">
          {task0 && (
            <button type="button" disabled={busy} onClick={fillDemo} className={PILL}>
              Use demo mandate
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose} className={PILL}>
            Cancel
          </button>
        </div>
      </header>

      {args ? (
        <Expand>
          <div role="group" aria-label="Confirm new task" className="flex flex-col gap-6">
            <Confirm args={args} />
            <div className="flex flex-col gap-3 md:flex-row">
              <button type="button" data-action="sign" disabled={busy} onClick={sign} className={BTN.primary}>
                {signing ? WAITING : "Sign in wallet"}
              </button>
              <button type="button" disabled={busy} onClick={edit} className={BTN.quiet}>
                Edit
              </button>
            </div>
            <p className="text-small text-muted-foreground">{WALLET_NOTE}</p>
          </div>
        </Expand>
      ) : (
        <>
          <Field
            label="Agent"
            error={show("agent")}
            hint={
              draft.agent.trim() !== demoAgent ? (
                <>
                  <code className="font-mono">npm run demo -- --task</code> runs only agent-l
                </>
              ) : undefined
            }
          >
            {(a) => (
              <input
                {...a}
                type="text"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={draft.agent}
                disabled={busy}
                onChange={(e) => set("agent", e.target.value)}
                onBlur={touch("agent")}
                className={cn(INPUT, "font-mono text-[13px]")}
              />
            )}
          </Field>

          <Field
            label="Instruction"
            error={show("instruction")}
            hint={<span className="num">{left >= 0 ? `${plural(left, "byte")} left` : `${plural(-left, "byte")} over`}</span>}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                value={draft.instruction}
                disabled={busy}
                onChange={(e) => set("instruction", e.target.value)}
                onBlur={touch("instruction")}
                className={cn(INPUT, "resize-y")}
              />
            )}
          </Field>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Budget" error={show("budget")}>
              {(a) => <Amount {...a} value={draft.budget} disabled={busy} onChange={(v) => set("budget", v)} onBlur={touch("budget")} />}
            </Field>
            <Field label="Max per payment" error={show("maxPerPayment")}>
              {(a) => (
                <Amount {...a} value={draft.maxPerPayment} disabled={busy} onChange={(v) => set("maxPerPayment", v)} onBlur={touch("maxPerPayment")} />
              )}
            </Field>
          </div>

          <div className="flex flex-col gap-1.5">
            <span id={ttlId} className="label">
              Expires in
            </span>
            <ToggleGroup
              type="single"
              value={String(draft.ttlMinutes)}
              onValueChange={(v) => {
                const n = Number(v);
                if (isTtl(n)) set("ttlMinutes", n);
              }}
              aria-labelledby={ttlId}
              disabled={busy}
              spacing={1}
              className="flex-wrap"
            >
              {TTL_OPTIONS.map((m) => (
                <ToggleGroupItem key={m} value={String(m)} className="num h-9 rounded-full px-3.5 text-small data-[state=on]:bg-white/[0.09]">
                  {TTL_LABELS[m]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="label mb-3">
              <span className="text-p1">P1</span> Payees you sign
            </legend>
            {draft.payees.map((p, i) => {
              const n = i + 1;
              return (
                <div key={p.uid} data-row={`p${p.uid}`} className="rounded-xl border border-white/[0.06] p-4">
                  <div className="-mt-2 -mr-2 mb-1 flex items-center justify-between">
                    <p className="num text-small text-muted-foreground">Payee {n}</p>
                    <RemoveButton label={`Remove payee ${n}`} disabled={busy} onClick={() => removePayee(p.uid)} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
                    <Field label="Account" error={show(`payees.${i}.accountId`, `p${p.uid}.accountId`)}>
                      {(a) => (
                        <input
                          {...a}
                          aria-label={`Payee ${n} account`}
                          type="text"
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={p.accountId}
                          disabled={busy}
                          onChange={(e) => setPayee(p.uid, { accountId: e.target.value })}
                          onBlur={touch(`p${p.uid}.accountId`)}
                          className={cn(INPUT, "font-mono text-[13px]")}
                        />
                      )}
                    </Field>
                    <Field label="Max" error={show(`payees.${i}.max`, `p${p.uid}.max`)}>
                      {(a) => (
                        <Amount
                          {...a}
                          label={`Payee ${n} max`}
                          value={p.max}
                          disabled={busy}
                          onChange={(v) => setPayee(p.uid, { max: v })}
                          onBlur={touch(`p${p.uid}.max`)}
                        />
                      )}
                    </Field>
                    <Field label="Label" error={show(`payees.${i}.label`, `p${p.uid}.label`)}>
                      {(a) => (
                        <input
                          {...a}
                          aria-label={`Payee ${n} label`}
                          type="text"
                          autoComplete="off"
                          value={p.label}
                          disabled={busy}
                          onChange={(e) => setPayee(p.uid, { label: e.target.value })}
                          onBlur={touch(`p${p.uid}.label`)}
                          className={INPUT}
                        />
                      )}
                    </Field>
                  </div>
                </div>
              );
            })}
            {show("payees") && <p className={FIELD_ERROR}>{show("payees")}</p>}
            {draft.payees.length < MAX_PAYEES && (
              <button type="button" data-add="payee" disabled={busy} onClick={addPayee} className={cn(PILL, "self-start")}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add payee
              </button>
            )}
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="label mb-1">
              <span className="text-p2">P2</span> Resolvers you pin
            </legend>
            <p className="max-w-prose text-small text-muted-foreground">{RESOLVER_NOTE}</p>
            {draft.resolvers.map((r, i) => (
              <div key={r.uid} data-row={`r${r.uid}`} className="flex items-start gap-2">
                <Field className="flex-1" label={`Resolver ${i + 1}`} labelClassName="sr-only" error={show(`resolvers.${i}`, `r${r.uid}`)}>
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={r.id}
                      disabled={busy}
                      onChange={(e) => setResolver(r.uid, e.target.value)}
                      onBlur={touch(`r${r.uid}`)}
                      className={cn(INPUT, "font-mono text-[13px]")}
                    />
                  )}
                </Field>
                <RemoveButton label={`Remove resolver ${i + 1}`} disabled={busy} onClick={() => removeResolver(r.uid)} />
              </div>
            ))}
            {show("resolvers") && <p className={FIELD_ERROR}>{show("resolvers")}</p>}
            {draft.resolvers.length < MAX_RESOLVERS && (
              <button type="button" data-add="resolver" disabled={busy} onClick={addResolver} className={cn(PILL, "self-start")}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add resolver
              </button>
            )}
          </fieldset>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-5">
            <button type="submit" data-action="review" disabled={busy} className={BTN.primary}>
              Review
            </button>
            <p className="text-small text-muted-foreground">Nothing is sent until you sign in your wallet.</p>
          </div>
        </>
      )}

      {failed && <TxResult state={state} />}
    </Glass>
  );
}
