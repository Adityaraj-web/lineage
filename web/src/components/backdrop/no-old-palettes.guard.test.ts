import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The F07 palettes and their dev-only ?bg=old switch were removed after the old/new comparison.
const SRC = path.resolve(import.meta.dirname, "../..");
const OUT = path.resolve(SRC, "../out");
const SELF = path.basename(import.meta.filename);
const MARKERS = ["bg=old", 'get("bg")', "palette-f07", "PALETTES_F07", "#0D3F32", "#3A2A0C"]; // the last two: F07's emerald and amber

const files = (dir: string, ext: RegExp) =>
  (readdirSync(dir, { recursive: true }) as string[]).filter((f) => ext.test(f) && path.basename(f) !== SELF);
const offenders = (dir: string, ext: RegExp) =>
  files(dir, ext).flatMap((f) => {
    const text = readFileSync(path.join(dir, f), "utf8");
    return MARKERS.filter((m) => text.includes(m)).map((m) => `${f}: ${m}`);
  });

describe("no F07 palette switch", () => {
  it("nothing in src references ?bg=old or the F07 palettes", () => {
    expect(offenders(SRC, /\.(ts|tsx|css)$/)).toEqual([]);
  });

  it.skipIf(!existsSync(OUT))("the static export (web/out, after npm run web:build) has no trace of it", () => {
    expect(files(OUT, /\.(html|js|css|txt)$/).length).toBeGreaterThan(0);
    expect(offenders(OUT, /\.(html|js|css|txt)$/)).toEqual([]);
  });
});
