import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ALICE, DEMO_RUN_SNAPSHOT, NOW, ROOT, fixtureTask0, payment, p5Poisoned } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { demoPayments, vaultView } from "@/test/views";
import { WithOwnerAction } from "@/test/owner";
import { FakeWallet } from "../wallet/test-wallet";
import { PaymentsTable } from "./PaymentsTable";
import { VaultDashboard } from "./VaultDashboard";

const CONTROLS = /approve|reject|freeze|unfreeze|withdraw/i;

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
    act(() => screen.getByRole("radio", { name: /^Task 0/ }).click());
    expect(rowIds()).toEqual(["1"]);
    act(() => screen.getByRole("radio", { name: /^Task 2/ }).click());
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

  it("keeps badge detail and time out of the row: tooltip and screen-reader text only", () => {
    const view = vaultView("vault");
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    const four = screen.getAllByRole("row")[2];
    expect(within(four).getByText("Alice — logo, max 20 tUSDC (task #2)")).toHaveClass("sr-only");
    expect(four).not.toHaveTextContent("task #2 ·");
  });

  it("washes rose the LimitsOnly rows paid without asking", () => {
    const view = vaultView("guarded");
    renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    const flagged = screen.getAllByRole("row").filter((r) => r.hasAttribute("data-paid-without-asking"));
    expect(flagged.map((r) => r.getAttribute("data-payment-id"))).toEqual(["5"]);
    const lineage = vaultView("vault");
    const { container } = renderUI(<PaymentsTable payments={lineage.payments} tasks={lineage.tasks} />);
    expect(container.querySelector("[data-paid-without-asking]")).toBeNull();
  });

  it("never has owner controls, in any role (they live on the inbox card)", () => {
    const view = vaultView("vault");
    const { unmount } = renderUI(<PaymentsTable payments={view.payments} tasks={view.tasks} />);
    expect(screen.queryByRole("button", { name: CONTROLS })).toBeNull();
    unmount();
    for (const [role, accountId] of [["disconnected", null], ["viewer", ALICE], ["owner", ROOT]] as const) {
      const { unmount: done } = renderUI(
        <WithOwnerAction fake={new FakeWallet({ account: accountId })}>
          {(action) => <VaultDashboard view={view} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} wallet={{ role, accountId, action }} />}
        </WithOwnerAction>,
      );
      const table = screen.getByRole("table", { name: "Payments" });
      expect(within(table).queryByRole("button", { name: CONTROLS })).toBeNull();
      done();
    }
  });
});
