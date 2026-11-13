// Pure parts of the backdrop: moods, palettes, blob motion, the device tier and the frame budget.

export type Mood = "overview" | "lineage" | "limits" | "compare";
export type RGB = readonly [number, number, number];

// One soft shape: anchor (fractions of the viewport, y from the top), radius as a fraction of the
// viewport's longer side, strength, and brightness k of the page hue (h overrides the hue: Compare only).
export interface Blob {
  x: number;
  y: number;
  r: number;
  s: number;
  k: number;
  h?: RGB;
}

export interface Palette {
  ink: RGB;
  hue: RGB;
  blobs: readonly Blob[];
}

// What the shader draws: one colour per blob.
export interface ResolvedBlob {
  c: RGB;
  x: number;
  y: number;
  r: number;
  s: number;
}
export interface Resolved {
  ink: RGB;
  blobs: readonly ResolvedBlob[];
}

export const BLOBS = 5;
export const CYCLE_S = 40;
// The reduced-motion frame (and where the moving field starts).
export const REST_T = 7;

// Shared with the fragment shader (Backdrop.tsx), so fieldAt draws the same picture.
export const WARP = 0.035;
export const FALLOFF = 3;
export const MIX_EDGE: readonly [number, number] = [0.1, 0.85];
export const OMEGA = (2 * Math.PI) / CYCLE_S;

export function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const INK = hex("#070A12");
const INDIGO = hex("#1A1F4D");
const TEAL = hex("#0E3B43");
const ROSE = hex("#4A1830");

const b = (x: number, y: number, r: number, s: number, k: number, h?: RGB): Blob => (h ? { x, y, r, s, k, h } : { x, y, r, s, k });

// One hue per page; Compare is the split, teal left and rose right. Two wide, soft blobs in the top
// band, off-centre: the colour reads as one light falling from the top; the reading column and the
// lower page stay ink. Tuned so 65–78% of the page is ink (inkShare).
export const PALETTES: Record<Mood, Palette> = {
  overview: {
    ink: INK,
    hue: INDIGO,
    // Blob 2 sits behind the hero vault card (centre measured at 1440×900 and 1920×1080).
    blobs: [b(0.2, 0.02, 0.5, 0.2, 1.3), b(0.775, 0.53, 0.34, 0.25, 1.3)],
  },
  lineage: {
    ink: INK,
    hue: TEAL,
    blobs: [b(0.16, 0.02, 0.5, 0.25, 1.3), b(0.8, 0.08, 0.45, 0.25, 1.3)],
  },
  limits: {
    ink: INK,
    hue: ROSE,
    blobs: [b(0.16, 0.02, 0.5, 0.23, 1.3), b(0.8, 0.08, 0.45, 0.23, 1.3)],
  },
  compare: {
    ink: INK,
    hue: TEAL,
    blobs: [b(0.14, 0.04, 0.5, 0.28, 1.3), b(0.86, 0.04, 0.45, 0.28, 1.3, ROSE)],
  },
};

// Shadow tint per page (rgb triplet for `rgb(var(--hue) / a)`), mirrored in globals.css.
export const HUE: Record<Mood, string> = {
  overview: "59 68 168",
  lineage: "30 130 145",
  limits: "150 50 90",
  compare: "40 110 140",
};

// The shader has BLOBS slots; a palette with fewer fills the rest with zero-strength copies, so
// tweens between palettes of any size stay slot by slot.
export function resolve(p: Palette): Resolved {
  const blobs: ResolvedBlob[] = p.blobs.map(({ x, y, r, s, k, h }) => {
    const c = h ?? p.hue;
    return { c: [c[0] * k, c[1] * k, c[2] * k], x, y, r, s };
  });
  const last = blobs[blobs.length - 1];
  while (blobs.length < BLOBS) blobs.push({ ...last, s: 0 });
  return { ink: p.ink, blobs };
}

export function moodFor(path: string): Mood {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p === "/vault/vault") return "lineage";
  if (p === "/vault/guarded") return "limits";
  if (p === "/compare") return "compare";
  return "overview";
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
const mixRgb = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function mixPalette(a: Resolved, b: Resolved, t: number): Resolved {
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

export function blobsAt(p: { blobs: readonly { x: number; y: number; r: number; s: number }[] }, t: number): Float32Array {
  const out = new Float32Array(BLOBS * 4);
  const w = OMEGA;
  p.blobs.forEach((bl, i) => {
    const [fx, fy] = FREQ[i];
    out[i * 4] = bl.x + AMP * Math.sin(w * fx * t + i * 1.7);
    out[i * 4 + 1] = bl.y + AMP * Math.cos(w * fy * t + i * 0.9);
    out[i * 4 + 2] = bl.r * (1 + 0.08 * Math.sin(w * t + i));
    out[i * 4 + 3] = bl.s;
  });
  return out;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// The fragment shader in TS (without the ±0.5/255 dither): x, y are fractions of the viewport (y from
// the top), aspect is width / height. Returns 0–255 per channel, clamped like the framebuffer.
export function fieldAt(p: Palette | Resolved, x: number, y: number, t: number, aspect = 16 / 9): RGB {
  const r = "hue" in p ? resolve(p) : p;
  const asp = aspect >= 1 ? [1, 1 / aspect] : [aspect, 1];
  const qx = x + WARP * Math.sin(y * 5 + t * OMEGA * 2);
  const qy = y + WARP * Math.cos(x * 4 - t * OMEGA);
  const bl = blobsAt(r, t);
  const ink = r.ink.map((v) => v / 255);
  const col = [...ink];
  r.blobs.forEach((b, i) => {
    const dx = (qx - bl[i * 4]) * asp[0];
    const dy = (qy - bl[i * 4 + 1]) * asp[1];
    const rad = bl[i * 4 + 2];
    const w = Math.exp((-(dx * dx + dy * dy) / (rad * rad)) * FALLOFF) * bl[i * 4 + 3];
    for (let c = 0; c < 3; c++) col[c] += (b.c[c] / 255) * w;
  });
  const m = 0.5 + 0.5 * smoothstep(MIX_EDGE[0], MIX_EDGE[1], Math.abs(x - 0.5) * 2);
  const out = col.map((v, c) => Math.min(1, Math.max(0, ink[c] + (v - ink[c]) * m)) * 255);
  return [out[0], out[1], out[2]];
}

// Share of a 64×36 grid (cell centres, 16:9) whose every channel is within 10/255 of ink.
export function inkShare(p: Palette | Resolved, t: number): number {
  const r = "hue" in p ? resolve(p) : p;
  const W = 64;
  const H = 36;
  let n = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const f = fieldAt(r, (i + 0.5) / W, (j + 0.5) / H, t, W / H);
      if (f.every((v, c) => Math.abs(v - r.ink[c]) <= 10)) n++;
    }
  }
  return n / (W * H);
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
