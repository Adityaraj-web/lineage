import { beforeAll, describe, expect, it } from "vitest";
import { HIGH_ADVICE, assessPayment, type RiskCard, type RiskFacts } from "./risk";
import {
  ALICE,
  ALICE_STATS,
  ATTACKER,
  CONTRACT_ACCOUNT,
  NO_STATS,
  PLAIN_ACCOUNT,
  demoTask,
  p3Translation,
  p4Alice,
  p5Poisoned,
  payment,
} from "./test-fixtures";

const demoPayments = () => [p3Translation(), p4Alice(), p5Poisoned()];

function poisonedFacts(over: Partial<RiskFacts> = {}): RiskFacts {
  return {
    payment: p5Poisoned(),
    task: demoTask(),
    mode: "Lineage",
    taskPayments: demoPayments(),
    account: PLAIN_ACCOUNT,
    stats: NO_STATS,
    ...over,
  };
}

const ids = (facts: RiskFacts) => assessPayment(facts).findings.map((f) => f.id);

describe("assessPayment — demo poisoned invoice (#5)", () => {
  let card: RiskCard;
  beforeAll(() => {
    card = assessPayment(poisonedFacts());
  });

  it("is high with every expected finding, in rule order", () => {
    expect(card.level).toBe("high");
    expect(card.findings.map((f) => f.id)).toEqual([
      "untrusted-source",
      "not-signed",
      "plain-account",
      "never-paid",
      "duplicate-reference",
      "pressure-language",
      "near-cap",
    ]);
    const tone = Object.fromEntries(card.findings.map((f) => [f.id, f.tone]));
    expect(tone).toMatchObject({
      "untrusted-source": "danger",
      "not-signed": "warn",
      "plain-account": "info",
      "never-paid": "warn",
      "duplicate-reference": "danger",
      "pressure-language": "warn",
      "near-cap": "info",
    });
  });

  it("explains the duplicate and points at the earlier payment", () => {
    const dup = card.findings.find((f) => f.id === "duplicate-reference")!;
    expect(dup.text).toBe(
      `Invoice A-102 was already paid in this task to ${ALICE} (P1, signed by you, 18 tUSDC).`,
    );
    expect(dup.ref).toEqual({ token: "A-102", paymentId: 4 });
  });

  it("lists the signed payees", () => {
    const notSigned = card.findings.find((f) => f.id === "not-signed")!;
    expect(notSigned.text).toContain(`Alice — logo → ${ALICE}`);
    expect(notSigned.text).toContain(ATTACKER);
  });

  it("summarises danger first, at most three clauses, and advises rejecting", () => {
    expect(card.summary).toBe(
      `Don't pay this yet: the address came from a message the agent read, invoice A-102 was already paid in this task to ${ALICE}, and it isn't a payee you signed.`,
    );
    expect(card.summary).toContain("A-102");
    expect(card.summary).toContain("alice.lineage-aditya.testnet");
    expect(card.advice).toBe(HIGH_ADVICE);
  });
});

describe("assessPayment — poisoned invoice after the vault already paid the attacker once", () => {
  it("is still high, with paid-before in place of never-paid", () => {
    const card = assessPayment(
      poisonedFacts({
        stats: { payments: 1, total: "49000000", first_paid_at_ms: 1794473265209, last_paid_at_ms: 1794473265209 },
      }),
    );
    expect(card.level).toBe("high");
    expect(card.findings.map((f) => f.id)).toEqual([
      "untrusted-source",
      "not-signed",
      "plain-account",
      "paid-before",
      "duplicate-reference",
      "pressure-language",
      "near-cap",
    ]);
    const f = card.findings.find((x) => x.id === "paid-before")!;
    expect(f.text).toContain("1 payment,");
    expect(f.text).toContain("49 tUSDC");
  });
});

