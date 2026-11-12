import { describe, expect, it } from "vitest";
import { createField, FrameMonitor, fieldMood, frameGate, ruleAt, settledThreads, tierFor, type Field } from "./engine";

const W = 1440;
const H = 900;

function run(f: Field, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) f.step(dt);
}

describe("fieldMood", () => {
  it("maps each route to its mood", () => {
    expect(["/", "/vault/vault", "/vault/vault/", "/vault/guarded", "/compare", "/nope"].map(fieldMood)).toEqual([
      "overview",
      "lineage",
      "lineage",
      "limits",
      "compare",
      "overview",
    ]);
  });
});

describe("P3 at the gate", () => {
  it("stops at its gate on the Lineage vault and never passes it", () => {
    const f = createField({ width: W, height: H, mood: "lineage", seed: 7, maxThreads: 12 });
    const t = f.spawn("p3");
    expect(t.rule).toBe("stop");
    let maxHead = 0;
    for (let i = 0; i < 600 && t.state !== "done"; i++) {
      f.step(1 / 60);
      maxHead = Math.max(maxHead, t.head);
      if (t.state === "stopped") expect(t.gate!.glow).toBeGreaterThan(0);
    }
    expect(maxHead).toBeLessThanOrEqual(t.gate!.at + 1e-9);
    expect(t.state).toBe("done");
    expect(t.rose).toBe(0);
  });

  it("passes its gate on the LimitsOnly vault and turns rose", () => {
    const f = createField({ width: W, height: H, mood: "limits", seed: 7, maxThreads: 12 });
    const t = f.spawn("p3");
    expect(t.rule).toBe("pass");
    for (let i = 0; i < 900 && t.head < t.gate!.at + t.speed; i++) f.step(1 / 60);
    expect(t.head).toBeGreaterThan(t.gate!.at);
    expect(t.gate!.open).toBe(1);
    expect(t.rose).toBe(1);
  });

  it("splits Compare: threads stay in their half, stop on the left and pass on the right", () => {
    const f = createField({ width: W, height: H, mood: "compare", seed: 3, maxThreads: 40 });
    const threads = Array.from({ length: 40 }, () => f.spawn("p3"));
    for (const t of threads) {
      const left = t.pts[0].x < W / 2;
      for (const p of t.pts) expect(p.x < W / 2).toBe(left);
      expect(t.rule).toBe(left ? "stop" : "pass");
    }
    expect(ruleAt("compare", 100, W)).toBe("stop");
    expect(ruleAt("compare", W - 100, W)).toBe("pass");
    expect(ruleAt("overview", W - 100, W)).toBe("stop");
  });
});

describe("threads", () => {
  it("snap to the grid and stay on screen", () => {
    const f = createField({ width: W, height: H, mood: "overview", seed: 11, maxThreads: 12 });
    for (let i = 0; i < 30; i++) {
      const t = f.spawn();
      for (const p of t.pts) {
        expect((p.x - 14) % 28).toBeCloseTo(0);
        expect((p.y - 14) % 28).toBeCloseTo(0);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(H);
      }
      for (let k = 1; k < t.pts.length; k++) {
        const a = t.pts[k - 1];
        const b = t.pts[k];
        expect(a.x === b.x || a.y === b.y).toBe(true); // Manhattan: one axis per segment
      }
    }
  });

  it("never exceed the tier's thread count", () => {
    const f = createField({ width: W, height: H, mood: "overview", seed: 5, maxThreads: 6 });
    let max = 0;
    for (let i = 0; i < 60 * 30; i++) {
      f.step(1 / 60);
      max = Math.max(max, f.threads.length);
    }
    expect(max).toBeLessThanOrEqual(6);
    expect(max).toBeGreaterThan(2);
  });

  it("send a P3 into a gate every few seconds on the Overview", () => {
    const f = createField({ width: W, height: H, mood: "overview", seed: 9, maxThreads: 12 });
    let stops = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 20; i++) {
      f.step(1 / 60);
      for (const t of f.threads) if (t.state === "stopped" && !seen.has(t.id)) (seen.add(t.id), stops++);
    }
    expect(stops).toBeGreaterThanOrEqual(4);
  });

  it("are deterministic for a seed", () => {
    const a = createField({ width: W, height: H, mood: "overview", seed: 42, maxThreads: 12 });
    const b = createField({ width: W, height: H, mood: "overview", seed: 42, maxThreads: 12 });
    run(a, 3);
    run(b, 3);
    expect(a.threads.map((t) => [t.kind, t.head.toFixed(3)])).toEqual(b.threads.map((t) => [t.kind, t.head.toFixed(3)]));
  });
});

describe("reduced motion", () => {
  it("draws threads in place: P3s stopped at closed gates, the rest whole", () => {
    const ts = settledThreads({ width: W, height: H, mood: "lineage", seed: 1, maxThreads: 12 });
    expect(ts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(ts.map((t) => t.kind))).toEqual(new Set(["p1", "p2", "p3"]));
    for (const t of ts) {
      if (t.kind === "p3") {
        expect(t.head).toBe(t.gate!.at);
        expect(t.gate!.glow).toBe(1);
      } else expect(t.head).toBe(t.len);
    }
  });
});

describe("budget", () => {
  it("tiers: desktop 12 threads at 60fps, coarse or low-power capped at 30fps", () => {
    expect(tierFor({ cores: 8, memory: 8, fine: true })).toEqual({ maxThreads: 12, fps: 60, spotlight: true });
    expect(tierFor({ cores: 8, memory: 8, coarse: true })).toEqual({ maxThreads: 6, fps: 30, spotlight: false });
    expect(tierFor({ cores: 4, fine: true })).toMatchObject({ maxThreads: 5, fps: 30 });
    expect(tierFor({ saveData: true, fine: true })).toMatchObject({ fps: 30 });
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
