import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";
import { growthBus, type GrowthHourEvent } from "./growthBus";

/**
 * `growth` (§5.6) — the Kanso cherry branch, the project's one authorized
 * bespoke splurge. A hand-authored base skeleton plus recursive procedural
 * twigs, drawn as stroked béziers with round caps (brush feel), that lives on
 * the display's local time: dawn growth spurt, day full bloom, dusk heavy
 * fall, night bare branch under a moon. 2D canvas — no WebGL context spent.
 *
 * Composition over merger: the branch owns the canvas and drives its own petal
 * layer seeded from bud emitter points (§5.4 petals), rather than remounting a
 * ParticlesEngine that would clear the branch each frame.
 *
 * Budgets: ≤400 path segments, ≤120 petals. Falls back to petals-only (the
 * current shipping state) via a one-case change in Background.tsx.
 */

type Segment = {
  pts: [number, number][]; // 4 cubic bézier control points, css px
  width: number;
  order: number; // draw-on reveal order (0 = trunk first)
  depth: number;
  bud: boolean; // terminal node → blossom / petal emitter
};

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  rot: number;
  rotSpeed: number;
  life: number;
  night: boolean; // motes at night, petals by day
};

const MAX_SEGMENTS = 380;
const MAX_PETALS = 120;
const REVEAL_SAMPLES = 16;
const DRAW_ON_SEC = 4;
const DRIFT_AMP = 6; // ±6px burn-in guard (§5.1)
const DRIFT_FREQ = (2 * Math.PI) / 600; // 10-minute cycle

type Phase = "dawn" | "day" | "dusk" | "night";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function phaseForHour(h: number): Phase {
  if (h >= 5 && h < 9) return "dawn";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

// Target blossom density (0..1) per phase — dawn ramps buds in, night is bare.
function bloomTarget(phase: Phase, h: number): number {
  if (phase === "dawn") return Math.min(1, (h - 5) / 4);
  if (phase === "day") return 1;
  if (phase === "dusk") return 0.7;
  return 0;
}

// Petals spawned per second per active bud, by phase.
function fallRate(phase: Phase): number {
  if (phase === "dusk") return 0.5;
  if (phase === "day") return 0.06;
  if (phase === "dawn") return 0.03;
  return 0; // night: motes handled separately
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function cubicPoint(p: [number, number][], t: number): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
    a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
  ];
}

