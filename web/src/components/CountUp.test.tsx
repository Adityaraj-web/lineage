import { describe, expect, it } from "vitest";
import { fmtUsdc } from "@/lib/format";
import { renderUI } from "@/test/render";
import { setReducedMotion } from "@/test/media";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  it("puts the final value in accessible text at once", () => {
    const { container } = renderUI(<CountUp value={49_000_000n} format={fmtUsdc} />);
    expect(container.querySelector(".sr-only")).toHaveTextContent("49 tUSDC");
  });

  it("stays exact above 2^53", () => {
    const big = 2n ** 60n + 1n;
    const { container } = renderUI(<CountUp value={big} format={fmtUsdc} />);
    expect(container.querySelector(".sr-only")).toHaveTextContent(fmtUsdc(big));
    expect(fmtUsdc(big)).toBe("1152921504606.846977 tUSDC");
  });

  it("settles on the final value in the final face", () => {
    setReducedMotion(true);
    const { container } = renderUI(<CountUp value={49_000_000n} format={fmtUsdc} finalClassName="font-serif" />);
    const visible = container.querySelector("[data-countup='final']");
    expect(visible).toHaveTextContent("49 tUSDC");
    expect(visible).toHaveClass("font-serif");
  });
});
