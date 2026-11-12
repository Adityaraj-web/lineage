// The ledger field's state: threads of light running along a dot grid. Pure (no DOM), seeded, so
// the rules (P3 stops at its gate on Lineage, passes and turns rose on LimitsOnly) are unit-tested.

export type Mood = "overview" | "lineage" | "limits" | "compare";
export type Kind = "p1" | "p2" | "p3";
export type Rule = "stop" | "pass";

export interface Pt {
  x: number;
  y: number;
}

export interface Gate {
  at: number; // distance along the path
  pt: Pt;
  dir: Pt; // unit direction of travel at the gate
  open: number; // 0 closed .. 1 open (pass)
  glow: number; // 0..1 (stop)
}

export interface Thread {
  id: number;
  kind: Kind;
  rule: Rule | null;
  pts: Pt[];
  cum: number[];
  len: number;
  head: number;
  speed: number;
  tail: number;
  node: number | null; // P2: distance of the registry ring
  gate: Gate | null;
  state: "run" | "stopped" | "fading" | "done";
  alpha: number;
  rose: number;
  stoppedFor: number;
  flash: number; // end flash for finishing threads, 1 → 0
}

export interface FieldConfig {
  width: number;
  height: number;
  mood: Mood;
  seed: number;
  maxThreads: number;
}

export interface Tier {
  maxThreads: number;
  fps: 60 | 30;
  spotlight: boolean;
}

export const PITCH = 28;
const HALF = PITCH / 2;
const SPAWN_PER_S = 1.2;
const STOP_HOLD_S = 0.15;
const FADE_S = 0.4;
const ROSE_S = 0.3;

export function fieldMood(path: string): Mood {
  const p = path.length > 1 ? path.replace(/\/+$/, "") : path;
  if (p === "/vault/vault") return "lineage";
  if (p === "/vault/guarded") return "limits";
  if (p === "/compare") return "compare";
  return "overview";
}

export function ruleAt(mood: Mood, x: number, width: number): Rule {
  if (mood === "limits") return "pass";
  if (mood === "compare") return x < width / 2 ? "stop" : "pass";
  return "stop";
}

export function tierFor(env: { cores?: number; memory?: number; saveData?: boolean; coarse?: boolean; fine?: boolean }): Tier {
  const fine = !!env.fine && !env.coarse;
  if ((env.cores ?? 8) <= 4 || (env.memory ?? 8) <= 4 || env.saveData) return { maxThreads: 5, fps: 30, spotlight: fine };
  if (env.coarse) return { maxThreads: 6, fps: 30, spotlight: false };
  return { maxThreads: 12, fps: 60, spotlight: fine };
}

// 30fps cap: draw when at least one 30Hz frame has accumulated (1ms slack for timer jitter).
export function frameGate(acc: number, dt: number, fps: 60 | 30): { draw: boolean; acc: number } {
  if (fps === 60) return { draw: true, acc: 0 };
  const step = 1 / 30 - 0.001;
  const a = acc + dt;
  return a >= step ? { draw: true, acc: Math.min(a - step, step) } : { draw: false, acc: a };
}

// Rolling frame interval; reports once when 60 frames average over 24ms. The first `warmup`
// frames (page load, hydration, first RPC) are ignored so load jank doesn't degrade the field.
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

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pointAt(t: Pick<Thread, "pts" | "cum">, d: number): { pt: Pt; dir: Pt } {
  const { pts, cum } = t;
  const last = pts.length - 1;
  if (d <= 0) return { pt: pts[0], dir: unit(pts[0], pts[1]) };
  for (let i = 1; i <= last; i++) {
    if (d <= cum[i]) {
      const a = pts[i - 1];
      const b = pts[i];
      const seg = cum[i] - cum[i - 1];
      const k = seg === 0 ? 0 : (d - cum[i - 1]) / seg;
      return { pt: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, dir: unit(a, b) };
    }
  }
  return { pt: pts[last], dir: unit(pts[last - 1], pts[last]) };
}

function unit(a: Pt, b: Pt): Pt {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];

export interface Field {
  readonly threads: Thread[];
  mood: Mood;
  step(dt: number): void;
  spawn(kind?: Kind): Thread;
  resize(width: number, height: number): void;
  setMaxThreads(n: number): void;
}

