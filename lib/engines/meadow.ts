import type { ThemeTokens, Mood } from "@/lib/schema";
import type { BackgroundEngine, EngineParams } from "./types";

/**
 * `meadow` — a twilight valley: layered mountain silhouettes fading into a
 * warm horizon haze, rolling foreground hills, and flowering bushes whose
 * branches and grass sway continuously on a slow, organic wind (not just
 * idle bob — this engine's signature is that the foreground is always
 * gently moving air, per §2.1's ambient layer). 2D canvas — no WebGL spent.
 *
 * Budgets: 3 mountain ridge layers + 1 foreground hill (each a single filled
 * path), ≤160 grass blades, 2 bushes × ≤9 branches × small blossom clusters.
 */

type RidgeLayer = {
  points: number[]; // y offsets (0..1 of height) sampled across width
  tint: string;
  alpha: number;
  driftScale: number; // parallax weight for the burn-in drift
};

type Blade = {
  x: number; // 0..1 of width
  h: number; // px height
  w: number;
  phase: number;
  bend: number; // per-blade wind responsiveness
  tone: number; // 0..1 mix toward accent1 vs surfaceTint
};

type Branch = {
  base: [number, number]; // px, relative to bush anchor
  tip: [number, number];
  mid: [number, number];
  width: number;
  blossoms: { x: number; y: number; size: number; phase: number }[];
};

type Bush = {
  x: number; // 0..1 of width
  y: number; // 0..1 of height (anchor / ground line)
  scale: number;
  branches: Branch[];
  phase: number;
};

type GustPulse = { x: number; age: number; strength: number };

const RIDGE_SAMPLES = 48;
const BLADE_COUNT = 150;
const BUSH_COUNT = 2;
const DRIFT_AMP = 6;
const DRIFT_FREQ = (2 * Math.PI) / 600; // 10-minute burn-in cycle (§5.1)

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

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const bl = ab + (bb - ab) * t;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

// Organic, non-periodic wind: a few slow sines summed rather than one clean
// oscillator, so gusts feel like weather rather than a metronome.
function windAt(t: number, speed: number): number {
  return (
    Math.sin(t * 0.11 * speed) * 0.55 +
    Math.sin(t * 0.037 * speed + 1.7) * 0.3 +
    Math.sin(t * 0.21 * speed + 4.1) * 0.15
  );
}

