import { describe, expect, it } from "vitest";
import { CYCLE_S, fieldAt, PALETTES, type RGB } from "../backdrop/palette";
import { TRACK } from "./FreezeSwitch";

const lin = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const over = (a: number, bg: RGB): RGB => [bg[0] + (255 - bg[0]) * a, bg[1] + (255 - bg[1]) * a, bg[2] + (255 - bg[2]) * a];
const GRAIN = 0.04; // .backdrop-grain opacity, worst case a white grain pixel

// The switch sits on the page backdrop (no glass panel there) in the left 60% of the viewport. The
// backdrop is fixed, so scrolling can put it at any height: brightest backdrop over that strip, the
// whole cycle, both vault moods, plus grain.
function brightestUnderHeader(): RGB {
  let best: RGB = [0, 0, 0];
  for (const mood of ["lineage", "limits"] as const) {
    for (let t = 0; t < CYCLE_S; t++) {
      for (let y = 0; y <= 1; y += 0.05) {
        for (let x = 0; x <= 0.6; x += 0.05) {
          const c = over(GRAIN, fieldAt(PALETTES[mood], x, y, t));
          if (lum(c) > lum(best)) best = c;
        }
      }
    }
  }
  return best;
}

describe("FreezeSwitch track", () => {
  it("off-state border reaches 3:1 against the brightest backdrop it can sit on (WCAG 1.4.11)", () => {
    const alpha = Number(TRACK.off.match(/border-white\/(\d+)/)?.[1]) / 100;
    const fill = Number(TRACK.off.match(/bg-white\/\[([\d.]+)\]/)?.[1]);
    expect(alpha).toBeGreaterThan(0);
    expect(fill).toBeGreaterThanOrEqual(0);
    const bg = brightestUnderHeader();
    // The track's fill runs under its border (background-clip: border-box).
    expect(ratio(over(alpha, over(fill, bg)), bg)).toBeGreaterThanOrEqual(3);
  });

  it("the on state is unchanged", () => {
    expect(TRACK.on).toBe("border-p2-ring bg-p2-soft");
  });
});
