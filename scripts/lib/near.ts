import { JsonRpcProvider, type Provider } from "near-api-js";
import {
  AccountDoesNotExistError,
  InternalRpcError,
  RpcError,
  TransactionTimeoutError,
} from "near-api-js/rpc-errors";

export const NETWORK = "testnet";
export const EXPLORER = "https://testnet.nearblocks.io";
const DEFAULT_RPC = "https://test.rpc.fastnear.com";
const FALLBACK_RPCS = ["https://rpc.testnet.fastnear.com", "https://near-testnet.drpc.org"];

export function rpcUrls(): string[] {
  const urls = [process.env.NEAR_RPC_URL || DEFAULT_RPC, ...FALLBACK_RPCS];
  return [...new Set(urls)].filter((u) => !u.includes("rpc.testnet.near.org"));
}

function isTransportError(e: unknown): boolean {
  if (e instanceof InternalRpcError || e instanceof TransactionTimeoutError) return true;
  return !(e instanceof RpcError);
}

// FailoverRpcProvider fails over (and console.errors) on every rejection, including
// "account does not exist" and access-key rejections. This only fails over on transport errors.
export function makeProvider(): Provider {
  const providers = rpcUrls().map((url) => new JsonRpcProvider({ url }, { retries: 3 }));
  let current = 0;
  return new Proxy(providers[0], {
    get(_target, prop) {
      const value = (providers[current] as any)[prop];
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        let lastError: unknown;
        for (let attempt = 0; attempt < providers.length; attempt++) {
          const p = providers[current] as any;
          try {
            return await p[prop](...args);
          } catch (e) {
            if (!isTransportError(e)) throw e;
            lastError = e;
            current = (current + 1) % providers.length;
          }
        }
        throw lastError;
      };
    },
  }) as Provider;
}

export async function view<T>(
  provider: Provider,
  contractId: string,
  method: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return (await provider.callFunction({ contractId, method, args })) as T;
}

export async function accountExists(provider: Provider, accountId: string): Promise<boolean> {
  try {
    await provider.viewAccount({ accountId });
    return true;
  } catch (e) {
    if (e instanceof AccountDoesNotExistError) return false;
    throw e;
  }
}

export const USDC_DECIMALS = 6;
export const usdc = (n: number | bigint): bigint => BigInt(n) * 1_000_000n;

export function fmtUsdc(amount: bigint | string): string {
  const v = BigInt(amount);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""} tUSDC`;
}

export function fmtNear(yocto: bigint): string {
  const whole = yocto / 10n ** 24n;
  const frac = ((yocto % 10n ** 24n) / 10n ** 20n).toString().padStart(4, "0");
  return `${whole}.${frac} NEAR`;
}

export const txHash = (res: { transaction: { hash: string } }): string => res.transaction.hash;
export const explorerTx = (hash: string): string => `${EXPLORER}/txns/${hash}`;
export const explorerAccount = (id: string): string => `${EXPLORER}/address/${id}`;

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return `${e.constructor.name}: ${e.message}`;
  return String(e);
}
