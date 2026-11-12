import testnet from "../shared/testnet.json";
import type { PaymentStatus, Provenance } from "../shared/vault-types";

export type VaultKey = "vault" | "guarded";
export const VAULT_KEYS: readonly VaultKey[] = ["vault", "guarded"];
export type VaultMode = "Lineage" | "LimitsOnly";

export interface DemoRunPayment {
  message: string;
  tool: string;
  outcome: string;
  reason: string;
  txHash?: string;
  payment?: { id: number; provenance: Provenance; status: PaymentStatus; payee: string | null; amount: string };
}

export interface DemoRunVault {
  vault: string;
  mode: VaultMode;
  agent: string;
  taskId: number;
  payments: DemoRunPayment[];
}

export interface DemoRun {
  runId: string;
  network: string;
  root: string;
  ran: VaultKey[];
  vaults: Partial<Record<VaultKey, DemoRunVault>>;
  attacker: { account: string; before: string; after: string; delta: string };
}

export const DEPLOYMENT = testnet;

export const CONTRACTS = testnet.contracts;
export const VAULT_IDS: Record<VaultKey, string> = { vault: testnet.contracts.vault, guarded: testnet.contracts.guarded };
export const AGENT_IDS: Record<VaultKey, string> = {
  vault: testnet.agents.vault.account,
  guarded: testnet.agents.guarded.account,
};
export const ACTORS = testnet.actors;
export const EXPLORER = testnet.explorer;

export const explorerTx = (hash: string): string => `${EXPLORER}/txns/${hash}`;
export const explorerAccount = (id: string): string => `${EXPLORER}/address/${id}`;
