import { describe, expect, it } from "vitest";
import { RpcError, createRpc, decodeResult, encodeArgs, rpcUrls } from "./rpc";

const A = "https://a.example";
const B = "https://b.example";

type Reply = Response | Error | ((body: any) => Response | Error);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const ok = (result: unknown) => json({ jsonrpc: "2.0", id: 1, result });
const bytes = (v: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(v)));

const failure = (p: Promise<unknown>): Promise<RpcError> =>
  p.then(
    () => {
      throw new Error("expected a rejection");
    },
    (e: RpcError) => e,
  );

function fakeFetch(replies: Record<string, Reply>) {
  const calls: { url: string; body: any }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body));
    calls.push({ url, body });
    let r = replies[url];
    if (typeof r === "function") r = r(body);
    if (!r) throw new Error(`no reply for ${url}`);
    if (r instanceof Error) throw r;
    return r;
  }) as typeof fetch;
  return { f, calls };
}

const unknownAccount = () =>
  json({
  jsonrpc: "2.0",
  id: 1,
  error: {
    name: "HANDLER_ERROR",
    cause: { info: { requested_account_id: "nope.testnet" }, name: "UNKNOWN_ACCOUNT" },
    code: -32000,
    message: "Server error",
    data: "account nope.testnet does not exist while viewing",
  },
});
const panicInResult = () =>
  ok({
  block_hash: "x",
  block_height: 1,
  error: "wasm execution failed with error: MethodResolveError(MethodNotFound)",
  logs: [],
});
const panicInError = () =>
  json({
  jsonrpc: "2.0",
  id: 1,
  error: {
    name: "HANDLER_ERROR",
    cause: { info: {}, name: "CONTRACT_EXECUTION_ERROR" },
    code: -32000,
    message: "Server error",
    data: "Smart contract panicked: No such payment",
  },
});

describe("rpcUrls", () => {
  it("puts the env url first, dedupes, and keeps the fastnear default", () => {
    expect(rpcUrls(undefined)).toEqual([
      "https://test.rpc.fastnear.com",
      "https://rpc.testnet.fastnear.com",
      "https://near-testnet.drpc.org",
    ]);
    expect(rpcUrls("https://rpc.testnet.fastnear.com")).toEqual([
      "https://rpc.testnet.fastnear.com",
      "https://test.rpc.fastnear.com",
      "https://near-testnet.drpc.org",
    ]);
    expect(rpcUrls("https://my.rpc")[0]).toBe("https://my.rpc");
  });

  it("drops rpc.testnet.near.org even when set through the env var", () => {
    const urls = rpcUrls("https://rpc.testnet.near.org");
    expect(urls.some((u) => u.includes("rpc.testnet.near.org"))).toBe(false);
    expect(urls[0]).toBe("https://test.rpc.fastnear.com");
  });
});

describe("args and results", () => {
  it("encodes args as base64 JSON, including non-ASCII", () => {
    const args = { account_id: "alice.testnet", memo: "EN→HI ✓" };
    const b64 = encodeArgs(args);
    expect(b64).toBe(Buffer.from(JSON.stringify(args), "utf8").toString("base64"));
  });

  it("decodes the result byte array as UTF-8 JSON", () => {
    const v = { label: "Alice — logo", amount: "18000000", n: 3 };
    expect(decodeResult(bytes(v))).toEqual(v);
  });

  it("sends a final call_function query with base64 args", async () => {
    const { f, calls } = fakeFetch({ [A]: ok({ result: bytes({ mode: "Lineage" }), logs: [] }) });
    const rpc = createRpc({ urls: [A], fetch: f });
    expect(await rpc.callView("vault.testnet", "get_payment", { payment_id: 5 })).toEqual({ mode: "Lineage" });
    expect(calls[0].body.method).toBe("query");
    expect(calls[0].body.params).toEqual({
      request_type: "call_function",
      finality: "final",
      account_id: "vault.testnet",
      method_name: "get_payment",
      args_base64: Buffer.from('{"payment_id":5}').toString("base64"),
    });
  });
});