export function createField(cfg: FieldConfig): Field {
  const rng = mulberry32(cfg.seed);
  let { width, height, maxThreads } = cfg;
  let nextId = 0;
  let spawnAcc = 0;
  let p3Due = 1.5;
  const threads: Thread[] = [];

  const node = (n: number) => HALF + n * PITCH;
  const cols = () => Math.max(2, Math.floor((width - HALF) / PITCH) + 1);
  const rows = () => Math.max(2, Math.floor((height - HALF) / PITCH) + 1);

  function buildPath(region: { min: number; max: number }): Pt[] {
    const cMin = Math.ceil((region.min - HALF) / PITCH);
    const cMax = Math.min(cols() - 1, Math.floor((region.max - HALF) / PITCH));
    const rMax = rows() - 1;
    const pick = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
    let c = pick(cMin, cMax);
    let r = pick(0, rMax);
    let dir = Math.floor(rng() * 4);
    const pts: Pt[] = [{ x: node(c), y: node(r) }];
    const segments = 2 + Math.floor(rng() * 3);
    for (let s = 0; s < segments; s++) {
      if (s > 0) dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4;
      let len = 4 + Math.floor(rng() * 9);
      const d = DIRS[dir];
      // Bounce off the edges of the region instead of leaving it.
      const room = d.x > 0 ? cMax - c : d.x < 0 ? c - cMin : d.y > 0 ? rMax - r : r;
      if (room < 3) {
        dir = (dir + 2) % 4;
        const d2 = DIRS[dir];
        const room2 = d2.x > 0 ? cMax - c : d2.x < 0 ? c - cMin : d2.y > 0 ? rMax - r : r;
        len = Math.min(len, room2);
      } else len = Math.min(len, room);
      if (len <= 0) continue;
      const dd = DIRS[dir];
      c += dd.x * len;
      r += dd.y * len;
      pts.push({ x: node(c), y: node(r) });
    }
    return pts;
  }

  function spawn(kind?: Kind): Thread {
    const k: Kind = kind ?? (rng() < 0.4 ? "p1" : rng() < 0.5 ? "p2" : "p3");
    const region =
      field.mood === "compare"
        ? rng() < 0.5
          ? { min: 0, max: width / 2 - 1 }
          : { min: width / 2, max: width }
        : { min: 0, max: width };
    let pts = buildPath(region);
    let tries = 0;
    while (pathLength(pts) < PITCH * 8 && tries++ < 8) pts = buildPath(region);
    if (pts.length < 2) pts = [pts[0], { x: pts[0].x, y: pts[0].y + PITCH * 8 <= height ? pts[0].y + PITCH * 8 : pts[0].y - PITCH * 8 }];
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    const len = cum[cum.length - 1];
    const base = { pts, cum };
    let gate: Gate | null = null;
    let rule: Rule | null = null;
    if (k === "p3") {
      const at = len * (0.55 + rng() * 0.15);
      const { pt, dir } = pointAt(base, at);
      gate = { at, pt, dir, open: 0, glow: 0 };
      rule = ruleAt(field.mood, pts[0].x, width);
    }
    const t: Thread = {
      id: nextId++,
      kind: k,
      rule,
      pts,
      cum,
      len,
      head: 0,
      speed: 90 + rng() * 50,
      tail: 140 + rng() * 80,
      node: k === "p2" ? len * 0.45 : null,
      gate,
      state: "run",
      alpha: 1,
      rose: 0,
      stoppedFor: 0,
      flash: 0,
    };
    threads.push(t);
    return t;
  }

  function advance(t: Thread, dt: number) {
    if (t.state === "run") {
      t.head += t.speed * dt;
      const g = t.gate;
      if (g && t.rule === "stop" && t.head >= g.at) {
        t.head = g.at;
        t.state = "stopped";
        g.glow = 1;
      } else if (g && t.rule === "pass") {
        g.open = clamp01((t.head - (g.at - 40)) / 40);
        t.rose = clamp01((t.head - g.at) / (t.speed * ROSE_S));
      }
      if (t.state === "run" && t.head >= t.len && t.flash === 0 && t.head - t.speed * dt < t.len) t.flash = 1;
      if (t.head >= t.len + t.tail) t.state = "done";
    } else if (t.state === "stopped") {
      t.stoppedFor += dt;
      if (t.stoppedFor >= STOP_HOLD_S) t.state = "fading";
    } else if (t.state === "fading") {
      t.alpha = Math.max(0, t.alpha - dt / FADE_S);
      if (t.gate) t.gate.glow = t.alpha;
      if (t.alpha === 0) t.state = "done";
    }
    if (t.flash > 0) t.flash = Math.max(0, t.flash - dt / 0.5);
  }

  const field: Field = {
    threads,
    mood: cfg.mood,
    spawn,
    step(dt) {
      const d = Math.min(dt, 1 / 20);
      for (const t of threads) advance(t, d);
      for (let i = threads.length - 1; i >= 0; i--) if (threads[i].state === "done") threads.splice(i, 1);
      p3Due -= d;
      spawnAcc += d * SPAWN_PER_S;
      while (spawnAcc >= 1 && threads.length < maxThreads) {
        spawnAcc -= 1;
        spawn(p3Due <= 0 ? "p3" : undefined);
        if (p3Due <= 0) p3Due = 3 + rng() * 2;
      }
      if (spawnAcc >= 1) spawnAcc = 1;
      if (p3Due <= 0 && threads.length < maxThreads) {
        spawn("p3");
        p3Due = 3 + rng() * 2;
      }
    },
    resize(w, h) {
      width = w;
      height = h;
      threads.length = 0;
    },
    setMaxThreads(n) {
      maxThreads = n;
    },
  };
  return field;
}

function pathLength(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return s;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Reduced motion: a fixed set of threads drawn in place, each at its end state.
export function settledThreads(cfg: FieldConfig): Thread[] {
  const f = createField(cfg);
  const kinds: Kind[] = ["p1", "p2", "p3", "p1", "p3", "p2", "p1", "p3", "p2", "p1", "p3", "p2"];
  const out = kinds.slice(0, Math.max(8, Math.min(12, cfg.maxThreads))).map((k) => f.spawn(k));
  for (const t of out) {
    if (t.kind === "p3" && t.gate) {
      if (t.rule === "stop") {
        t.head = t.gate.at;
        t.gate.glow = 1;
        t.state = "stopped";
      } else {
        t.head = t.len;
        t.gate.open = 1;
        t.rose = 1;
      }
    } else t.head = t.len;
  }
  return out;
}
