import { describe, expect, it } from "vitest";
import { AGENT_IDS, CONTRACTS } from "./config";
import {
  BUDGET_MAX,
  INSTRUCTION_MAX_BYTES,
  LABEL_MAX,
  TASK_GAS,
  TTL_OPTIONS,
  createTaskTx,
  createdTaskId,
  demoMandateForm,
  emptyMandateForm,
  isAccountId,
  parseUsdc,
  toUsdcInput,
  validateMandate,
  type CreateTaskArgs,
  type MandateForm,
} from "./mandate";
import { parseOutcome } from "./tx";
import { AGENT_L, ALICE, REGISTRY, VAULT, demoTask } from "./test-fixtures";

const DEMO_INSTRUCTION =
  "Get our landing page translated to Hindi via the verified registry, and pay Alice up to 20 tUSDC for the logo.";

const base = (over: Partial<MandateForm> = {}): MandateForm => ({
  agent: AGENT_L,
  instruction: "Pay Alice for the logo.",
  budget: "100",
  maxPerPayment: "50",
  ttlMinutes: 1440,
  payees: [{ accountId: ALICE, max: "20", label: "Alice — logo" }],
  resolvers: [REGISTRY],
  ...over,
});

const payee = (i: number) => ({ accountId: `p${i}.${ALICE}`, max: "1", label: `P${i}` });

