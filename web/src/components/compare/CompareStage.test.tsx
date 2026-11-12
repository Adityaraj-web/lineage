import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SmoothScrollContext } from "@/components/SmoothScroll";
import { CODE_HASH, p3Translation, p4Alice, p5Poisoned } from "@/lib/test-fixtures";
import { renderUI } from "@/test/render";
import { setPinned, setReducedMotion } from "@/test/media";
import { compareView, demoPayments } from "@/test/views";
import { CompareStage, compareSummary } from "./CompareStage";

const rows = () => screen.getAllByTestId(/^compare-row-/);

describe("CompareStage", () => {
  it("shows the same three payments on both sides, the poisoned invoice flagged", () => {
    renderUI(<CompareStage view={compareView()} />);
    expect(rows()).toHaveLength(3);
    expect(rows().map((r) => r.getAttribute("data-poisoned"))).toEqual(["false", "false", "true"]);
    const poisoned = rows()[2];
    expect(within(poisoned).getByText("URGENT: new payout details for invoice A-102")).toBeInTheDocument();
    const lineage = within(poisoned).getByTestId("side-vault");
    const limits = within(poisoned).getByTestId("side-guarded");
    expect(within(lineage).getByText("Untrusted — needs you")).toBeInTheDocument();
    expect(within(lineage).getByText("Needs you")).toBeInTheDocument();
    expect(within(limits).getByText("Untrusted — paid without asking")).toBeInTheDocument();
    expect(within(limits).getByText("Paid")).toBeInTheDocument();
    expect(within(limits).getByRole("link", { name: /transaction/i })).toHaveAttribute(
      "href",
      "https://testnet.nearblocks.io/txns/7v1G5XRLpdDt7sa5y7DAfTzQDeZQQshoERaYbvMXyZF4",
    );
  });

  it("states what the attacker received from each vault at first render", () => {
    renderUI(<CompareStage view={compareView()} />);
    expect(within(screen.getByTestId("attacker-vault")).getByText("0 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(screen.getByTestId("attacker-guarded")).getByText("49 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("puts the shared code hash on the seal", () => {
    renderUI(<CompareStage view={compareView()} />);
    const seal = screen.getByTestId("same-code-seal");
    expect(seal).toHaveTextContent("same code");
    expect(within(seal).getByText(CODE_HASH)).toHaveClass("sr-only");
  });

  it("says different code when the hashes differ", () => {
    renderUI(<CompareStage view={compareView({ codeHashes: { vault: CODE_HASH, guarded: "other" } })} />);
    expect(screen.getByTestId("same-code-seal")).toHaveTextContent("different code");
  });

  it("offers a replay, except under reduced motion", () => {
    renderUI(<CompareStage view={compareView()} />);
    expect(screen.getByRole("button", { name: /replay/i })).toBeInTheDocument();
  });

  it("under reduced motion shows the end state and no replay", () => {
    setReducedMotion(true);
    renderUI(<CompareStage view={compareView()} />);
    expect(screen.queryByRole("button", { name: /replay/i })).toBeNull();
    expect(rows()).toHaveLength(3);
  });
});

describe("CompareStage motion", () => {
  const shown = (id: string) => screen.getByTestId(id).querySelector("[aria-hidden=true] .num, .stat[aria-hidden=true]")?.textContent;

  it("shows the counters' final values at once when the data came from the cache", () => {
    renderUI(<CompareStage view={compareView()} settled />);
    expect(shown("attacker-guarded")).toBe("49 tUSDC");
  });

  it("counts the counters with the stage otherwise", () => {
    setPinned(true);
    renderUI(<CompareStage view={compareView()} />);
    expect(shown("attacker-guarded")).toBe("0 tUSDC");
    expect(within(screen.getByTestId("attacker-guarded")).getByText("49 tUSDC", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("Replay pauses smooth scrolling while it drives the stage, then hands it back", async () => {
    setPinned(true);
    const api = { stop: vi.fn(), start: vi.fn() };
    renderUI(
      <SmoothScrollContext.Provider value={api}>
        <CompareStage view={compareView()} />
      </SmoothScrollContext.Provider>,
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /replay/i })));
    expect(api.stop).toHaveBeenCalledTimes(1);
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" })));
    expect(api.start).toHaveBeenCalled();
  });

  it("drops the tool lines and middle dots", () => {
    const { container } = renderUI(<CompareStage view={compareView()} />);
    expect(container.textContent).not.toMatch(/agent called|·/);
  });
});

describe("compareSummary", () => {
  it("is the spec sentence for the demo run", () => {
    expect(compareSummary(compareView())).toBe(
      "Same agent, same plan, same code. Lineage held the poisoned invoice; LimitsOnly paid it.",
    );
  });

  it("follows the live status when the owner rejected it", () => {
    const v = compareView({
      payments: { vault: [p3Translation(), p4Alice(), p5Poisoned("Rejected")], guarded: demoPayments("guarded") },
    });
    expect(compareSummary(v)).toBe(
      "Same agent, same plan, same code. Lineage held the poisoned invoice and you rejected it; LimitsOnly paid it.",
    );
  });

  it("does not claim same code when the hashes differ", () => {
    expect(compareSummary(compareView({ codeHashes: { vault: CODE_HASH, guarded: "x" } }))).toMatch(
      /^Same agent, same plan\. /,
    );
  });
});
