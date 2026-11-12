import { describe, expect, it } from "vitest";
import { BLOBS, blobsAt, CYCLE_S, easeInOut, FrameMonitor, frameGate, hex, mixPalette, moodFor, PALETTES, tierFor } from "./palette";

describe("moodFor", () => {
  it("maps each route to its mood", () => {
    expect(["/", "/vault/vault", "/vault/vault/", "/vault/guarded", "/compare", "/nope"].map(moodFor)).toEqual([
      "overview",
      "lineage",
      "lineage",
      "limits",
      "compare",
      "overview",
    ]);
  });
});

describe("palettes", () => {
  it("every mood has the same blob count and the brief's ink", () => {
    for (const p of Object.values(PALETTES)) {
      expect(p.blobs).toHaveLength(BLOBS);
      expect(p.ink).toEqual(hex("#070A12"));
    }
  });

  it("Compare keeps teal on the left and rose on the right", () => {
    const { blobs } = PALETTES.compare;
    const teal = hex("#0E3B43");
    const rose = hex("#4A1830");
    for (const bl of blobs.filter((x) => x.c === teal)) expect(bl.x).toBeLessThan(0.5);
    for (const bl of blobs.filter((x) => x.c === rose)) expect(bl.x).toBeGreaterThan(0.5);
  });

  it("mixes between palettes and clamps t", () => {
    const a = PALETTES.overview;
    const b = PALETTES.limits;
    expect(mixPalette(a, b, 0)).toEqual(a);
    expect(mixPalette(a, b, 1)).toEqual(b);
    expect(mixPalette(a, b, 2)).toEqual(b);
    const mid = mixPalette(a, b, 0.5).blobs[1];
    expect(mid.c[0]).toBeCloseTo((a.blobs[1].c[0] + b.blobs[1].c[0]) / 2);
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });

  it("the field repeats every cycle and actually moves within it", () => {
    const p = PALETTES.overview;
    const a = blobsAt(p, 3);
    const b = blobsAt(p, 3 + CYCLE_S);
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 5));
    const c = blobsAt(p, 3 + CYCLE_S / 4);
    expect(Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1])).toBeGreaterThan(0.02);
  });
});

describe("budget", () => {
  it("tiers: low power drops the blur, the light needs a fine pointer", () => {
    expect(tierFor({ cores: 8, memory: 8, fine: true })).toEqual({ low: false, light: true });
    expect(tierFor({ cores: 8, memory: 8, coarse: true })).toEqual({ low: false, light: false });
    expect(tierFor({ cores: 4, fine: true })).toEqual({ low: true, light: true });
    expect(tierFor({ saveData: true, fine: true })).toMatchObject({ low: true });
  });

  it("30fps cap draws every other 60Hz frame", () => {
    let acc = 0;
    let draws = 0;
    for (let i = 0; i < 60; i++) {
      const g = frameGate(acc, 1 / 60, 30);
      acc = g.acc;
      if (g.draw) draws++;
    }
    expect(draws).toBeGreaterThanOrEqual(29);
    expect(draws).toBeLessThanOrEqual(31);
    expect(frameGate(0, 1 / 60, 60).draw).toBe(true);
  });

  it("degrades when frames run long", () => {
    const m = new FrameMonitor();
    for (let i = 0; i < 59; i++) expect(m.push(30)).toBe(false);
    expect(m.push(30)).toBe(true);
    const ok = new FrameMonitor();
    for (let i = 0; i < 120; i++) expect(ok.push(16.7)).toBe(false);
    const warm = new FrameMonitor(120);
    for (let i = 0; i < 120; i++) expect(warm.push(80)).toBe(false); // load jank ignored
    for (let i = 0; i < 60; i++) expect(warm.push(16.7)).toBe(false);
  });
});
