import { describe, expect, it, vi } from "vitest";
import { renderUI } from "@/test/render";
import { setReducedMotion } from "@/test/media";
import { LedgerField } from "./LedgerField";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

describe("LedgerField", () => {
  for (const [p, mood] of [
    ["/", "overview"],
    ["/vault/vault", "lineage"],
    ["/vault/guarded", "limits"],
    ["/compare", "compare"],
  ] as const) {
    it(`takes the ${mood} mood on ${p}, hidden from assistive tech`, () => {
      path = p;
      const { getByTestId } = renderUI(<LedgerField />);
      const field = getByTestId("ledger-field");
      expect(field).toHaveAttribute("data-mood", mood);
      expect(field).toHaveAttribute("aria-hidden", "true");
    });
  }

  it("renders without a 2D context (jsdom) under reduced motion too", () => {
    setReducedMotion(true);
    path = "/";
    expect(() => renderUI(<LedgerField />)).not.toThrow();
  });
});