export class MeadowEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private tier: 1 | 2 | 3 = 3;
  private rng = mulberry32(0x8a3d1);

  private ridges: RidgeLayer[] = [];
  private hillPoints: number[] = [];
  private blades: Blade[] = [];
  private bushes: Bush[] = [];
  private gusts: GustPulse[] = [];

  private startT = 0;
  private lastT = 0;
  private driftPhase = Math.random() * 1000;

  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.tier = (params.tier as 1 | 2 | 3) ?? 3;
    this.startT = 0;
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
  }

  private generate() {
    const canvas = this.canvas;
    if (!canvas) return;
    this.rng = mulberry32(0x8a3d1);
    const rand = this.rng;

    // Three receding ridgelines: farthest is flattest and lightest (haze),
    // nearest is boldest — atmospheric perspective in three steps.
    this.ridges = [0.34, 0.44, 0.55].map((baseline, i) => {
      const jag = 0.05 - i * 0.012;
      const points: number[] = [];
      const f1 = 1.2 + rand() * 0.6;
      const f2 = 2.7 + rand() * 1.1;
      const p1 = rand() * Math.PI * 2;
      const p2 = rand() * Math.PI * 2;
      for (let s = 0; s <= RIDGE_SAMPLES; s++) {
        const x = s / RIDGE_SAMPLES;
        const y =
          baseline +
          Math.sin(x * Math.PI * f1 + p1) * jag +
          Math.sin(x * Math.PI * f2 + p2) * jag * 0.4;
        points.push(y);
      }
      return { points, tint: "", alpha: 0, driftScale: 0.3 + i * 0.25 };
    });

    // Foreground rolling hill — the ground the grass and bushes stand on.
    const hillPoints: number[] = [];
    const hf = 1.6 + rand() * 0.5;
    const hp = rand() * Math.PI * 2;
    for (let s = 0; s <= RIDGE_SAMPLES; s++) {
      const x = s / RIDGE_SAMPLES;
      hillPoints.push(0.72 + Math.sin(x * Math.PI * hf + hp) * 0.045);
    }
    this.hillPoints = hillPoints;

    // Grass field across the foreground band, each blade with its own wind
    // responsiveness so the sway reads as a field, not a single sheet.
    this.blades = Array.from({ length: BLADE_COUNT }, () => ({
      x: rand(),
      h: 14 + rand() * 30,
      w: 1.4 + rand() * 1.6,
      phase: rand() * Math.PI * 2,
      bend: 0.6 + rand() * 0.8,
      tone: rand(),
    }));

    // Two flowering bushes anchored bottom-left and bottom-right, matching
    // the reference composition (bushes framing a valley view).
    const anchors: [number, number][] = [
      [0.1, 0.86],
      [0.87, 0.9],
    ];
    this.bushes = anchors.slice(0, BUSH_COUNT).map(([bx, by], i) => {
      const branchCount = 7 + Math.floor(rand() * 3);
      const scale = (canvas.clientHeight || 1080) * (0.16 + rand() * 0.05);
      const branches: Branch[] = Array.from({ length: branchCount }, (_, bi) => {
        const angle = -Math.PI / 2 + (bi / branchCount - 0.5) * 1.6 + (rand() - 0.5) * 0.3;
        const len = scale * (0.55 + rand() * 0.5);
        const tipX = Math.cos(angle) * len;
        const tipY = Math.sin(angle) * len;
        const midX = tipX * 0.55 + (rand() - 0.5) * len * 0.2;
        const midY = tipY * 0.55;
        const blossomCount = 3 + Math.floor(rand() * 3);
        return {
          base: [0, 0],
          tip: [tipX, tipY],
          mid: [midX, midY],
          width: scale * 0.02,
          blossoms: Array.from({ length: blossomCount }, () => ({
            x: tipX * (0.6 + rand() * 0.4) + (rand() - 0.5) * scale * 0.12,
            y: tipY * (0.6 + rand() * 0.4) + (rand() - 0.5) * scale * 0.12,
            size: scale * (0.045 + rand() * 0.035),
            phase: rand() * Math.PI * 2,
          })),
        };
      });
      return { x: bx, y: by, scale, branches, phase: i * 2.1 };
    });
  }

  tick(t: number) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    if (!ctx || !canvas || !theme) return;
    if (!this.startT) this.startT = t;
    const dt = this.lastT ? Math.max(0, t - this.lastT) : 0;
    this.lastT = t;

    const W = canvas.width;
    const H = canvas.height;
    const speed = theme.motion.speed || 1;

    this.gusts.forEach((g) => (g.age += dt));
    this.gusts = this.gusts.filter((g) => g.age < 2.2);

    // ±6px drift over 10 minutes — OLED burn-in guard (§5.1), scaled per
    // layer so distant ridges parallax less than the foreground.
    const cycle = (t / 600) * Math.PI * 2 + this.driftPhase;
    const driftX = Math.sin(cycle) * DRIFT_AMP;
    const driftY = Math.cos(cycle * 0.7) * DRIFT_AMP;

    this.drawSky(ctx, W, H, theme);
    this.drawRidges(ctx, W, H, theme, driftX, driftY);
    this.drawHill(ctx, W, H, theme, driftX, driftY);
    this.drawGrass(ctx, W, H, theme, t, speed);
    this.drawBushes(ctx, W, H, theme, t, speed);
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

  private drawSky(ctx: CanvasRenderingContext2D, W: number, H: number, theme: ThemeTokens) {
    const p = theme.palette;
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.78);
    sky.addColorStop(0, p.bg0);
    sky.addColorStop(0.45, mixHex(p.bg0, p.bg1, 0.6));
    sky.addColorStop(0.72, mixHex(p.bg1, p.accent2, 0.55));
    sky.addColorStop(1, mixHex(p.accent2, p.accent1, 0.6));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // low horizon haze band — the warm light the reference photo sits on
    const haze = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.78);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(1, hexToRgba(p.accent1, 0.22));
    ctx.fillStyle = haze;
    ctx.fillRect(0, H * 0.5, W, H * 0.28);
  }

  private ridgePath(
    ctx: CanvasRenderingContext2D,
    points: number[],
    W: number,
    H: number,
    ox: number
  ) {
    ctx.beginPath();
    ctx.moveTo(-2 + ox, H + 2);
    for (let i = 0; i < points.length; i++) {
      ctx.lineTo((i / RIDGE_SAMPLES) * W + ox, points[i] * H);
    }
    ctx.lineTo(W + 2 + ox, H + 2);
    ctx.closePath();
  }

  private drawRidges(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    theme: ThemeTokens,
    driftX: number,
    driftY: number
  ) {
    const p = theme.palette;
    this.ridges.forEach((ridge, i) => {
      // farthest (i=0) reads as pale haze, nearest (i=2) as the boldest silhouette
      const t = i / (this.ridges.length - 1);
      const color = mixHex(mixHex(p.accent2, p.accent1, 0.35), p.bg1, t * 0.7);
      const alpha = 0.32 + t * 0.35;
      ctx.fillStyle = hexToRgba(color, alpha);
      this.ridgePath(ctx, ridge.points, W, H, driftX * ridge.driftScale);
      ctx.fill();
    });
  }

  private drawHill(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    theme: ThemeTokens,
    driftX: number,
    driftY: number
  ) {
    const p = theme.palette;
    const color = mixHex(p.surfaceTint, p.bg1, 0.55);
    ctx.fillStyle = hexToRgba(color, 0.9);
    this.ridgePath(ctx, this.hillPoints, W, H, driftX * 0.9);
    ctx.fill();
    void driftY;
  }

  private drawGrass(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    theme: ThemeTokens,
    t: number,
    speed: number
  ) {
    const p = theme.palette;
    const wind = windAt(t, speed);
    const baseY = H * 0.72;

    ctx.lineCap = "round";
    for (const b of this.blades) {
      const x = b.x * W;
      const y = baseY + (b.x - 0.5) * H * 0.08 + H * 0.02; // sits on the hill's curve, roughly
      let gust = 0;
      for (const g of this.gusts) {
        const d = Math.abs(x - g.x);
        const reach = W * 0.4;
        if (d < reach) {
          const travel = g.age * W * 0.5; // gust travels outward from origin
          const wave = Math.exp(-Math.pow((d - travel) / (W * 0.08), 2));
          gust += wave * g.strength * Math.exp(-g.age * 1.2);
        }
      }
      const sway = (wind * 0.5 + Math.sin(t * 0.9 * speed + b.phase) * 0.5) * b.bend * 0.35 + gust * 0.8;
      const tipX = x + sway * b.h;
      const tipY = y - b.h;
      const color = mixHex(p.accent1, p.surfaceTint, b.tone);
      ctx.strokeStyle = hexToRgba(color, 0.55 + b.tone * 0.15);
      ctx.lineWidth = b.w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + sway * b.h * 0.5, y - b.h * 0.5, tipX, tipY);
      ctx.stroke();
    }
  }

  private drawBushes(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    theme: ThemeTokens,
    t: number,
    speed: number
  ) {
    const p = theme.palette;
    const wind = windAt(t, speed);

    for (const bush of this.bushes) {
      const ax = bush.x * W;
      const ay = bush.y * H;
      const sway =
        (wind * 0.6 + Math.sin(t * 0.5 * speed + bush.phase) * 0.4) * 0.09; // slow rotational sway (radians)

      let gust = 0;
      for (const g of this.gusts) {
        const d = Math.abs(ax - g.x);
        if (d < W * 0.5) gust += Math.exp(-d / (W * 0.25)) * g.strength * Math.exp(-g.age * 1.0);
      }

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(sway + gust * 0.25);
      ctx.lineCap = "round";

      for (const branch of bush.branches) {
        const branchSway = Math.sin(t * 1.1 * speed + branch.tip[0] * 0.02) * 0.06 + gust * 0.15;
        ctx.strokeStyle = hexToRgba(mixHex(p.bg1, p.surfaceTint, 0.5), 0.85);
        ctx.lineWidth = branch.width;
        ctx.beginPath();
        ctx.moveTo(branch.base[0], branch.base[1]);
        ctx.quadraticCurveTo(
          branch.mid[0] + branchSway * 20,
          branch.mid[1],
          branch.tip[0] + branchSway * 30,
          branch.tip[1]
        );
        ctx.stroke();

        for (const bloom of branch.blossoms) {
          const bx = bloom.x + branchSway * 30;
          const by = bloom.y;
          const twinkle = 0.75 + 0.25 * Math.sin(t * 1.4 + bloom.phase);
          const halo = ctx.createRadialGradient(bx, by, 0, bx, by, bloom.size * 2.4);
          halo.addColorStop(0, hexToRgba(p.accent1, 0.3 * twinkle));
          halo.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(bx, by, bloom.size * 2.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = hexToRgba(p.accent1, 0.8 * twinkle);
          ctx.beginPath();
          ctx.arc(bx, by, bloom.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  private drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const count = this.tier <= 2 ? 500 : 900;
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < count; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,1)" : "rgba(0,0,0,1)";
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  pulse(originNdc: [number, number], strength: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    const x = ((originNdc[0] + 1) / 2) * canvas.width;
    this.gusts.push({ x, age: 0, strength: Math.min(1, strength) });
  }

  setVignette(v: number, color: string) {
    this.vignette = v;
    this.vignetteColor = color;
  }

  dim(v: number) {
    this.dimAmount = v;
  }

  setMood(_mood: Mood) {
    // moods are orchestrated by the scene layer (dim/vignette); the meadow
    // stays a dumb renderer of whatever it's told, same as aurora/growth.
  }

  setParams(_p: EngineParams) {
    // no tunable params yet beyond theme colors
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.generate();
  }

  dispose() {
    this.ctx = null;
    this.canvas = undefined;
    this.blades = [];
    this.bushes = [];
    this.ridges = [];
  }
}
