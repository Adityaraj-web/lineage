import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LIMITS_ONLY_INBOX } from "@/lib/views";
import { AGENT_G, ATTACKER, DEMO_RUN_SNAPSHOT, NOW, p3Translation, p4Alice, payment } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { demoPayments, vaultView } from "@/test/views";
import { VaultDashboard } from "./VaultDashboard";

const render = (view = vaultView("vault")) => renderUI(<VaultDashboard view={view} demoRun={DEMO_RUN_SNAPSHOT} now={NOW} />);

// Task 1 is an earlier demo run on the LimitsOnly vault that also paid the attacker 49.
const guardedTwoRuns = () =>
  vaultView("guarded", [
    payment({ id: 2, task_id: 1, agent: AGENT_G, payee: ATTACKER, amount: "49000000", status: "Paid", memo: "URGENT: new payout details for invoice A-102" }),
    ...demoPayments("guarded"),
  ]);

describe("VaultDashboard", () => {
  it("Lineage: header, story strip, inbox with the held P3, tasks and payments", () => {
    render();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lineage vault");
    expect(screen.getByRole("heading", { level: 2, name: "1 payment needs you" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Payment #5/ })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Payments" })).toBeInTheDocument();
  });

  it("tells the latest run as a story strip, with one sentence for screen readers", () => {
    render();
    const strip = screen.getByTestId("story-strip");
    for (const step of ["Read 3 emails", "asked for 3 payments", "paid 2", "held 1 for you"]) {
      expect(within(strip).getByText(step)).toBeInTheDocument();
    }
    expect(within(strip).getByText("Read 3 emails, asked for 3 payments, paid 2 and held 1 for you.")).toHaveClass("sr-only");
  });

  it("puts balance and in-flight up front and the rest on one quiet line", () => {
    render();
    const header = screen.getByRole("banner", { name: "Lineage vault" });
    expect(within(header).getByText("Balance")).toBeInTheDocument();
    expect(within(header).getByText("In flight")).toBeInTheDocument();
    expect(header).toHaveTextContent("owned by");
    expect(header).toHaveTextContent("pays in");
  });

  it("shows the latest task and folds the earlier ones", () => {
    render();
    const latest = screen.getByRole("article", { name: "Task #2" });
    expect(within(latest).getByText("latest demo run")).toBeInTheDocument();
    expect(within(latest).getByText("Alice — logo")).toBeInTheDocument();
    expect(within(latest).getByText("max 20 tUSDC, committed 18 tUSDC")).toBeInTheDocument();
    const earlier = screen.getByText("Earlier tasks (2)").closest("details")!;
    expect(earlier).not.toHaveAttribute("open");
    expect(within(earlier).getByRole("article", { name: "Task #0" })).toHaveTextContent("verify fixture");
    expect(within(earlier).getByRole("article", { name: "Task #1" })).toBeInTheDocument();
  });

  it("LimitsOnly: totals what it paid the attacker across runs and lists each payment", () => {
    render(guardedTwoRuns());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("LimitsOnly vault");
    const paid = screen.getByRole("region", { name: "Paid to the attacker" });
    expect(within(paid).getByText("98 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(paid).getByText("across 2 runs")).toBeInTheDocument();
    const list = within(paid).getByRole("list", { name: "Payments to the attacker" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText(LIMITS_ONLY_INBOX)).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /Payment #/ })).toBeNull();
    expect(within(screen.getByTestId("story-strip")).getByText("paid all 3, including the attacker")).toBeInTheDocument();
  });

  it("a LimitsOnly vault that never paid the attacker says so", () => {
    render(vaultView("guarded", [p3Translation(AGENT_G), p4Alice(AGENT_G)]));
    expect(within(screen.getByRole("region", { name: "Paid to the attacker" })).getByText("0 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("uses no middle-dot strings", () => {
    for (const view of [vaultView("vault"), guardedTwoRuns()]) {
      const { container, unmount } = render(view);
      expect(container.textContent).not.toContain("·");
      unmount();
    }
  });

  it("has no owner-action controls on either vault (F07)", () => {
    for (const key of ["vault", "guarded"] as const) {
      const { unmount } = render(vaultView(key));
      expect(screen.queryByRole("button", { name: /approve|reject|freeze|unfreeze|withdraw|create/i })).toBeNull();
      unmount();
    }
  });
});

