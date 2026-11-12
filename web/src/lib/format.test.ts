import { describe, expect, it } from "vitest";
import { fmtAgo, fmtDate, fmtUsdc } from "./format";

describe("fmtUsdc", () => {
  it("formats whole and fractional amounts", () => {
    expect(fmtUsdc("49000000")).toBe("49 tUSDC");
    expect(fmtUsdc("500000")).toBe("0.5 tUSDC");
    expect(fmtUsdc(18_250_000n)).toBe("18.25 tUSDC");
    expect(fmtUsdc("0")).toBe("0 tUSDC");
    expect(fmtUsdc("1")).toBe("0.000001 tUSDC");
  });

  it("stays exact above 2^53", () => {
    const v = 2n ** 64n + 1n; // 18446744073709551617
    expect(fmtUsdc(v.toString())).toBe("18446744073709.551617 tUSDC");
  });
});

describe("times", () => {
  const now = 1794480000000;
  it("fmtAgo", () => {
    expect(fmtAgo(now - 400, now)).toBe("just now");
    expect(fmtAgo(now - 3_000, now)).toBe("3 s ago");
    expect(fmtAgo(now - 5 * 60_000, now)).toBe("5 min ago");
    expect(fmtAgo(now - 2 * 3_600_000, now)).toBe("2 h ago");
    expect(fmtAgo(now - 4 * 86_400_000, now)).toBe("4 d ago");
    expect(fmtAgo(now + 3 * 86_400_000, now)).toBe("in 3 d");
  });

  it("fmtDate is UTC and locale independent", () => {
    expect(fmtDate(Date.UTC(2026, 10, 25, 9, 5))).toBe("2026-11-25 09:05 UTC");
  });
});