function okArgs(f: MandateForm): CreateTaskArgs {
  const r = validateMandate(f);
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.errors)}`);
  return r.args;
}
function errs(f: MandateForm) {
  const r = validateMandate(f);
  if (r.ok) throw new Error("expected errors");
  return r.errors;
}

describe("constants", () => {
  it("are exact", () => {
    expect(TASK_GAS).toBe("50000000000000");
    expect(INSTRUCTION_MAX_BYTES).toBe(1000);
    expect(LABEL_MAX).toBe(64);
    expect(BUDGET_MAX).toBe(10_000_000_000n);
    expect(TTL_OPTIONS).toStrictEqual([60, 1440, 10080, 20160]);
  });
});

describe("parseUsdc", () => {
  it.each([
    ["12.5", 12_500_000n],
    [" 12.5 ", 12_500_000n],
    ["0", 0n],
    ["100", 100_000_000n],
    ["0.000001", 1n],
    ["1.123456", 1_123_456n],
    ["007", 7_000_000n],
  ])("%j → %s", (s, want) => {
    expect(parseUsdc(s)).toBe(want);
  });

  it.each(["1.1234567", "1e3", "-5", "+5", "1,000", "1 0", "", " ", ".", "1.", ".5", "0x10", "Infinity", "NaN", "١٢"])(
    "%j → null",
    (s) => {
      expect(parseUsdc(s)).toBeNull();
    },
  );
});

describe("toUsdcInput", () => {
  it.each([
    ["12500000", "12.5"],
    ["100000000", "100"],
    ["1", "0.000001"],
    ["0", "0"],
    ["10000000000", "10000"],
  ])("%s → %s and back", (b, s) => {
    expect(toUsdcInput(b)).toBe(s);
    expect(parseUsdc(s)).toBe(BigInt(b));
  });
});

describe("isAccountId", () => {
  it.each([ALICE, "ab", "a-b_c.testnet", "a".repeat(64), "0x.near"])("%s is valid", (s) => {
    expect(isAccountId(s)).toBe(true);
  });
  it.each(["a", "a".repeat(65), "Alice.testnet", " alice.testnet", "alice..testnet", ".alice", "alice.", "a--b", "al ice", ""])(
    "%j is invalid",
    (s) => {
      expect(isAccountId(s)).toBe(false);
    },
  );
});

describe("validateMandate", () => {
  it("a valid form gives exact string args", () => {
    const args = okArgs(base({ budget: " 12.5 ", maxPerPayment: "12.5", payees: [{ accountId: ALICE, max: "2", label: " Alice " }] }));
    expect(args).toStrictEqual({
      agent: AGENT_L,
      instruction: "Pay Alice for the logo.",
      budget: "12500000",
      max_per_payment: "12500000",
      ttl_minutes: 1440,
      signed_payees: [{ account_id: ALICE, max_amount: "2000000", label: "Alice" }],
      resolvers: [REGISTRY],
    });
    expect(typeof args.budget).toBe("string");
    expect(typeof args.max_per_payment).toBe("string");
    expect(typeof args.signed_payees[0].max_amount).toBe("string");
  });

  it("trims account ids but never lower-cases them", () => {
    const args = okArgs(base({ agent: ` ${AGENT_L} `, resolvers: [` ${REGISTRY}`] }));
    expect(args.agent).toBe(AGENT_L);
    expect(args.resolvers).toStrictEqual([REGISTRY]);
    expect(errs(base({ agent: AGENT_L.toUpperCase() })).agent).toBe("Use lowercase");
    expect(errs(base({ resolvers: ["Registry.testnet"] }))["resolvers.0"]).toBe("Use lowercase");
    expect(errs(base({ payees: [{ accountId: "ALICE.testnet", max: "1", label: "A" }] }))["payees.0.accountId"]).toBe("Use lowercase");
    expect(errs(base({ agent: "not an account" })).agent).toBeTruthy();
  });

  it("instruction: exactly 1000 bytes ok, 1001 bytes (999 ASCII + é) rejected", () => {
    expect(okArgs(base({ instruction: "a".repeat(1000) })).instruction).toHaveLength(1000);
    const over = "a".repeat(999) + "é";
    expect(over).toHaveLength(1000);
    expect(errs(base({ instruction: over })).instruction).toBeTruthy();
  });

  it("instruction must have a non-space character", () => {
    expect(errs(base({ instruction: " \n\t " })).instruction).toBeTruthy();
  });

  it.each([
    ["1.1234567", "budget"],
    ["1e3", "budget"],
    ["-5", "budget"],
    ["0", "budget"],
    ["", "budget"],
    ["10000.000001", "budget"],
  ])("budget %j is an error", (budget, key) => {
    expect(errs(base({ budget, maxPerPayment: "0.000001", payees: [] }))[key]).toBeTruthy();
  });

  it("budget at BUDGET_MAX is ok", () => {
    expect(okArgs(base({ budget: "10000" })).budget).toBe("10000000000");
  });

  it("max per payment > budget is an error; equal is ok", () => {
    expect(errs(base({ budget: "50", maxPerPayment: "50.000001", payees: [] })).maxPerPayment).toBeTruthy();
    expect(okArgs(base({ budget: "50", maxPerPayment: "50", payees: [] })).max_per_payment).toBe("50000000");
    expect(errs(base({ maxPerPayment: "0" })).maxPerPayment).toBeTruthy();
    expect(errs(base({ maxPerPayment: "1e3" })).maxPerPayment).toBeTruthy();
  });

  it.each([0, 30, 1441, -60, Number.NaN])("ttl %s is an error", (ttlMinutes) => {
    expect(errs(base({ ttlMinutes })).ttlMinutes).toBeTruthy();
  });

  it("payee max: > 0 and ≤ budget", () => {
    expect(errs(base({ payees: [{ accountId: ALICE, max: "100.000001", label: "A" }] }))["payees.0.max"]).toBeTruthy();
    expect(errs(base({ payees: [{ accountId: ALICE, max: "0", label: "A" }] }))["payees.0.max"]).toBeTruthy();
    expect(errs(base({ payees: [{ accountId: ALICE, max: "-5", label: "A" }] }))["payees.0.max"]).toBeTruthy();
  });

  it("duplicate payee is flagged on the second row", () => {
    const e = errs(base({ payees: [payee(1), { ...payee(2), accountId: payee(1).accountId }] }));
    expect(e["payees.1.accountId"]).toBeTruthy();
    expect(e["payees.0.accountId"]).toBeUndefined();
  });

  it("20 payees ok, 21 is an error", () => {
    const twenty = Array.from({ length: 20 }, (_, i) => payee(i));
    expect(okArgs(base({ payees: twenty })).signed_payees).toHaveLength(20);
    expect(errs(base({ payees: [...twenty, payee(20)] })).payees).toBeTruthy();
  });

  it("5 resolvers ok, 6 is an error, duplicates flagged", () => {
    const five = Array.from({ length: 5 }, (_, i) => `r${i}.${REGISTRY}`);
    expect(okArgs(base({ resolvers: five })).resolvers).toHaveLength(5);
    expect(errs(base({ resolvers: [...five, `r5.${REGISTRY}`] })).resolvers).toBeTruthy();
    expect(errs(base({ resolvers: [REGISTRY, REGISTRY] }))["resolvers.1"]).toBeTruthy();
  });

  it("blank payee and resolver rows are dropped, keeping original indexes for errors", () => {
    const args = okArgs(base({ payees: [{ accountId: "", max: "", label: "" }, payee(1), { accountId: " ", max: " ", label: "" }], resolvers: ["", REGISTRY, " "] }));
    expect(args.signed_payees).toStrictEqual([{ account_id: payee(1).accountId, max_amount: "1000000", label: "P1" }]);
    expect(args.resolvers).toStrictEqual([REGISTRY]);
    const e = errs(base({ payees: [{ accountId: "", max: "", label: "" }, { ...payee(1), max: "x" }] }));
    expect(e["payees.1.max"]).toBeTruthy();
    expect(okArgs(base({ payees: [], resolvers: [] }))).toMatchObject({ signed_payees: [], resolvers: [] });
  });

  it("a partly filled payee row is not dropped", () => {
    expect(errs(base({ payees: [{ accountId: "", max: "1", label: "" }] }))["payees.0.accountId"]).toBeTruthy();
  });

  it("label: 1–64 code points after trim (65 emoji rejected)", () => {
    expect(okArgs(base({ payees: [{ accountId: ALICE, max: "1", label: "😀".repeat(64) }] })).signed_payees[0].label).toBe("😀".repeat(64));
    expect(errs(base({ payees: [{ accountId: ALICE, max: "1", label: "😀".repeat(65) }] }))["payees.0.label"]).toBeTruthy();
    expect(errs(base({ payees: [{ accountId: ALICE, max: "1", label: "   " }] }))["payees.0.label"]).toBeTruthy();
  });
});

describe("createTaskTx", () => {
  it("builds exactly one create_task call with 1 yocto and 50 Tgas", () => {
    const args = okArgs(base());
    expect(createTaskTx(VAULT, args)).toStrictEqual({
      receiverId: VAULT,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "create_task",
            args: {
              agent: AGENT_L,
              instruction: "Pay Alice for the logo.",
              budget: "100000000",
              max_per_payment: "50000000",
              ttl_minutes: 1440,
              signed_payees: [{ account_id: ALICE, max_amount: "20000000", label: "Alice — logo" }],
              resolvers: [REGISTRY],
            },
            gas: "50000000000000",
            deposit: "1",
          },
        },
      ],
    });
  });
});

describe("demoMandateForm", () => {
  const CREATED = 1794440000000;
  const task0 = (minutes: number) => demoTask(AGENT_L, { id: 0, created_at_ms: CREATED, expires_at_ms: CREATED + minutes * 60_000 });

  it("round-trips task 0 into agent/owner.ts demoTaskArgs", () => {
    expect(okArgs(demoMandateForm(task0(20160)))).toStrictEqual({
      agent: AGENT_L,
      instruction: DEMO_INSTRUCTION,
      budget: "100000000",
      max_per_payment: "50000000",
      ttl_minutes: 20160,
      signed_payees: [{ account_id: ALICE, max_amount: "20000000", label: "Alice — logo" }],
      resolvers: [REGISTRY],
    });
  });

  it("fills the form fields as the user would type them", () => {
    expect(demoMandateForm(task0(20160))).toStrictEqual({
      agent: AGENT_L,
      instruction: DEMO_INSTRUCTION,
      budget: "100",
      maxPerPayment: "50",
      ttlMinutes: 20160,
      payees: [{ accountId: ALICE, max: "20", label: "Alice — logo" }],
      resolvers: [REGISTRY],
    });
  });

  it("a TTL outside the options falls back to 1 day", () => {
    expect(demoMandateForm(task0(1234)).ttlMinutes).toBe(1440);
    expect(demoMandateForm(task0(60.5)).ttlMinutes).toBe(1440);
  });
});

describe("emptyMandateForm", () => {
  it("starts on agent-l with the registry pinned", () => {
    expect(emptyMandateForm(AGENT_IDS.vault, CONTRACTS.registry)).toStrictEqual({
      agent: AGENT_IDS.vault,
      instruction: "",
      budget: "",
      maxPerPayment: "",
      ttlMinutes: 1440,
      payees: [],
      resolvers: [CONTRACTS.registry],
    });
    expect(AGENT_IDS.vault).toBe(AGENT_L);
    expect(CONTRACTS.registry).toBe(REGISTRY);
  });
});

describe("createdTaskId", () => {
  const outcome = (successValue: string) => parseOutcome({ status: { SuccessValue: successValue }, transaction: { hash: "h" } });

  it("MTU= → 15", () => {
    expect(createdTaskId(outcome("MTU="))).toBe(15);
  });

  it.each([
    ["empty", ""],
    ['JSON string "x"', btoa('"x"')],
    ["-1", btoa("-1")],
    ["1.5", btoa("1.5")],
    ["2^32", btoa("4294967296")],
    ["not JSON", btoa("abc")],
    ["bad base64", "!!!"],
  ])("%s → null", (_name, v) => {
    expect(createdTaskId(outcome(v))).toBeNull();
  });

  it("u32 max is accepted", () => {
    expect(createdTaskId(outcome(btoa("4294967295")))).toBe(4294967295);
  });

  it("a failed tx → null", () => {
    const failed = parseOutcome({
      status: { Failure: { ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: Owner only" } } } } },
      transaction: { hash: "h" },
    });
    expect(createdTaskId(failed)).toBeNull();
    expect(createdTaskId({ hash: "h", ok: false, error: "x", value: "15" })).toBeNull();
  });
});
