import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderUI } from "@/test/render";
import { vaultView } from "@/test/views";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { StatusPill } from "./StatusPill";

const byId = (key: "vault" | "guarded", id: number) => vaultView(key).payments.find((r) => r.payment.id === id)!;

describe("ProvenanceBadge", () => {
  it("P1 says it was signed by you, with the mandate it matched", () => {
    const { container } = renderUI(<ProvenanceBadge badge={byId("vault", 4).badge} />);
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("Signed by you")).toBeInTheDocument();
    expect(screen.getByText("Alice — logo, max 20 tUSDC (task #2)")).toBeInTheDocument();
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", "green");
  });

  it("P2 says it was resolved via the registry, with the resolver and reference", () => {
    renderUI(<ProvenanceBadge badge={byId("vault", 3).badge} />);
    expect(screen.getByText("P2")).toBeInTheDocument();
    expect(screen.getByText("Resolved via registry")).toBeInTheDocument();
    expect(screen.getByText("registry.lineage-aditya.testnet → translate-hi")).toBeInTheDocument();
  });

  it("P3 on Lineage says it is untrusted and needs you", () => {
    const { container } = renderUI(<ProvenanceBadge badge={byId("vault", 5).badge} />);
    expect(screen.getByText("P3")).toBeInTheDocument();
    expect(screen.getByText("Untrusted — needs you")).toBeInTheDocument();
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", "amber");
  });

  it("P3 on LimitsOnly says it was paid without asking", () => {
    const { container } = renderUI(<ProvenanceBadge badge={byId("guarded", 5).badge} />);
    expect(screen.getByText("Untrusted — paid without asking")).toBeInTheDocument();
    expect(container.querySelector("[data-tone]")).toHaveAttribute("data-tone", "red");
  });

  it("compact keeps the detail available to screen readers", () => {
    renderUI(<ProvenanceBadge badge={byId("vault", 4).badge} compact />);
    expect(screen.getByText("Alice — logo, max 20 tUSDC (task #2)")).toHaveClass("sr-only");
  });
});

describe("StatusPill", () => {
  it("AwaitingApproval reads Needs you; other statuses read their name", () => {
    renderUI(
      <>
        <StatusPill status="AwaitingApproval" />
        <StatusPill status="Paid" />
        <StatusPill status="Rejected" />
      </>,
    );
    expect(screen.getByText("Needs you")).toBeInTheDocument();
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
  });
});
