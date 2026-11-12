import type { OwnerTx } from "./actions";

export interface WalletPort {
  accountId: string | null;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(tx: OwnerTx): Promise<unknown>;
}

export type Role = "disconnected" | "viewer" | "owner";

// Exact match: NEAR account ids are lowercase, so any normalising would only hide a wrong id.
export function roleFor(accountId: string | null, owner: string | null): Role {
  if (accountId === null) return "disconnected";
  return owner !== null && accountId === owner ? "owner" : "viewer";
}
