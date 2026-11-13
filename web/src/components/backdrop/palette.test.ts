import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOBS,
  blobsAt,
  CYCLE_S,
  easeInOut,
  fieldAt,
  FrameMonitor,
  frameGate,
  hex,
  HUE,
  inkShare,
  mixPalette,
  moodFor,
  PALETTES,
  resolve,
  REST_T,
  tierFor,
  type Mood,
  type Palette,
} from "./palette";

const INK = hex("#070A12");
const INDIGO = hex("#1A1F4D");
const TEAL = hex("#0E3B43");
const ROSE = hex("#4A1830");
const MOODS = Object.keys(PALETTES) as Mood[];

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
      expect(p.ink).toEqual(INK);
    }
  });

  it("one hue per page: indigo, teal, rose, every blob in the mood's hue, k ≤ 1.3", () => {
    expect(PALETTES.overview.hue).toEqual(INDIGO);
    expect(PALETTES.lineage.hue).toEqual(TEAL);
    expect(PALETTES.limits.hue).toEqual(ROSE);
    for (const m of ["overview", "lineage", "limits"] as const) {
      for (const bl of PALETTES[m].blobs) expect(bl.h).toBeUndefined();
    }
    for (const bl of Object.values(PALETTES).flatMap((p) => p.blobs)) {
      expect(bl.k).toBeGreaterThan(0);
      expect(bl.k).toBeLessThanOrEqual(1.3);
    }
  });

  it("Compare is the one two-hue page: teal on the left, rose on the right, nothing else", () => {
    const p = PALETTES.compare;
    expect(p.hue).toEqual(TEAL);
    for (const bl of p.blobs) {
      if (bl.h === undefined) expect(bl.x).toBeLessThan(0.5);
      else {
        expect(bl.h).toEqual(ROSE);
        expect(bl.x).toBeGreaterThan(0.5);
      }
    }
  });

  it("resolves a blob's colour as hue × k", () => {
    const p = PALETTES.lineage;
    const r = resolve(p);
    r.blobs.forEach((bl, i) => {
      const k = p.blobs[i].k;
      expect(bl.c).toEqual([TEAL[0] * k, TEAL[1] * k, TEAL[2] * k]);
    });
    expect(resolve(PALETTES.compare).blobs.some((bl) => bl.c[0] > bl.c[2])).toBe(true); // rose is red-led
  });

  it("mixes between palettes and clamps t", () => {
    const a = resolve(PALETTES.overview);
    const b = resolve(PALETTES.limits);
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

  it("the shadow tint per page matches globals.css", () => {
    const css = readFileSync(path.resolve(import.meta.dirname, "../../app/globals.css"), "utf8");
    const hueIn = (selector: string) => {
      const block = css.slice(css.indexOf(`${selector} {`));
      return block.match(/--hue:\s*([^;]+);/)?.[1].trim();
    };
    expect(hueIn(":root")).toBe(HUE.overview);
    for (const m of ["lineage", "limits", "compare"] as const) expect(hueIn(`:root[data-mood="${m}"]`)).toBe(HUE[m]);
  });
});

describe("fieldAt (the shader, in TS)", () => {
  const flat = (s: number, r: number): Palette => ({
    ink: INK,
    hue: INDIGO,
    blobs: Array.from({ length: BLOBS }, () => ({ x: 0.5, y: 0.5, r, s, k: 1 })),
  });

  it("is ink where no blob reaches", () => {
    for (const [x, y] of [[0, 0], [0.5, 0.5], [0.9, 0.2]]) expect(fieldAt(flat(0, 0.2), x, y, 0)).toEqual([...INK]);
  });

  it("adds the blobs and mixes halfway back to ink in the centre column", () => {
    const p: Palette = { ...flat(0, 1000), blobs: flat(0, 1000).blobs.map((b, i) => (i === 0 ? { ...b, s: 1 } : b)) };
    const edge = fieldAt(p, 0, 0.5, 0);
    const centre = fieldAt(p, 0.5, 0.5, 0);
    edge.forEach((v, c) => expect(v).toBeCloseTo(INK[c] + INDIGO[c], 3));
    centre.forEach((v, c) => expect(v).toBeCloseTo(INK[c] + INDIGO[c] / 2, 3));
  });

  it("clamps like the framebuffer", () => {
    const p: Palette = { ...flat(1, 1000), hue: [255, 255, 255] };
    expect(fieldAt(p, 0, 0.5, 0)).toEqual([255, 255, 255]);
  });
});

describe("inkShare", () => {
  for (const m of MOODS) {
    for (const t of [0, REST_T, CYCLE_S / 2]) {
      it(`${m} at t=${t}: most of the page is ink, but not all of it`, () => {
        const share = inkShare(PALETTES[m], t);
        expect(share).toBeGreaterThanOrEqual(0.65);
        expect(share).toBeLessThanOrEqual(0.78);
      });
    }
  }
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