describe("assessPayment — demo signed payment (#4)", () => {
  it("is low, signed-match, no duplicate-reference even with #5 in the task", () => {
    const card = assessPayment({
      payment: p4Alice(),
      task: demoTask(),
      mode: "Lineage",
      taskPayments: demoPayments(),
      account: PLAIN_ACCOUNT,
      stats: ALICE_STATS,
    });
    expect(card.level).toBe("low");
    expect(card.findings.map((f) => f.id)).toContain("signed-match");
    expect(card.findings.map((f) => f.id)).not.toContain("duplicate-reference");
    expect(card.findings.map((f) => f.id)).toContain("paid-before");
    expect(card.advice).toBeNull();
  });
});

describe("assessPayment — account facts", () => {
  it("missing account is a danger", () => {
    const card = assessPayment(poisonedFacts({ account: { exists: false } }));
    const f = card.findings.find((x) => x.id === "account-missing");
    expect(f?.tone).toBe("danger");
    expect(card.findings.map((x) => x.id)).not.toContain("plain-account");
  });

  it("contract payee is a warning", () => {
    const card = assessPayment(poisonedFacts({ account: CONTRACT_ACCOUNT }));
    expect(card.findings.find((x) => x.id === "contract-account")?.tone).toBe("warn");
  });

  it("paid-before reports count and total", () => {
    const card = assessPayment(poisonedFacts({ stats: { ...ALICE_STATS } }));
    const f = card.findings.find((x) => x.id === "paid-before")!;
    expect(f.tone).toBe("info");
    expect(f.text).toContain("2 payments");
    expect(f.text).toContain("36 tUSDC");
    expect(card.findings.map((x) => x.id)).not.toContain("never-paid");
  });
});

describe("assessPayment — duplicate-reference edge cases", () => {
  it("same token paid earlier to the same payee: no duplicate", () => {
    const earlier = payment({ id: 2, payee: ATTACKER, memo: "Invoice A-102 part 1", status: "Paid" });
    expect(ids(poisonedFacts({ taskPayments: [earlier, p5Poisoned()] }))).not.toContain("duplicate-reference");
  });

  it("token only on a payment that was not paid: no duplicate", () => {
    for (const status of ["AwaitingApproval", "Rejected", "Blocked", "Failed"] as const) {
      const other = { ...p4Alice(), status };
      expect(ids(poisonedFacts({ taskPayments: [p3Translation(), other, p5Poisoned()] }))).not.toContain(
        "duplicate-reference",
      );
    }
  });

  it("Sending counts as paid", () => {
    const other = { ...p4Alice(), status: "Sending" as const };
    expect(ids(poisonedFacts({ taskPayments: [other, p5Poisoned()] }))).toContain("duplicate-reference");
  });

  it("a token that is only a prefix does not match (A-10 vs A-102)", () => {
    const other = { ...p4Alice(), memo: "Invoice A-10: logo" };
    expect(ids(poisonedFacts({ taskPayments: [other, p5Poisoned()] }))).not.toContain("duplicate-reference");
  });
});

describe("assessPayment — memo and cap", () => {
  it("pressure-language only when the memo pushes", () => {
    const calm = { ...p5Poisoned(), memo: "Invoice B-7 for translation" };
    expect(ids(poisonedFacts({ payment: calm }))).not.toContain("pressure-language");
    for (const memo of ["Please use our changed bank details", "late fee applies", "updated wallet below"]) {
      expect(ids(poisonedFacts({ payment: { ...p5Poisoned(), memo } }))).toContain("pressure-language");
    }
  });

  it("near-cap at ≥ 90% of max_per_payment only", () => {
    expect(ids(poisonedFacts({ payment: { ...p5Poisoned(), amount: "45000000" } }))).toContain("near-cap");
    expect(ids(poisonedFacts({ payment: { ...p5Poisoned(), amount: "44999999" } }))).not.toContain("near-cap");
  });

  it("medium when only warnings fire", () => {
    const card = assessPayment({
      payment: payment({ id: 7, payee: ATTACKER, provenance: { UserSigned: { slot: 0 } }, memo: "logo", amount: "1000000" }),
      task: demoTask(),
      mode: "Lineage",
      taskPayments: [],
      account: PLAIN_ACCOUNT,
      stats: NO_STATS,
    });
    expect(card.level).toBe("medium");
    expect(card.summary.startsWith("Check before paying:")).toBe(true);
  });
});
