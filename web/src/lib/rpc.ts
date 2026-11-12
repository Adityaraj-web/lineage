export const DEFAULT_RPC_URLS = [
  "https://test.rpc.fastnear.com",
  "https://rpc.testnet.fastnear.com",
  "https://near-testnet.drpc.org",
];
export const EMPTY_CODE_HASH = "11111111111111111111111111111111";

// name is NEAR's error name (UNKNOWN_ACCOUNT, CONTRACT_EXECUTION_ERROR, ...); never failed over.
export class RpcError extends Error {
  constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

export type AccountInfo =
  | { exists: false }
  | { exists: true; amount: string; codeHash: string; isContract: boolean };

export type AccessKeyPermission =
  | "FullAccess"
  | { receiverId: string; methodNames: string[]; allowance: string | null };

export interface AccessKeyInfo {
  publicKey: string;
  permission: AccessKeyPermission;
}

export interface RpcClient {
  callView<T>(contractId: string, method: string, args?: Record<string, unknown>): Promise<T>;
  viewAccount(accountId: string): Promise<AccountInfo>;
  viewAccessKeyList(accountId: string): Promise<AccessKeyInfo[]>;
  currentUrl(): string;
}

export interface RpcOptions {
  urls?: string[];
  fetch?: typeof fetch;
  timeoutMs?: number;
}

// Referenced literally so Next inlines it into the browser bundle.
export function rpcUrls(envUrl: string | undefined = process.env.NEXT_PUBLIC_NEAR_RPC_URL): string[] {
  const urls = [envUrl || DEFAULT_RPC_URLS[0], ...DEFAULT_RPC_URLS];
  return [...new Set(urls)].filter((u) => !u.includes("rpc.testnet.near.org"));
}

export function encodeArgs(args: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decodeResult<T>(bytes: number[]): T {
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes))) as T;
}

class TransportError extends Error {
  constructor(url: string, message: string) {
    super(`${url}: ${message}`);
    this.name = "TransportError";
  }
}

const TRANSPORT_ERROR_NAMES = new Set(["INTERNAL_ERROR", "TIMEOUT_ERROR"]);

interface JsonRpcError {
  name?: string;
  cause?: { name?: string; info?: unknown };
  message?: string;
  data?: unknown;
}

function errorDetail(e: JsonRpcError): string {
  if (typeof e.data === "string") return e.data;
  if (e.data !== undefined) return JSON.stringify(e.data);
  return e.message ?? "unknown error";
}

export function createRpc(opts: RpcOptions = {}): RpcClient {
  const urls = opts.urls ?? rpcUrls();
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const timeoutMs = opts.timeoutMs ?? 8000;
  let current = 0;

  async function once(url: string, method: string, params: unknown): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    let body: { result?: unknown; error?: JsonRpcError };
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "lineage", method, params }),
        signal: ctrl.signal,
      });
      if (res.status >= 500 || res.status === 429) throw new TransportError(url, `HTTP ${res.status}`);
      body = await res.json();
    } catch (e) {
      if (e instanceof TransportError) throw e;
      const aborted = ctrl.signal.aborted;
      throw new TransportError(url, aborted ? `timeout after ${timeoutMs} ms` : e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
    if (body.error) {
      const name = body.error.cause?.name ?? body.error.name ?? "RPC_ERROR";
      if (TRANSPORT_ERROR_NAMES.has(name) || TRANSPORT_ERROR_NAMES.has(body.error.name ?? "")) {
        throw new TransportError(url, `${name}: ${errorDetail(body.error)}`);
      }
      throw new RpcError(name, errorDetail(body.error));
    }
    if (!res.ok) throw new TransportError(url, `HTTP ${res.status}`);
    const result = body.result as { error?: unknown } | undefined;
    if (result && typeof result.error === "string") throw new RpcError("CONTRACT_EXECUTION_ERROR", result.error);
    return body.result;
  }

  async function request<T>(method: string, params: unknown): Promise<T> {
    let last: unknown;
    for (let attempt = 0; attempt < urls.length; attempt++) {
      const url = urls[current];
      try {
        return (await once(url, method, params)) as T;
      } catch (e) {
        if (!(e instanceof TransportError)) throw e;
        last = e;
        current = (current + 1) % urls.length;
      }
    }
    throw last;
  }

  return {
    async callView<T>(contractId: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
      const r = await request<{ result: number[] }>("query", {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: method,
        args_base64: encodeArgs(args),
      });
      return decodeResult<T>(r.result);
    },

    async viewAccount(accountId: string): Promise<AccountInfo> {
      try {
        const r = await request<{ amount: string; code_hash: string }>("query", {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        });
        return { exists: true, amount: r.amount, codeHash: r.code_hash, isContract: r.code_hash !== EMPTY_CODE_HASH };
      } catch (e) {
        if (e instanceof RpcError && e.name === "UNKNOWN_ACCOUNT") return { exists: false };
        throw e;
      }
    },

    async viewAccessKeyList(accountId: string): Promise<AccessKeyInfo[]> {
      type Raw = {
        public_key: string;
        access_key: {
          permission:
            | "FullAccess"
            | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } };
        };
      };
      const r = await request<{ keys: Raw[] }>("query", {
        request_type: "view_access_key_list",
        finality: "final",
        account_id: accountId,
      });
      return r.keys.map((k) => {
        const p = k.access_key.permission;
        return {
          publicKey: k.public_key,
          permission:
            p === "FullAccess"
              ? "FullAccess"
              : { receiverId: p.FunctionCall.receiver_id, methodNames: p.FunctionCall.method_names, allowance: p.FunctionCall.allowance },
        };
      });
    },

    currentUrl: () => urls[current],
  };
}
