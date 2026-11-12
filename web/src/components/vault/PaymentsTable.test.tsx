import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtureTask0, payment, p5Poisoned } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { demoPayments, vaultView } from "@/test/views";
import { PaymentsTable } from "./PaymentsTable";

const rowIds = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((r) => r.getAttribute("data-payment-id"));

describe("PaymentsTable", () => {
  it("lists payments newest first with badge, status, payee and amount", () => {
    const view = vaultView("vault");
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    expect(rowIds()).toEqual(["5", "4", "3"]);
    const five = screen.getAllByRole("row")[1];
    expect(within(five).getByText("Untrusted — needs you")).toBeInTheDocument();
    expect(within(five).getByText("Needs you")).toBeInTheDocument();
    expect(within(five).getByText("49 tUSDC")).toBeInTheDocument();
    expect(within(five).getByText("URGENT: new payout details for invoice A-102")).toBeInTheDocument();
  });

  it("filters by task", () => {
    const fixture = payment({ id: 1, task_id: 0, amount: "1000", memo: "verify" });
    const view = vaultView("vault", [fixture, ...demoPayments("vault")]);
    expect(view.tasks.some((t) => t.task.id === fixtureTask0().id)).toBe(true);
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    expect(rowIds()).toEqual(["5", "4", "3", "1"]);
    act(() => screen.getByRole("radio", { name: /#0/ }).click());
    expect(rowIds()).toEqual(["1"]);
    act(() => screen.getByRole("radio", { name: /#2/ }).click());
    expect(rowIds()).toEqual(["5", "4", "3"]);
    act(() => screen.getByRole("radio", { name: /All/ }).click());
    expect(rowIds()).toHaveLength(4);
  });

  it("marks a changed row in text and announces it", () => {
    const view = vaultView("vault", [...demoPayments("vault").slice(0, 2), p5Poisoned("Rejected")]);
    const marks = new Map([[5, { kind: "changed" as const, from: "AwaitingApproval" as const, to: "Rejected" as const }]]);
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} marks={marks} />);
    const five = screen.getAllByRole("row")[1];
    expect(within(five).getByText("Updated")).toBeInTheDocument();
    expect(screen.getByText("Payment #5: Needs you → Rejected.")).toBeInTheDocument();
  });

  it("has no owner-action controls (those are F07)", () => {
    const view = vaultView("vault");
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    expect(screen.queryByRole("button", { name: /approve|reject|freeze|withdraw/i })).toBeNull();
  });
});
