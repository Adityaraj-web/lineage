import { describe, expect, it } from "vitest";
import type { PaymentStatus } from "../shared/vault-types";
import { provenanceBadge, statusLabel } from "./provenance";
import { ALICE, REGISTRY, demoTask, p3Translation, p4Alice, payment } from "./test-fixtures";

const untrusted = (status: PaymentStatus, reason = "") =>
  payment({ id: 9, provenance: "Untrusted", status, reason });

describe("provenanceBadge", () => {
  it("P1 Signed by you, green, label and max from the task slot", () => {
    for (const mode of ["Lineage", "LimitsOnly"] as const) {
      expect(provenanceBadge(p4Alice(), demoTask(), mode)).toEqual({
        code: "P1",
        label: "Signed by you",
        tone: "green",
        detail: "Alice — logo, max 20 tUSDC (task #2)",
      });
    }
  });

  it("P1 without its task still says which slot", () => {
    expect(provenanceBadge(p4Alice(), null, "Lineage")).toMatchObject({ code: "P1", detail: "slot 0" });
  });

  it("P2 Resolved via registry, blue", () => {
    for (const mode of ["Lineage", "LimitsOnly"] as const) {
      expect(provenanceBadge(p3Translation(), demoTask(), mode)).toEqual({
        code: "P2",
        label: "Resolved via registry",
        tone: "blue",
        detail: `${REGISTRY} → translate-hi`,
      });
    }
  });

  it("P3 Lineage AwaitingApproval: needs you, amber", () => {
    expect(provenanceBadge(untrusted("AwaitingApproval"), demoTask(), "Lineage")).toEqual({
      code: "P3",
      label: "Untrusted — needs you",
      tone: "amber",
      detail: "Raw address from the agent; waits for you",
    });
  });

  it("P3 Lineage Rejected: rejected by you, grey, reason", () => {
    expect(provenanceBadge(untrusted("Rejected", "superseded by demo run"), demoTask(), "Lineage")).toEqual({
      code: "P3",
      label: "Untrusted — rejected by you",
      tone: "grey",
      detail: "superseded by demo run",
    });
  });

  it("P3 Lineage Paid or Sending: approved by you, grey", () => {
    for (const s of ["Paid", "Sending"] as const) {
      expect(provenanceBadge(untrusted(s), demoTask(), "Lineage")).toEqual({
        code: "P3",
        label: "Untrusted — approved by you",
        tone: "grey",
        detail: "",
      });
    }
  });

  it("P3 LimitsOnly Paid or Sending: paid without asking, red", () => {
    for (const s of ["Paid", "Sending"] as const) {
      expect(provenanceBadge(untrusted(s), demoTask(), "LimitsOnly")).toEqual({
        code: "P3",
        label: "Untrusted — paid without asking",
        tone: "red",
        detail: "",
      });
    }
  });

  it("P3 Blocked or Failed: blocked, grey, reason (either mode)", () => {
    for (const mode of ["Lineage", "LimitsOnly"] as const) {
      for (const s of ["Blocked", "Failed"] as const) {
        expect(provenanceBadge(untrusted(s, "Vault is frozen"), demoTask(), mode)).toEqual({
          code: "P3",
          label: "Untrusted — blocked",
          tone: "grey",
          detail: "Vault is frozen",
        });
      }
    }
  });

  it("P1 detail falls back to the account when the slot is missing", () => {
    const t = demoTask(undefined, { signed_payees: [] });
    expect(provenanceBadge(p4Alice(), t, "Lineage").detail).toBe(`slot 0 (task #2)`);
    expect(ALICE).toContain("alice");
  });
});

describe("statusLabel", () => {
  it("AwaitingApproval shows Needs you; others show their name", () => {
    expect(statusLabel("AwaitingApproval")).toBe("Needs you");
    for (const s of ["Resolving", "Sending", "Paid", "Failed", "Rejected", "Blocked"] as const) {
      expect(statusLabel(s)).toBe(s);
    }
  });
});
