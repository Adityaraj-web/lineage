// JSON shapes of contracts/vault/src/types.rs. U128 values are decimal strings.

export type Provenance =
  | { UserSigned: { slot: number } }
  | { Resolved: { resolver: string; reference: string } }
  | "Untrusted";

export type PaymentStatus = "Resolving" | "AwaitingApproval" | "Sending" | "Paid" | "Failed" | "Rejected" | "Blocked";

export type PayeeRef =
  | { Signed: { slot: number } }
  | { Resolved: { resolver: string; reference: string } }
  | { Raw: { account_id: string } };

export interface Payment {
  id: number;
  task_id: number;
  agent: string;
  payee: string | null;
  amount: string;
  provenance: Provenance;
  status: PaymentStatus;
  reason: string;
  memo: string;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface SignedPayee {
  account_id: string;
  max_amount: string;
  committed: string;
  label: string;
}

export interface Task {
  id: number;
  agent: string;
  instruction: string;
  budget: string;
  spent: string;
  reserved: string;
  max_per_payment: string;
  created_at_ms: number;
  expires_at_ms: number;
  signed_payees: SignedPayee[];
  resolvers: string[];
  closed: boolean;
}

export interface ConfigView {
  owner: string;
  token: string;
  mode: "Lineage" | "LimitsOnly";
  frozen: boolean;
  balance: string;
  total_reserved: string;
  task_count: number;
  payment_count: number;
}

export interface LineageEvent {
  standard: "lineage";
  version: string;
  event: string;
  data: unknown[];
}
