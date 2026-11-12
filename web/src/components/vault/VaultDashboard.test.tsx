import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LIMITS_ONLY_INBOX } from "@/lib/views";
import { NOW } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { VaultDashboard } from "./VaultDashboard";

describe("VaultDashboard", () => {
  it("Lineage: header, inbox with the held P3, task mandates and payments", () => {
    renderUI(<VaultDashboard view={vaultView("vault")} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lineage vault");
    expect(screen.getByText("Approval inbox · 1 waiting")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: /Payment #5/ })).toBeInTheDocument();
    const task2 = screen.getByRole("article", { name: "Task #2" });
    expect(within(task2).getByText("latest demo run")).toBeInTheDocument();
    expect(within(task2).getByText("Alice — logo")).toBeInTheDocument();
    expect(within(task2).getByText("max 20 tUSDC · committed 18 tUSDC")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Task #0" })).toHaveTextContent("verify fixture");
    expect(screen.getByRole("table", { name: "Payments" })).toBeInTheDocument();
  });

  it("LimitsOnly: explains that it never asks", () => {
    renderUI(<VaultDashboard view={vaultView("guarded")} now={NOW} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("LimitsOnly vault");
    expect(screen.getByText(LIMITS_ONLY_INBOX)).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: /Payment #/ })).toBeNull();
  });

  it("has no owner-action controls on either vault (F07)", () => {
    for (const key of ["vault", "guarded"] as const) {
      const { unmount } = renderUI(<VaultDashboard view={vaultView(key)} now={NOW} />);
      expect(screen.queryByRole("button", { name: /approve|reject|freeze|unfreeze|withdraw|create/i })).toBeNull();
      unmount();
    }
  });
});
