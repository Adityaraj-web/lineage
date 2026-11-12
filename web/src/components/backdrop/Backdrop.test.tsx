import { describe, expect, it, vi } from "vitest";
import { setReducedMotion } from "@/test/media";
import { renderUI } from "@/test/render";
import { Backdrop } from "./Backdrop";

let path = "/";
vi.mock("next/navigation", () => ({ usePathname: () => path }));

describe("Backdrop", () => {
  for (const [p, mood] of [
    ["/", "overview"],
    ["/vault/vault", "lineage"],
    ["/vault/guarded", "limits"],
    ["/compare", "compare"],
  ] as const) {
    it(`takes the ${mood} mood on ${p}, hidden from assistive tech`, () => {
      path = p;
      const { getByTestId } = renderUI(<Backdrop />);
      const bg = getByTestId("backdrop");
      expect(bg).toHaveAttribute("data-mood", mood);
      expect(bg).toHaveAttribute("aria-hidden", "true");
      expect(document.documentElement).toHaveAttribute("data-mood", mood);
    });
  }

  it("falls back to the CSS gradient without WebGL (jsdom), under reduced motion too", () => {
    setReducedMotion(true);
    path = "/";
    const { getByTestId } = renderUI(<Backdrop />);
    expect(getByTestId("backdrop")).toHaveAttribute("data-gl", "off");
  });
});
