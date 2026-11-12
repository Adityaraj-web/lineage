import type { ConfigView, Payment, Task } from "../shared/vault-types";
import { CONTRACTS } from "./config";
import { createRpc, type AccessKeyInfo, type AccountInfo, type RpcClient } from "./rpc";

export interface PayeeStats {
  payments: number;
  total: string;
  first_paid_at_ms: number;
  last_paid_at_ms: number;
}

export type ServiceStatus = "Pending" | "Verified" | "Revoked";

export interface Service {
  id: string;
  payee: string;
  price: string;
  description: string;
  status: ServiceStatus;
  updated_at_ms: number;
}

export const PAGE = 50;

export interface Chain {
  getConfig(vault: string): Promise<ConfigView>;
  getAllTasks(vault: string): Promise<Task[]>;
  getAllPayments(vault: string): Promise<Payment[]>;
  getPayment(vault: string, id: number): Promise<Payment | null>;
  getAwaitingApproval(vault: string): Promise<Payment[]>;
  getPayeeStats(vault: string, account: string): Promise<PayeeStats>;
  listServices(): Promise<Service[]>;
  ftBalance(account: string): Promise<string>;
  codeHash(account: string): Promise<string | null>;
  viewAccount(account: string): Promise<AccountInfo>;
  accessKeys(account: string): Promise<AccessKeyInfo[]>;
}

async function pageAll<T>(fetchPage: (from_index: number, limit: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await fetchPage(from, PAGE);
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

export function makeChain(rpc: RpcClient, contracts: { registry: string; usdc: string } = CONTRACTS): Chain {
  return {
    getConfig: (vault) => rpc.callView<ConfigView>(vault, "get_config"),
    getAllTasks: (vault) => pageAll((from_index, limit) => rpc.callView<Task[]>(vault, "get_tasks", { from_index, limit })),
    getAllPayments: (vault) =>
      pageAll((from_index, limit) => rpc.callView<Payment[]>(vault, "get_payments", { from_index, limit })),
    getPayment: (vault, id) => rpc.callView<Payment | null>(vault, "get_payment", { payment_id: id }),
    getAwaitingApproval: (vault) => rpc.callView<Payment[]>(vault, "get_awaiting_approval"),
    getPayeeStats: (vault, account) => rpc.callView<PayeeStats>(vault, "get_payee_stats", { account_id: account }),
    listServices: () =>
      pageAll((from_index, limit) => rpc.callView<Service[]>(contracts.registry, "list_services", { from_index, limit })),
    ftBalance: (account) => rpc.callView<string>(contracts.usdc, "ft_balance_of", { account_id: account }),
    codeHash: async (account) => {
      const a = await rpc.viewAccount(account);
      return a.exists ? a.codeHash : null;
    },
    viewAccount: (account) => rpc.viewAccount(account),
    accessKeys: (account) => rpc.viewAccessKeyList(account),
  };
}

let defaultChain: Chain | null = null;
export function chain(): Chain {
  defaultChain ??= makeChain(createRpc());
  return defaultChain;
}