export class GrowthEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private tier: 1 | 2 | 3 = 3;

  private segments: Segment[] = [];
  private buds: [number, number][] = [];
  private maxOrder = 1;
  private rng = mulberry32(0x5eed);

  private petals: Petal[] = [];
  private spawnAccum = 0;

  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;

  private startT = 0;
  private lastT = 0;
  private bloom = 0;
  private shiver = 0; // decaying rotational energy from t3 (§5.6)
  private hourOverride: number | null = null;

  private onHour = (e: Event) => {
    this.hourOverride = (e as CustomEvent<GrowthHourEvent>).detail.hour;
  };

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.tier = (params.tier as 1 | 2 | 3) ?? 3;
    if (typeof params.hour === "number") this.hourOverride = params.hour;
    this.startT = 0;
    this.resize();
    growthBus.addEventListener("growth-hour", this.onHour);
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
  }

  private currentHour(): number {
    return this.hourOverride ?? new Date().getHours();
  }

  // Recursive skeleton: a hand-anchored trunk sweeping up-right from the
  // lower-left, then procedural twigs (depth 3, 20–35° jitter, 0.62 decay).
  private generate() {
    const canvas = this.canvas;
    if (!canvas) return;
    const W = canvas.clientWidth || 1920;
    const H = canvas.clientHeight || 1080;
    this.rng = mulberry32(0x5eed);
    this.segments = [];
    this.buds = [];
    let order = 0;

    const rand = this.rng;
    const UP = -Math.PI / 2;

    const grow = (
      x: number,
      y: number,
      angle: number,
      len: number,
      width: number,
      depth: number
    ) => {
      if (this.segments.length >= MAX_SEGMENTS) return;
      const curve = (rand() - 0.5) * 0.4;
      const ex = x + Math.cos(angle) * len;
      const ey = y + Math.sin(angle) * len;
      const c1x = x + Math.cos(angle + curve) * len * 0.34;
      const c1y = y + Math.sin(angle + curve) * len * 0.34;
      const c2x = x + Math.cos(angle - curve * 0.5) * len * 0.68;
      const c2y = y + Math.sin(angle - curve * 0.5) * len * 0.68;
      const terminal = depth === 0;
      this.segments.push({
        pts: [
          [x, y],
          [c1x, c1y],
          [c2x, c2y],
          [ex, ey],
        ],
        width,
        order: order++,
        depth,
        bud: terminal,
      });
      if (terminal) {
        this.buds.push([ex, ey]);
        return;
      }
      const children = depth >= 3 ? 2 : rand() < 0.72 ? 2 : 1;
      for (let i = 0; i < children; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        const jitter = ((20 + rand() * 15) * Math.PI) / 180 * dir;
        grow(ex, ey, angle + jitter + (rand() - 0.5) * 0.12, len * 0.62, width * 0.72, depth - 1);
      }
    };

    // Trunk: two hand-authored boughs from the lower-left corner (taste-safe).
    const baseX = W * 0.12;
    const baseY = H * 1.04;
    const trunkLen = H * 0.4;
    grow(baseX, baseY, UP + 0.36, trunkLen, Math.max(3, H * 0.006), 4);
    grow(baseX + W * 0.02, baseY, UP + 0.52, trunkLen * 0.82, Math.max(2.4, H * 0.0048), 4);
    grow(baseX - W * 0.01, baseY, UP + 0.18, trunkLen * 0.7, Math.max(2, H * 0.004), 3);

    this.maxOrder = Math.max(1, order);
  }

  tick(t: number) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    if (!ctx || !canvas || !theme) return;
    if (!this.startT) this.startT = t;
    const local = t - this.startT;
    const dt = this.lastT ? Math.max(0, t - this.lastT) : 0;
    this.lastT = t;

    const W = canvas.width;
    const H = canvas.height;
    const hour = this.currentHour();
    const phase = phaseForHour(hour);

    // background wash — never pure black (§2.3 rule 1)
    ctx.fillStyle = theme.palette.bg0;
    ctx.fillRect(0, 0, W, H);
    const glowY = phase === "night" ? 0.2 : 0.75;
    const wash = ctx.createRadialGradient(W * 0.35, H * glowY, 0, W * 0.35, H * 0.5, W * 0.8);
    const washColor = phase === "night" ? theme.palette.accent2 : theme.palette.surfaceTint;
    wash.addColorStop(0, hexToRgba(washColor, phase === "night" ? 0.05 : 0.04));
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    // moon disc at night, behind the branch (§5.6)
    if (phase === "night") this.drawMoon(ctx, W, H, theme);

    // burn-in drift + t3 shiver rotate the whole branch from the trunk origin
    const driftX = Math.sin(local * DRIFT_FREQ) * DRIFT_AMP;
    const driftY = Math.cos(local * DRIFT_FREQ * 0.8) * DRIFT_AMP;
    this.shiver *= Math.exp(-dt * 1.6);
    const sway = Math.sin(local * 7) * this.shiver * 0.05;

    const bloomTgt = bloomTarget(phase, hour);
    this.bloom += (bloomTgt - this.bloom) * Math.min(1, dt * 0.6);

    const reveal = Math.min(1, local / DRAW_ON_SEC);

    ctx.save();
    ctx.translate(driftX, driftY);
    if (sway !== 0) {
      ctx.translate(W * 0.12, H * 1.04);
      ctx.rotate(sway);
      ctx.translate(-W * 0.12, -H * 1.04);
    }
    this.drawBranch(ctx, theme, reveal);
    this.drawBlossoms(ctx, theme, reveal, phase);
    ctx.restore();

    // petal / mote layer
    this.updatePetals(ctx, theme, dt, phase, local);

    this.drawGrain(ctx, W, H);

    if (this.dimAmount < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - this.dimAmount})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.vignette > 0) {
      const r = Math.max(W, H) * 0.75;
      const rg = ctx.createRadialGradient(W / 2, H / 2, r * 0.5, W / 2, H / 2, r);
      rg.addColorStop(0, "rgba(0,0,0,0)");
      rg.addColorStop(1, hexToRgba(this.vignetteColor, this.vignette * 0.6));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawMoon(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeTokens) {
    const mx = W * 0.78;
    const my = H * 0.24;
    const r = Math.min(W, H) * 0.09;
    const halo = ctx.createRadialGradient(mx, my, 0, mx, my, r * 2.4);
    halo.addColorStop(0, hexToRgba(theme.palette.text1, 0.12));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(mx, my, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hexToRgba(theme.palette.text1, 0.22);
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBranch(ctx: CanvasRenderingContext2D, theme: ThemeTokens, reveal: number) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // washi tone — a warm moonlit ink that reads on the dark paper (§3.2 Kanso)
    const strokeBase = theme.palette.surfaceTint;

    for (const seg of this.segments) {
      const segStart = seg.order / this.maxOrder;
      const segEnd = (seg.order + 1) / this.maxOrder;
      if (reveal <= segStart) continue;
      const frac = reveal >= segEnd ? 1 : (reveal - segStart) / (segEnd - segStart);

      // trunk reads as the boldest ink; twigs fade toward the paper
      const alpha = 0.72 - seg.depth * 0.1;
      ctx.strokeStyle = hexToRgba(strokeBase, Math.max(0.2, alpha));
      ctx.lineWidth = seg.width;
      ctx.beginPath();
      const steps = Math.max(2, Math.round(REVEAL_SAMPLES * frac));
      for (let i = 0; i <= steps; i++) {
        const p = cubicPoint(seg.pts, (i / REVEAL_SAMPLES) * (frac === 1 ? 1 : frac));
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
  }

  private drawBlossoms(
    ctx: CanvasRenderingContext2D,
    theme: ThemeTokens,
    reveal: number,
    phase: Phase
  ) {
    if (this.bloom <= 0.01 || phase === "night") return;
    const sakura = theme.palette.accent1;
    for (let i = 0; i < this.buds.length; i++) {
      const [bx, by] = this.buds[i];
      const budReveal = (i / this.buds.length) * 0.4 + 0.6;
      if (reveal < budReveal) continue;
      const size = (3.6 + (i % 3)) * this.bloom;
      const petalsPerBud = phase === "dawn" ? 3 : 5;
      // soft halo so the cluster glows like a blossom (§2.3 layered depth)
      const halo = ctx.createRadialGradient(bx, by, 0, bx, by, size * 3);
      halo.addColorStop(0, hexToRgba(sakura, 0.28 * this.bloom));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(bx, by, size * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.72 * this.bloom;
      for (let p = 0; p < petalsPerBud; p++) {
        const a = (p / petalsPerBud) * Math.PI * 2 + i;
        ctx.fillStyle = sakura;
        ctx.beginPath();
        ctx.ellipse(
          bx + Math.cos(a) * size,
          by + Math.sin(a) * size,
          size * 0.95,
          size * 0.55,
          a,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      // pale blossom centers
      ctx.globalAlpha = 0.5 * this.bloom;
      ctx.fillStyle = theme.palette.text1;
      for (let p = 0; p < petalsPerBud; p++) {
        const a = (p / petalsPerBud) * Math.PI * 2 + i;
        ctx.beginPath();
        ctx.arc(bx + Math.cos(a) * size * 0.3, by + Math.sin(a) * size * 0.3, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private spawnPetal(night: boolean): Petal {
    const canvas = this.canvas;
    const W = canvas?.clientWidth ?? 1920;
    const H = canvas?.clientHeight ?? 1080;
    if (night) {
      return {
        x: Math.random() * W,
        y: H + 10,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -(Math.random() * 0.12 + 0.04),
        size: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
        rot: 0,
        rotSpeed: 0,
        life: 1,
        night: true,
      };
    }
    // day/dusk: emit from a bud point (§5.4 emitter seeding)
    const bud = this.buds.length
      ? this.buds[Math.floor(Math.random() * this.buds.length)]
      : [W * 0.4, H * 0.3];
    return {
      x: bud[0] + (Math.random() - 0.5) * 12,
      y: bud[1] + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 0.3,
      vy: Math.random() * 0.35 + 0.25,
      size: Math.random() * 4 + 3,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      life: 1,
      night: false,
    };
  }

  private updatePetals(
    ctx: CanvasRenderingContext2D,
    theme: ThemeTokens,
    dt: number,
    phase: Phase,
    t: number
  ) {
    const canvas = this.canvas;
    if (!canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / canvas.clientWidth;
    const scaleY = H / canvas.clientHeight;
    const tierScale = this.tier <= 2 ? 0.5 : 1;

    // spawn
    if (phase === "night") {
      const cap = Math.round(40 * tierScale);
      if (this.petals.length < cap && Math.random() < dt * 6) {
        this.petals.push(this.spawnPetal(true));
      }
    } else {
      const rate = fallRate(phase) * this.buds.length * tierScale;
      this.spawnAccum += rate * dt;
      while (this.spawnAccum >= 1 && this.petals.length < MAX_PETALS) {
        this.petals.push(this.spawnPetal(false));
        this.spawnAccum -= 1;
      }
    }

    const petalColor = theme.palette.accent1;
    const moteColor = theme.palette.accent2;

    this.petals = this.petals.filter((p) => {
      const flutter = p.night ? 0 : Math.sin(t * 1.8 + p.phase) * 0.5;
      p.x += (p.vx + flutter) * scaleX;
      p.y += p.vy * scaleY;
      p.rot += p.rotSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.night) {
        ctx.globalAlpha = 0.32 * (0.5 + 0.5 * Math.sin(t * 1.2 + p.phase));
        ctx.fillStyle = moteColor;
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = petalColor;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;

      if (p.night) return p.y > -20 * scaleY;
      return p.y < H + 30 * scaleY;
    });
  }

  private drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
    // sparse compositing grain (§2.3 rule 9) — kills banding without wiping
    const count = this.tier <= 2 ? 500 : 900;
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < count; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      const g = Math.random() - 0.5;
      ctx.fillStyle = g > 0 ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  pulse(originNdc: [number, number], strength: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    // t3 (strength ≥ 0.8) → branch shiver; any pulse → petal burst (§5.6)
    if (strength >= 0.8) this.shiver = Math.min(1, this.shiver + strength);

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const ox = ((originNdc[0] + 1) / 2) * W;
    const oy = ((1 - originNdc[1]) / 2) * H;
    // burst from the buds nearest the origin
    const near = [...this.buds]
      .sort((a, b) => Math.hypot(a[0] - ox, a[1] - oy) - Math.hypot(b[0] - ox, b[1] - oy))
      .slice(0, 6);
    const burst = Math.round(10 * strength);
    for (let i = 0; i < burst && this.petals.length < MAX_PETALS; i++) {
      const bud = near[i % Math.max(1, near.length)] ?? [ox, oy];
      this.petals.push({
        x: bud[0],
        y: bud[1],
        vx: (Math.random() - 0.5) * 1.2,
        vy: Math.random() * 0.4 + 0.1,
        size: Math.random() * 4 + 3,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.04,
        life: 1,
        night: false,
      });
    }
  }

  setVignette(v: number, color: string) {
    this.vignette = v;
    this.vignetteColor = color;
  }

  dim(v: number) {
    this.dimAmount = v;
  }

  setMood(_mood: Mood) {}

  setParams(p: EngineParams) {
    if (typeof p.hour === "number") this.hourOverride = p.hour;
    if (typeof p.tier === "number") this.tier = p.tier as 1 | 2 | 3;
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.generate();
  }

  dispose() {
    growthBus.removeEventListener("growth-hour", this.onHour);
    this.ctx = null;
    this.canvas = undefined;
    this.petals = [];
    this.segments = [];
  }
}
