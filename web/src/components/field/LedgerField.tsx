"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import {
  createField,
  FrameMonitor,
  fieldMood,
  frameGate,
  PITCH,
  pointAt,
  settledThreads,
  tierFor,
  type Field,
  type Mood,
  type Thread,
  type Tier,
} from "./engine";

const RGB = {
  p1: [52, 211, 153],
  p2: [56, 189, 248],
  p3: [251, 191, 36],
  rose: [251, 113, 133],
} as const;
const TAIL_SEGMENTS = 8;
const SPOT_R = 180;

declare global {
  interface Window {
    __field?: { avgMs: number; fps: number; threads: number; tier: Tier; dpr: number; running: boolean };
  }
}

function colour(t: Thread): readonly number[] {
  const base = RGB[t.kind];
  if (t.rose <= 0) return base;
  return base.map((v, i) => v + (RGB.rose[i] - v) * t.rose);
}

function sprite(rgb: readonly number[]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (!g) return c;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${rgb.join(",")},0.9)`);
  grad.addColorStop(0.25, `rgba(${rgb.join(",")},0.35)`);
  grad.addColorStop(1, `rgba(${rgb.join(",")},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function drawThread(ctx: CanvasRenderingContext2D, t: Thread, sprites: Record<string, HTMLCanvasElement>, settled: boolean) {
  const rgb = colour(t);
  const end = Math.min(t.head, t.len);
  const start = settled ? 0 : Math.max(0, t.head - t.tail);
  if (end <= start) return;
  const flicker = t.state === "stopped" && t.stoppedFor < 0.1 ? (Math.floor(t.stoppedFor * 60) % 2 ? 0.35 : 1) : 1;
  const a0 = t.alpha * flicker * (settled ? 0.5 : 1);
  const n = settled ? 1 : TAIL_SEGMENTS;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let s = 0; s < n; s++) {
    const d0 = start + ((end - start) * s) / n;
    const d1 = start + ((end - start) * (s + 1)) / n;
    ctx.strokeStyle = `rgba(${rgb.join(",")},${(settled ? 1 : (s + 1) / n) * 0.75 * a0})`;
    ctx.beginPath();
    const p0 = pointAt(t, d0).pt;
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < t.pts.length; i++) if (t.cum[i] > d0 && t.cum[i] < d1) ctx.lineTo(t.pts[i].x, t.pts[i].y);
    const p1 = pointAt(t, d1).pt;
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  if (t.node !== null && end >= t.node) {
    const p = pointAt(t, t.node).pt;
    ctx.strokeStyle = `rgba(${RGB.p2.join(",")},${0.6 * a0})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!settled || t.state === "stopped") {
    const head = pointAt(t, end).pt;
    const key = t.rose > 0.5 ? "rose" : t.kind;
    ctx.globalAlpha = a0;
    ctx.drawImage(sprites[key], head.x - 16, head.y - 16, 32, 32);
    ctx.globalAlpha = 1;
  }
  if (t.flash > 0) {
    const p = t.pts[t.pts.length - 1];
    ctx.globalAlpha = t.flash * 0.8;
    ctx.drawImage(sprites[t.kind], p.x - 24, p.y - 24, 48, 48);
    ctx.globalAlpha = 1;
  }
  const g = t.gate;
  if (g && (end >= g.at - 80 || settled)) {
    // A short bar across the path. Closed (stop): amber glow. Pass: the bar splits and slides open.
    const nx = -g.dir.y;
    const ny = g.dir.x;
    const half = 9;
    const gap = g.open * 8;
    ctx.lineWidth = 2;
    const stopRgb = RGB.p3.join(",");
    ctx.strokeStyle = t.rule === "stop" ? `rgba(${stopRgb},${0.55 + 0.45 * g.glow})` : `rgba(${stopRgb},${0.5 * (1 - g.open) + 0.2})`;
    ctx.beginPath();
    ctx.moveTo(g.pt.x + nx * (gap + 1), g.pt.y + ny * (gap + 1));
    ctx.lineTo(g.pt.x + nx * (half + gap), g.pt.y + ny * (half + gap));
    ctx.moveTo(g.pt.x - nx * (gap + 1), g.pt.y - ny * (gap + 1));
    ctx.lineTo(g.pt.x - nx * (half + gap), g.pt.y - ny * (half + gap));
    ctx.stroke();
    if (g.glow > 0) {
      ctx.globalAlpha = g.glow * 0.9 * (t.alpha || 1);
      ctx.drawImage(sprites.p3, g.pt.x - 22, g.pt.y - 22, 44, 44);
      ctx.globalAlpha = 1;
    }
  }
}

// The ledger field behind every page: CSS aurora and dot grid, and one canvas with the threads,
// gates and cursor spotlight in a single rAF loop. aria-hidden, never takes pointer events.
export function LedgerField() {
  const mood = fieldMood(usePathname() ?? "/");
  const reduced = useReducedMotionPref();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef<Mood>(mood);
  const fieldRef = useRef<Field | null>(null);
  const redrawRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    moodRef.current = mood;
    if (fieldRef.current) fieldRef.current.mood = mood;
    redrawRef.current?.();
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
    let tier = tierFor({
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      saveData: nav.connection?.saveData,
      coarse: mq("(pointer: coarse)"),
      fine: mq("(hover: hover) and (pointer: fine)"),
    });
    const stats = new URLSearchParams(window.location.search).has("fieldstats");
    const sprites = { p1: sprite(RGB.p1), p2: sprite(RGB.p2), p3: sprite(RGB.p3), rose: sprite(RGB.rose) };
    let w = 0;
    let h = 0;
    let dpr = 1;
    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    if (reduced) {
      const drawStatic = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = "lighter";
        const ts = settledThreads({ width: w, height: h, mood: moodRef.current, seed: 17, maxThreads: tier.maxThreads });
        for (const t of ts) drawThread(ctx, t, sprites, true);
        ctx.globalCompositeOperation = "source-over";
      };
      drawStatic();
      redrawRef.current = drawStatic;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onResize = () => {
        clearTimeout(timer);
        timer = setTimeout(() => (size(), drawStatic()), 150);
      };
      window.addEventListener("resize", onResize);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", onResize);
        redrawRef.current = null;
      };
    }

    const field = createField({ width: w, height: h, mood: moodRef.current, seed: (Date.now() % 100000) | 1, maxThreads: tier.maxThreads });
    fieldRef.current = field;
    redrawRef.current = null;
    const monitor = new FrameMonitor(180);
    const spot = { x: -999, y: -999, vx: 0, vy: 0, tx: -999, ty: -999, a: 0, ta: 0 };
    let raf = 0;
    let last = 0;
    let acc = 0;
    let msAvg = 0;
    let frames = 0;
    let fpsT = 0;
    let fps = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      if (last && monitor.push(now - last)) {
        tier = { ...tier, fps: 30, maxThreads: Math.max(3, Math.floor(tier.maxThreads / 2)) };
        field.setMaxThreads(tier.maxThreads);
      }
      last = now;
      const gate = frameGate(acc, dt, tier.fps);
      acc = gate.acc;
      field.step(dt);
      if (tier.spotlight) {
        // Critically damped spring towards the cursor (semi-implicit Euler).
        const k = 170;
        const c = 26;
        const ddt = Math.min(dt, 1 / 30);
        spot.vx += (k * (spot.tx - spot.x) - c * spot.vx) * ddt;
        spot.vy += (k * (spot.ty - spot.y) - c * spot.vy) * ddt;
        spot.x += spot.vx * ddt;
        spot.y += spot.vy * ddt;
        spot.a += (spot.ta - spot.a) * Math.min(1, ddt * 6);
      }
      if (!gate.draw) return;
      const t0 = stats ? performance.now() : 0;
      ctx.clearRect(0, 0, w, h);
      if (spot.a > 0.01) {
        const x0 = Math.max(0, Math.floor((spot.x - SPOT_R - PITCH / 2) / PITCH));
        const x1 = Math.ceil((spot.x + SPOT_R) / PITCH);
        const y0 = Math.max(0, Math.floor((spot.y - SPOT_R - PITCH / 2) / PITCH));
        const y1 = Math.ceil((spot.y + SPOT_R) / PITCH);
        for (let i = x0; i <= x1; i++) {
          for (let j = y0; j <= y1; j++) {
            const x = PITCH / 2 + i * PITCH;
            const y = PITCH / 2 + j * PITCH;
            const d = Math.hypot(x - spot.x, y - spot.y);
            if (d >= SPOT_R) continue;
            const f = 1 - d / SPOT_R;
            ctx.fillStyle = `rgba(236,238,243,${f * f * 0.32 * spot.a})`;
            ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
          }
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (const t of field.threads) drawThread(ctx, t, sprites, false);
      ctx.globalCompositeOperation = "source-over";
      if (stats) {
        const ms = performance.now() - t0;
        msAvg = msAvg ? msAvg * 0.98 + ms * 0.02 : ms;
        frames++;
        if (now - fpsT >= 1000) {
          fps = (frames * 1000) / (now - fpsT || 1000);
          frames = 0;
          fpsT = now;
        }
        window.__field = { avgMs: +msAvg.toFixed(3), fps: Math.round(fps), threads: field.threads.length, tier, dpr, running: true };
      }
    };

    const start = () => {
      if (raf || document.visibilityState === "hidden") return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (stats && window.__field) window.__field = { ...window.__field, running: false };
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        size();
        field.resize(w, h);
      }, 150);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      if (spot.a < 0.01 && spot.ta === 0) {
        spot.x = e.clientX;
        spot.y = e.clientY;
      }
      spot.tx = e.clientX;
      spot.ty = e.clientY;
      spot.ta = 1;
    };
    const onLeave = () => void (spot.ta = 0);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    if (tier.spotlight) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    start();
    return () => {
      stop();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      fieldRef.current = null;
    };
  }, [reduced]);

  return (
    <div aria-hidden="true" className="ledger-field" data-mood={mood} data-testid="ledger-field">
      <div className="aurora aurora-overview" />
      <div className="aurora aurora-lineage" />
      <div className="aurora aurora-limits" />
      <div className="aurora aurora-compare" />
      <div className="field-grid" />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
    </div>
  );
}