describe("failover", () => {
  const good = () => ok({ result: bytes(42), logs: [] });

  it("fails over to the next url on a network error", async () => {
    const { f, calls } = fakeFetch({ [A]: new TypeError("fetch failed"), [B]: good });
    const rpc = createRpc({ urls: [A, B], fetch: f });
    expect(await rpc.callView("c", "m")).toBe(42);
    expect(calls.map((c) => c.url)).toEqual([A, B]);
    expect(rpc.currentUrl()).toBe(B);
  });

  it("fails over on HTTP 503 and 429", async () => {
    for (const status of [503, 429]) {
      const { f, calls } = fakeFetch({ [A]: () => new Response("busy", { status }), [B]: good });
      expect(await createRpc({ urls: [A, B], fetch: f }).callView("c", "m")).toBe(42);
      expect(calls.map((c) => c.url)).toEqual([A, B]);
    }
  });

  it("fails over on INTERNAL_ERROR and TIMEOUT_ERROR", async () => {
    for (const name of ["INTERNAL_ERROR", "TIMEOUT_ERROR"]) {
      const bad = () =>
        json({ jsonrpc: "2.0", id: 1, error: { name, cause: { name, info: {} }, code: -32000, message: "x" } });
      const { f, calls } = fakeFetch({ [A]: bad, [B]: good });
      expect(await createRpc({ urls: [A, B], fetch: f }).callView("c", "m")).toBe(42);
      expect(calls.map((c) => c.url)).toEqual([A, B]);
    }
  });

  it("fails over on a timeout", async () => {
    const hang = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === B) return good();
      return new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
      );
    }) as typeof fetch;
    expect(await createRpc({ urls: [A, B], fetch: hang, timeoutMs: 20 }).callView("c", "m")).toBe(42);
  });

  it("throws the last transport error when every url fails", async () => {
    const { f } = fakeFetch({ [A]: new TypeError("fetch failed"), [B]: new Response("", { status: 502 }) });
    await expect(createRpc({ urls: [A, B], fetch: f }).callView("c", "m")).rejects.toThrow(/502/);
  });

  it("does not fail over on UNKNOWN_ACCOUNT", async () => {
    const { f, calls } = fakeFetch({ [A]: unknownAccount, [B]: good });
    const err = await failure(createRpc({ urls: [A, B], fetch: f })
      .callView("nope.testnet", "m"));
    expect(err).toBeInstanceOf(RpcError);
    expect(err.name).toBe("UNKNOWN_ACCOUNT");
    expect(calls.map((c) => c.url)).toEqual([A]);
  });

  it("does not fail over on a contract panic reported as result.error", async () => {
    const { f, calls } = fakeFetch({ [A]: panicInResult, [B]: good });
    const err = await failure(createRpc({ urls: [A, B], fetch: f })
      .callView("c", "no_such"));
    expect(err).toBeInstanceOf(RpcError);
    expect(err.name).toBe("CONTRACT_EXECUTION_ERROR");
    expect(err.message).toMatch(/MethodNotFound/);
    expect(calls.map((c) => c.url)).toEqual([A]);
  });

  it("does not fail over on a contract panic reported as a JSON-RPC error", async () => {
    const { f, calls } = fakeFetch({ [A]: panicInError, [B]: good });
    const err = await failure(createRpc({ urls: [A, B], fetch: f })
      .callView("c", "get_payment"));
    expect(err).toBeInstanceOf(RpcError);
    expect(err.name).toBe("CONTRACT_EXECUTION_ERROR");
    expect(err.message).toMatch(/No such payment/);
    expect(calls.map((c) => c.url)).toEqual([A]);
  });
});

describe("accounts and keys", () => {
  it("viewAccount maps UNKNOWN_ACCOUNT to exists: false", async () => {
    const { f } = fakeFetch({ [A]: unknownAccount });
    expect(await createRpc({ urls: [A], fetch: f }).viewAccount("nope.testnet")).toEqual({ exists: false });
  });

  it("viewAccount detects a contract by code hash", async () => {
    const account = (code_hash: string) => ok({ amount: "5", locked: "0", code_hash, storage_usage: 1 });
    const plain = createRpc({ urls: [A], fetch: fakeFetch({ [A]: account("11111111111111111111111111111111") }).f });
    expect(await plain.viewAccount("a")).toEqual({
      exists: true,
      amount: "5",
      codeHash: "11111111111111111111111111111111",
      isContract: false,
    });
    const contract = createRpc({ urls: [A], fetch: fakeFetch({ [A]: account("9pF2pK5bJxnG") }).f });
    expect(await contract.viewAccount("a")).toMatchObject({ exists: true, codeHash: "9pF2pK5bJxnG", isContract: true });
  });

  it("viewAccessKeyList maps FullAccess and FunctionCall keys", async () => {
    const reply = ok({
      keys: [
        {
          public_key: "ed25519:A",
          access_key: {
            nonce: 1,
            permission: {
              FunctionCall: { allowance: "199", method_names: ["request_payment"], receiver_id: "vault.testnet" },
            },
          },
        },
        { public_key: "ed25519:B", access_key: { nonce: 2, permission: "FullAccess" } },
      ],
    });
    const { f, calls } = fakeFetch({ [A]: reply });
    expect(await createRpc({ urls: [A], fetch: f }).viewAccessKeyList("agent.testnet")).toEqual([
      {
        publicKey: "ed25519:A",
        permission: { receiverId: "vault.testnet", methodNames: ["request_payment"], allowance: "199" },
      },
      { publicKey: "ed25519:B", permission: "FullAccess" },
    ]);
    expect(calls[0].body.params).toEqual({
      request_type: "view_access_key_list",
      finality: "final",
      account_id: "agent.testnet",
    });
  });
});
