import { describe, expect, it } from "vitest";
import { PAGE, makeChain } from "./chain";
import type { RpcClient } from "./rpc";
import { payment } from "./test-fixtures";

function fakeRpc(total: number) {
  const calls: { contract: string; method: string; args: any }[] = [];
  const rpc: RpcClient = {
    async callView<T>(contract: string, method: string, args: Record<string, unknown> = {}) {
      calls.push({ contract, method, args });
      if (method === "get_payments" || method === "get_tasks") {
        const from = args.from_index as number;
        const n = Math.max(0, Math.min(args.limit as number, total - from));
        return Array.from({ length: n }, (_, i) => payment({ id: from + i, amount: "9007199254740993" })) as T;
      }
      if (method === "get_payment") return null as T;
      if (method === "ft_balance_of") return "98000000" as T;
      throw new Error(`unexpected ${method}`);
    },
    async viewAccount() {
      return { exists: true, amount: "1", codeHash: "H", isContract: true };
    },
    async viewAccessKeyList() {
      return [];
    },
    currentUrl: () => "fake",
  };
  return { rpc, calls };
}

describe("chain", () => {
  it("pages payments by 50 until a short page", async () => {
    const { rpc, calls } = fakeRpc(2 * PAGE + 3);
    const all = await makeChain(rpc, { registry: "r", usdc: "u" }).getAllPayments("v");
    expect(all.map((p) => p.id)).toEqual(Array.from({ length: 2 * PAGE + 3 }, (_, i) => i));
    expect(calls.map((c) => c.args)).toEqual([
      { from_index: 0, limit: 50 },
      { from_index: 50, limit: 50 },
      { from_index: 100, limit: 50 },
    ]);
    expect(all[0].amount).toBe("9007199254740993");
  });

  it("stops after an exactly full page followed by an empty one", async () => {
    const { rpc, calls } = fakeRpc(PAGE);
    expect(await makeChain(rpc, { registry: "r", usdc: "u" }).getAllTasks("v")).toHaveLength(PAGE);
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("get_tasks");
  });

  it("reads the token balance and code hash", async () => {
    const { rpc, calls } = fakeRpc(0);
    const c = makeChain(rpc, { registry: "r", usdc: "u" });
    expect(await c.ftBalance("a")).toBe("98000000");
    expect(calls[0]).toEqual({ contract: "u", method: "ft_balance_of", args: { account_id: "a" } });
    expect(await c.codeHash("a")).toBe("H");
    expect(await c.getPayment("v", 99)).toBeNull();
  });
});
