"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReducedMotionPref } from "@/hooks/useReducedMotionPref";
import {
  BLOBS,
  blobsAt,
  easeInOut,
  FALLOFF,
  FrameMonitor,
  frameGate,
  MIX_EDGE,
  mixPalette,
  moodFor,
  OMEGA,
  PALETTES,
  resolve,
  REST_T,
  tierFor,
  WARP,
  type Mood,
  type Resolved,
} from "./palette";

declare global {
  interface Window {
    __backdrop?: { avgMs: number; fps: number; scale: number; low: boolean; running: boolean; w: number; h: number };
  }
}

const VERT = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

// Up to five soft blobs over ink (unused slots have zero strength), the domain warped once so their edges breathe. Additive, so where
// two blobs meet the light region is brighter than either. A fixed per-pixel dither stops banding.
// palette.ts `fieldAt` is this shader in TS (minus the dither); the constants are shared.
const f = (n: number) => n.toFixed(6);
const FRAG = `precision mediump float;
uniform vec2 u_res;uniform float u_t;uniform vec3 u_ink;uniform vec3 u_c[${BLOBS}];uniform vec4 u_b[${BLOBS}];
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 px=gl_FragCoord.xy;
  vec2 uv=vec2(px.x/u_res.x,1.-px.y/u_res.y);
  vec2 asp=u_res/max(u_res.x,u_res.y);
  float w=${f(OMEGA)};
  vec2 q=uv+${f(WARP)}*vec2(sin(uv.y*5.+u_t*w*2.),cos(uv.x*4.-u_t*w));
  vec3 col=u_ink;
  for(int i=0;i<${BLOBS};i++){
    vec2 d=(q-u_b[i].xy)*asp;
    float r=u_b[i].z;
    col+=u_c[i]*exp(-dot(d,d)/(r*r)*${f(FALLOFF)})*u_b[i].w;
  }
  float cx=abs(uv.x-.5)*2.;
  col=mix(u_ink,col,.5+.5*smoothstep(${f(MIX_EDGE[0])},${f(MIX_EDGE[1])},cx));
  col+=(hash(px)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

const TWEEN_MS = 800;

const RESOLVED: Record<Mood, Resolved> = {
  overview: resolve(PALETTES.overview),
  lineage: resolve(PALETTES.lineage),
  limits: resolve(PALETTES.limits),
  compare: resolve(PALETTES.compare),
};

interface Renderer {
  draw: (p: Resolved, t: number) => void;
  resize: (w: number, h: number, scale: number) => void;
  finish: () => void;
  lost: () => boolean;
}

function makeRenderer(canvas: HTMLCanvasElement): Renderer | null {
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT);
  const fs = sh(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = u("u_res");
  const uT = u("u_t");
  const uInk = u("u_ink");
  const uC = u("u_c");
  const uB = u("u_b");
  const cols = new Float32Array(BLOBS * 3);
  return {
    draw(p, t) {
      gl.uniform1f(uT, t);
      gl.uniform3f(uInk, p.ink[0] / 255, p.ink[1] / 255, p.ink[2] / 255);
      p.blobs.forEach((b, i) => cols.set([b.c[0] / 255, b.c[1] / 255, b.c[2] / 255], i * 3));
      gl.uniform3fv(uC, cols);
      gl.uniform4fv(uB, blobsAt(p, t));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    resize(w, h, scale) {
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    },
    finish: () => gl.finish(),
    lost: () => gl.isContextLost(),
  };
}

// The page background: a slow mesh gradient (WebGL, half resolution, 30fps), a CSS gradient in
// the same colours when WebGL is missing, static film grain, and a cursor light that the glass
// above it picks up. aria-hidden, never takes pointer events.
export function Backdrop() {
  const mood = moodFor(usePathname() ?? "/");
  const reduced = useReducedMotionPref();
  const [gl, setGl] = useState<"on" | "off">("off");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const moodRef = useRef<Mood>(mood);
  const onMoodRef = useRef<((m: Mood) => void) | null>(null);

  useEffect(() => {
    moodRef.current = mood;
    document.documentElement.dataset.mood = mood;
    onMoodRef.current?.(mood);
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const light = lightRef.current;
    if (!canvas || !light) return;
    const params = new URLSearchParams(window.location.search);
    const r = params.has("nogl") ? null : makeRenderer(canvas);
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const mq = (q: string) => window.matchMedia?.(q).matches ?? false;
    const tier = tierFor({
      cores: nav.hardwareConcurrency,
      memory: nav.deviceMemory,
      saveData: nav.connection?.saveData,
      coarse: mq("(pointer: coarse)"),
      fine: mq("(hover: hover) and (pointer: fine)"),
    });
    if (tier.low) document.documentElement.dataset.tier = "low";
    if (!r) {
      setGl("off");
      return;
    }
    const stats = params.has("bgstats");
    let scale = tier.low ? 0.35 : 0.5;
    let w = window.innerWidth;
    let h = window.innerHeight;
    r.resize(w, h, scale);

    let from: Resolved = RESOLVED[moodRef.current];
    let to: Resolved = from;
    let tweenStart = -1;
    let shown: Resolved = to;
    const t0 = performance.now();
    const elapsed = (now: number) => (reduced ? REST_T : REST_T + (now - t0) / 1000);
    const palette = (now: number) => {
      if (tweenStart < 0) return to;
      const k = (now - tweenStart) / TWEEN_MS;
      if (k >= 1) {
        tweenStart = -1;
        return to;
      }
      return mixPalette(from, to, easeInOut(k));
    };

    let msAvg = 0;
    let frames = 0;
    let fpsT = 0;
    let fps = 0;
    const render = (now: number) => {
      const s = stats ? performance.now() : 0;
      shown = palette(now);
      r.draw(shown, elapsed(now));
      if (!stats) return;
      r.finish();
      const ms = performance.now() - s;
      msAvg = msAvg ? msAvg * 0.95 + ms * 0.05 : ms;
      frames++;
      if (now - fpsT >= 1000) {
        fps = (frames * 1000) / (now - fpsT || 1000);
        frames = 0;
        fpsT = now;
      }
      window.__backdrop = { avgMs: +msAvg.toFixed(3), fps: Math.round(fps), scale, low: tier.low, running: raf !== 0, w: canvas.width, h: canvas.height };
    };

    const spot = { x: -999, y: -999, vx: 0, vy: 0, tx: -999, ty: -999, a: 0, ta: 0 };
    const useLight = tier.light && !reduced;
    const monitor = new FrameMonitor(180);
    let raf = 0;
    let last = 0;
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60;
      if (last && monitor.push(now - last) && scale > 0.35) {
        scale = 0.35;
        r.resize(w, h, scale);
      }
      last = now;
      if (useLight) {
        // Critically damped spring towards the pointer (semi-implicit Euler).
        const k = 120;
        const c = 22;
        const ddt = Math.min(dt, 1 / 30);
        spot.vx += (k * (spot.tx - spot.x) - c * spot.vx) * ddt;
        spot.vy += (k * (spot.ty - spot.y) - c * spot.vy) * ddt;
        spot.x += spot.vx * ddt;
        spot.y += spot.vy * ddt;
        spot.a += (spot.ta - spot.a) * Math.min(1, ddt * 5);
        light.style.transform = `translate3d(${spot.x - 200}px, ${spot.y - 200}px, 0)`;
        light.style.opacity = spot.a.toFixed(3);
      }
      const g = frameGate(acc, dt, 30);
      acc = g.acc;
      if (g.draw) render(now);
    };

    // Reduced motion: one frame, redrawn only for a mood tween or a resize.
    let tweenRaf = 0;
    const tweenOnce = () => {
      cancelAnimationFrame(tweenRaf);
      const step = (now: number) => {
        render(now);
        tweenRaf = tweenStart >= 0 ? requestAnimationFrame(step) : 0;
      };
      tweenRaf = requestAnimationFrame(step);
    };

    onMoodRef.current = (m) => {
      from = shown;
      to = RESOLVED[m];
      tweenStart = performance.now();
      if (reduced) tweenOnce();
    };

    const start = () => {
      if (reduced || raf || document.visibilityState === "hidden") return;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (stats && window.__backdrop) window.__backdrop = { ...window.__backdrop, running: false };
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? stop() : start());
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        w = window.innerWidth;
        h = window.innerHeight;
        r.resize(w, h, scale);
        render(performance.now());
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
    const onLost = (e: Event) => {
      e.preventDefault();
      stop();
      setGl("off");
    };

    render(performance.now());
    setGl("on");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    canvas.addEventListener("webglcontextlost", onLost);
    if (useLight) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    start();
    return () => {
      stop();
      cancelAnimationFrame(tweenRaf);
      clearTimeout(timer);
      onMoodRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      light.style.opacity = "0";
    };
  }, [reduced]);

  return (
    <div aria-hidden="true" className="backdrop" data-mood={mood} data-gl={gl} data-testid="backdrop">
      <div className="backdrop-css backdrop-css-overview" />
      <div className="backdrop-css backdrop-css-lineage" />
      <div className="backdrop-css backdrop-css-limits" />
      <div className="backdrop-css backdrop-css-compare" />
      <canvas ref={canvasRef} className="backdrop-gl" />
      <div ref={lightRef} className="backdrop-light" />
      <div className="backdrop-grain" />
    </div>
  );
}
