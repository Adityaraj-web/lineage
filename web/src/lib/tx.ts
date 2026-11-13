export interface TxResult {
  hash: string | null;
  ok: boolean;
  error: string | null;
  value: string | null;
}

const MAX_MESSAGE = 160;
export const CANCELLED = "Cancelled in the wallet";
const NO_RESULT = "The wallet returned no result. The refresh shows what happened.";
const CANCELLED_RE = /user (rejected|cancel|closed|denied)|rejected by (the )?user|cancel+ed|(window|popup|modal) (was )?closed/i;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const cut = (s: string): string => Array.from(s).slice(0, MAX_MESSAGE).join("");
const firstKey = (v: unknown): string | null => (isObj(v) ? (Object.keys(v)[0] ?? null) : null);

function describeFailure(f: unknown): string {
  if (isObj(f)) {
    const action = f.ActionError;
    if (isObj(action)) {
      const kind = action.kind;
      const fnErr = isObj(kind) ? kind.FunctionCallError : undefined;
      const exec = isObj(fnErr) ? str(fnErr.ExecutionError) : null;
      if (exec) return cut(exec);
      const k = firstKey(kind);
      if (k) return `ActionError: ${k}`;
    }
    const invalid = firstKey(f.InvalidTxError) ?? str(f.InvalidTxError);
    if (invalid) return cut(`InvalidTxError: ${invalid}`);
  }
  return "Transaction failed";
}

function decodeValue(b64: string): string | null {
  if (b64.length === 0) return null;
  try {
    const bin = atob(b64);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

function failureOf(status: unknown): { failure: unknown } | null {
  return isObj(status) && "Failure" in status ? { failure: status.Failure } : null;
}

export function parseOutcome(raw: unknown): TxResult {
  if (!isObj(raw)) return { hash: null, ok: false, error: NO_RESULT, value: null };
  const tx = raw.transaction;
  const txo = raw.transaction_outcome;
  const hash = (isObj(tx) ? str(tx.hash) : null) ?? (isObj(txo) ? str(txo.id) : null);

  const receipts = Array.isArray(raw.receipts_outcome) ? raw.receipts_outcome : [];
  const found =
    failureOf(raw.status) ??
    receipts.map((r) => (isObj(r) && isObj(r.outcome) ? failureOf(r.outcome.status) : null)).find((f) => f !== null) ??
    null;
  if (found) return { hash, ok: false, error: describeFailure(found.failure), value: null };

  if (isObj(raw.status) && typeof raw.status.SuccessValue === "string") {
    return { hash, ok: true, error: null, value: decodeValue(raw.status.SuccessValue) };
  }
  if (hash) return { hash, ok: true, error: null, value: null };
  return { hash: null, ok: false, error: NO_RESULT, value: null };
}

export function walletErrorMessage(e: unknown): string {
  const msg = typeof e === "string" ? e : isObj(e) ? str(e.message) : null;
  if (!msg) return "Wallet error";
  if (CANCELLED_RE.test(msg)) return CANCELLED;
  return cut(msg);
}
