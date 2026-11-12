// Pure parts of the backdrop: moods, palettes, blob motion, the device tier and the frame budget.

export type Mood = "overview" | "lineage" | "limits" | "compare";
export type RGB = readonly [number, number, number];

// One soft shape: colour, anchor (fractions of the viewport, y from the top), radius as a
// fraction of the viewport's longer side, and strength.
export interface Blob {
  c: RGB;
  x: number;
  y: number;
  r: number;
  s: number;
}

export interface Palette {
  ink: RGB;
  blobs: readonly Blob[];
}

export const BLOBS = 5;
export const CYCLE_S = 40;

export function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const INK = hex("#070A12");
const INDIGO = hex("#1A1F4D");
const TEAL = hex("#0E3B43");
const EMERALD = hex("#0D3F32");
const AMBER = hex("#3A2A0C");
const ROSE = hex("#4A1830");

const b = (c: RGB, x: number, y: number, r: number, s: number): Blob => ({ c, x, y, r, s });

// Peaks sit at the edges and behind the stages; the reading column stays near ink.
export const PALETTES: Record<Mood, Palette> = {
  overview: {
    ink: INK,
    blobs: [b(INDIGO, 0.08, 0.12, 0.36, 1.25), b(TEAL, 0.86, 0.5, 0.3, 1.15), b(INDIGO, 0.62, 0.95, 0.36, 1.1), b(EMERALD, 0.78, 0.02, 0.202, 0.8), b(AMBER, 0.12, 1.02, 0.216, 0.9)],
  },
  lineage: {
    ink: INK,
    blobs: [b(TEAL, 0.06, 0.1, 0.36, 1.3), b(EMERALD, 0.94, 0.28, 0.302, 1.1), b(TEAL, 0.6, 0.98, 0.346, 1.1), b(INDIGO, 0.3, 0.6, 0.274, 0.7), b(AMBER, 0.9, 1.02, 0.202, 0.8)],
  },
  limits: {
    ink: INK,
    blobs: [b(INDIGO, 0.06, 0.1, 0.36, 1.3), b(ROSE, 0.94, 0.3, 0.302, 1.0), b(INDIGO, 0.6, 0.98, 0.346, 1.1), b(ROSE, 0.2, 0.75, 0.216, 0.55), b(AMBER, 0.88, 1.02, 0.202, 0.8)],
  },
  compare: {
    ink: INK,
    blobs: [b(TEAL, 0.04, 0.2, 0.302, 1.3), b(TEAL, 0.14, 0.85, 0.274, 1.0), b(ROSE, 0.96, 0.2, 0.302, 1.0), b(ROSE, 0.86, 0.85, 0.274, 0.85), b(AMBER, 0.5, 1.06, 0.187, 0.7)],
  },
};

// Shadow tint per page (rgb triplet for `rgb(var(--hue) / a)`).
export const HUE: Record<Mood, string> = {
  overview: "59 68 168",
  lineage: "20 140 120",
  limits: "150 50 90",
  compare: "40 110 140",
};

export function moodFor(path: string): Mood {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p === "/vault/vault") return "lineage";
  if (p === "/vault/guarded") return "limits";
  if (p === "/compare") return "compare";
  return "overview";
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  const k = Math.min(1, Math.max(0, t));
  return {
    ink: mixRgb(a.ink, b.ink, k),
    blobs: a.blobs.map((x, i) => {
      const y = b.blobs[i];
      return { c: mixRgb(x.c, y.c, k), x: lerp(x.x, y.x, k), y: lerp(x.y, y.y, k), r: lerp(x.r, y.r, k), s: lerp(x.s, y.s, k) };
    }),
  };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Each blob drifts on a Lissajous path whose frequencies are whole multiples of 1/CYCLE_S, so the
// whole field repeats exactly every CYCLE_S seconds. Returns [x, y, r, s] per blob.
const FREQ: readonly [number, number][] = [[1, 2], [2, 1], [1, 1], [2, 3], [1, 2]];
const AMP = 0.07;

export function blobsAt(p: Palette, t: number): Float32Array {
  const out = new Float32Array(BLOBS * 4);
  const w = (2 * Math.PI) / CYCLE_S;
  p.blobs.forEach((bl, i) => {
    const [fx, fy] = FREQ[i];
    out[i * 4] = bl.x + AMP * Math.sin(w * fx * t + i * 1.7);
    out[i * 4 + 1] = bl.y + AMP * Math.cos(w * fy * t + i * 0.9);
    out[i * 4 + 2] = bl.r * (1 + 0.08 * Math.sin(w * t + i));
    out[i * 4 + 3] = bl.s;
  });
  return out;
}

export interface Tier {
  low: boolean;
  light: boolean;
}

// Low-power devices drop the glass blur to 12px; the cursor light needs a real hovering pointer.
export function tierFor(env: { cores?: number; memory?: number; saveData?: boolean; coarse?: boolean; fine?: boolean }): Tier {
  const fine = !!env.fine && !env.coarse;
  const low = (env.cores ?? 8) <= 4 || (env.memory ?? 8) <= 4 || !!env.saveData;
  return { low, light: fine };
}

// 30fps cap: draw when at least one 30Hz frame has accumulated (1ms slack for timer jitter).
export function frameGate(acc: number, dt: number, fps: 60 | 30): { draw: boolean; acc: number } {
  if (fps === 60) return { draw: true, acc: 0 };
  const step = 1 / 30 - 0.001;
  const a = acc + dt;
  return a >= step ? { draw: true, acc: Math.min(a - step, step) } : { draw: false, acc: a };
}

// Rolling frame interval; reports once when 60 frames average over 24ms. The first `warmup`
// frames (page load, hydration, first RPC) are ignored so load jank doesn't degrade the backdrop.
export class FrameMonitor {
  private buf: number[] = [];
  private tripped = false;
  private skip: number;
  constructor(warmup = 0) {
    this.skip = warmup;
  }
  push(ms: number): boolean {
    if (this.skip > 0) {
      this.skip--;
      return false;
    }
    this.buf.push(ms);
    if (this.buf.length > 60) this.buf.shift();
    if (this.tripped || this.buf.length < 60) return false;
    const avg = this.buf.reduce((s, v) => s + v, 0) / this.buf.length;
    if (avg > 24) this.tripped = true;
    return this.tripped;
  }
}
