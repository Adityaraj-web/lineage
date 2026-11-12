import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { agentKeyProof } from "@/lib/views";
import { GUARDED, VAULT, agentKey } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { setReducedMotion } from "@/test/media";
import { overview } from "@/test/views";
import { AgentKeyCard } from "./AgentKeyCard";
import { OverviewDashboard } from "./OverviewDashboard";
import { ProvenanceFlow } from "./ProvenanceFlow";

describe("AgentKeyCard", () => {
  it("shows what the key can do and, crossed out, what it cannot", () => {
    const proof = agentKeyProof([agentKey(VAULT)], VAULT);
    renderUI(<AgentKeyCard vault="vault" agentId="agent-l.lineage-aditya.testnet" proof={proof} />);
    const can = screen.getByRole("list", { name: "The agent's key can" });
    expect(within(can).getByText("request_payment")).toBeInTheDocument();
    expect(can).toHaveTextContent("vault.lineage-aditya.testnet");
    expect(screen.getByText(/1\.99 NEAR allowance left/)).toBeInTheDocument();
    const cannot = screen.getByRole("list", { name: "The agent's key cannot" });
    for (const m of ["approve_payment", "withdraw", "unfreeze", "create_task"]) {
      expect(within(cannot).getByText(m).closest("del")).not.toBeNull();
    }
    expect(screen.getByText("1 key · function-call only")).toBeInTheDocument();
  });

  it("lists the problems when the proof fails", () => {
    const proof = agentKeyProof([agentKey(GUARDED), { publicKey: "ed25519:x", permission: "FullAccess" }], GUARDED);
    renderUI(<AgentKeyCard vault="guarded" agentId="agent-g.lineage-aditya.testnet" proof={proof} />);
    expect(screen.getByText("Key check failed")).toBeInTheDocument();
    expect(screen.getByText("expected exactly 1 access key, found 2")).toBeInTheDocument();
    expect(screen.getByText("1 full-access key")).toBeInTheDocument();
  });
});

describe("ProvenanceFlow", () => {
  for (const reduced of [false, true]) {
    it(`labels all three lanes (reduced motion: ${reduced})`, () => {
      setReducedMotion(reduced);
      renderUI(<ProvenanceFlow />);
      const fig = screen.getByRole("img", { name: /How Lineage decides who gets paid/ });
      expect(fig).toHaveTextContent("Signed by you");
      expect(fig).toHaveTextContent("Resolved via registry");
      expect(fig).toHaveTextContent("An email");
      expect(fig).toHaveTextContent("Needs you");
      expect(fig).toHaveTextContent("hindi-translator");
    });
  }
});

describe("OverviewDashboard", () => {
  it("leads with the attacker result and links to the comparison", () => {
    renderUI(<OverviewDashboard view={overview()} />);
    const headline = screen.getByTestId("attacker-headline");
    expect(within(headline).getByText("0 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(headline).getByText("49 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(headline).getByRole("link")).toHaveAttribute("href", "/compare");
  });

  it("links Needs you to the Lineage inbox", () => {
    renderUI(<OverviewDashboard view={overview()} />);
    const link = screen.getByRole("link", { name: /Needs you/ });
    expect(link).toHaveAttribute("href", "/vault/vault#inbox");
    expect(link).toHaveTextContent("1");
  });

  it("shows both vaults, both agent keys and the registry", () => {
    renderUI(<OverviewDashboard view={overview()} />);
    expect(screen.getByRole("link", { name: "Lineage vault" })).toHaveAttribute("href", "/vault/vault");
    expect(screen.getByRole("link", { name: "LimitsOnly vault" })).toHaveAttribute("href", "/vault/guarded");
    expect(screen.getAllByText("1 key · function-call only")).toHaveLength(2);
    const registry = screen.getByRole("region", { name: /registry/i });
    expect(within(registry).getByText("translate-hi")).toBeInTheDocument();
    expect(within(registry).getByText("Verified")).toBeInTheDocument();
    expect(within(registry).getByText("25 tUSDC")).toBeInTheDocument();
  });
});
