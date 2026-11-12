import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { assessPayment, HIGH_ADVICE, RISK_DISCLAIMER } from "@/lib/risk";
import { ALICE_STATS, PLAIN_ACCOUNT, demoTask, p3Translation, p4Alice, p5Poisoned } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { setReducedMotion } from "@/test/media";
import { vaultView } from "@/test/views";
import { RiskCard } from "./RiskCard";

function heldItem() {
  const v = vaultView("vault");
  if (v.inbox.kind !== "lineage") throw new Error("expected a Lineage inbox");
  return v.inbox.items[0];
}

const findingIds = (c: HTMLElement) => [...c.querySelectorAll("[data-finding]")].map((e) => e.getAttribute("data-finding"));

describe("RiskCard", () => {
  it("shows the demo P3 as high risk with every finding in rule order", () => {
    const { container } = renderUI(<RiskCard risk={heldItem().risk} />);
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(findingIds(container)).toEqual([
      "untrusted-source",
      "not-signed",
      "plain-account",
      "never-paid",
      "duplicate-reference",
      "pressure-language",
      "near-cap",
    ]);
    const summary = screen.getByTestId("risk-summary");
    expect(summary).toHaveTextContent(/^Don't pay this yet: /);
    expect(summary).toHaveTextContent("A-102");
    expect(summary).toHaveTextContent("alice.lineage-aditya.testnet");
    expect(screen.getByText(HIGH_ADVICE)).toBeInTheDocument();
    expect(screen.getByText(RISK_DISCLAIMER)).toBeInTheDocument();
    expect(
      screen.getByText(/Invoice A-102 was already paid in this task to alice\.lineage-aditya\.testnet/),
    ).toBeInTheDocument();
  });

  it("shows the demo P1 as low risk with signed-match and no duplicate", () => {
    const risk = assessPayment({
      payment: p4Alice(),
      task: demoTask(),
      mode: "Lineage",
      taskPayments: [p3Translation(), p4Alice(), p5Poisoned()],
      account: PLAIN_ACCOUNT,
      stats: ALICE_STATS,
    });
    const { container } = renderUI(<RiskCard risk={risk} />);
    expect(screen.getByText("Low risk")).toBeInTheDocument();
    expect(findingIds(container)).toContain("signed-match");
    expect(findingIds(container)).not.toContain("duplicate-reference");
    expect(screen.queryByText(HIGH_ADVICE)).toBeNull();
  });

  it("reads the same with reduced motion", () => {
    setReducedMotion(true);
    const { container } = renderUI(<RiskCard risk={heldItem().risk} />);
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(findingIds(container)).toHaveLength(7);
    expect(container.querySelector("[data-meter]")).toHaveAttribute("data-level", "high");
  });
});
