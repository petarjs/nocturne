import type { ThemeTokens, Mood } from "@/lib/schema";
import type { BackgroundEngine, EngineParams } from "./types";

/**
 * `meadow` — a painterly twilight valley. Composition (back to front): gradient
 * dusk sky → five mountain ridgelines, each dissolving into horizon haze →
 * breathing horizon glow and valley mist → rolling mid hills dotted with
 * blossom clumps → two foreground grass hills with backlit crest rims →
 * flowering bushes whose stems and blossom clusters sway on a coherent wind
 * field → drifting petals and light motes.
 *
 * Fidelity strategy: everything static is baked once into offscreen layers
 * (sky+ridges in `far`, hills+deep grass in `near`) at device-pixel-ratio
 * resolution, so the per-frame cost is two drawImage calls plus the animated
 * foreground (~600 tapered blade fills, ~120 sprite stamps). Wind is a slow
 * spatial wave plus traveling gust packets — pulse() injects a gust that
 * visibly sweeps through the grass and shakes petals out of the bushes.
 *
 * 2D canvas — no WebGL context spent. Budgets: ≤700 dynamic blades (tier 3),
 * ≤70 petals, 2 full-size baked layers.
 */

type Gust = { x: number; born: number; strength: number; speed: number; width: number };

type Blade = {
  x: number;
  y: number;
  h: number;
  w: number;
  phase: number;
  flutterHz: number;
  bend: number;
  windScale: number;
};

type BladeBucket = { fill: string; blades: Blade[] };

type Stamp = { x: number; y: number; size: number; sprite: number; jPhase: number };

type Stem = {
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  width: number;
  phase: number;
};

type Bush = {
  x: number; // css px anchor (world, pre-drift)
  y: number;
  scale: number;
  phase: number;
  rotAmp: number; // 0 for the cropped bokeh bush (translate sway instead)
  stems: Stem[];
  stamps: Stamp[];
  bokeh: boolean;
};

type Petal = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  age: number;
  life: number;
};

type Mote = { x: number; y: number; v: number; phase: number; size: number };
type Star = { x: number; y: number; size: number; phase: number; alpha: number };

const RIDGE_COUNT = 5;
const SAMPLES = 256;
const PAD = 16; // layer overdraw for the burn-in drift
const MAX_PETALS = 70;
const MOTE_COUNT = 14;
const STAR_COUNT = 70;
const DRIFT_AMP = 6; // ±6px over a 10-minute cycle (§5.1)

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
  return [
    parseInt(c.substring(0, 2), 16),
    parseInt(c.substring(2, 4), 16),
    parseInt(c.substring(4, 6), 16),
  ];
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
  return `#${toHex2(ar + (br - ar) * t)}${toHex2(ag + (bg - ag) * t)}${toHex2(ab + (bb - ab) * t)}`;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** 1D value noise with cubic smoothing, deterministic per seed. */
function makeNoise(rng: () => number): (x: number) => number {
  const period = 256;
  const vals = Array.from({ length: period }, () => rng());
  const at = (i: number) => vals[((i % period) + period) % period];
  return (x: number) => {
    const xi = Math.floor(x);
    const f = x - xi;
    const u = f * f * (3 - 2 * f);
    return at(xi) + (at(xi + 1) - at(xi)) * u;
  };
}

function fbm(n: (x: number) => number, x: number): number {
  return n(x) * 0.55 + n(x * 2.13 + 41) * 0.3 + n(x * 4.31 + 97) * 0.15;
}

/** All meadow colors derive from theme tokens so any palette can drive it. */
function derivePalette(theme: ThemeTokens) {
  const p = theme.palette;
  const lift = (c: string, t: number) => mixHex(c, p.text1, t); // toward warm light
  const sink = (c: string, t: number) => mixHex(c, p.bg0, t); // into the dusk

  const horizon = lift(mixHex(p.accent1, p.accent2, 0.15), 0.42); // warm afterglow
  const ridges: { body: string; haze: string }[] = [];
  for (let i = 0; i < RIDGE_COUNT; i++) {
    const t = i / (RIDGE_COUNT - 1); // 0 = farthest
    const body = mixHex(lift(p.accent2, 0.35), sink(p.accent2, 0.52), t);
    ridges.push({ body, haze: mixHex(body, horizon, 0.62 - t * 0.34) });
  }

  return {
    skyTop: p.bg0,
    skyMid: mixHex(p.bg0, p.accent2, 0.45),
    skyLow: lift(mixHex(p.accent2, p.accent1, 0.5), 0.24),
    horizon,
    glow: lift(p.accent1, 0.55),
    star: p.text1,
    ridges,
    mist: lift(p.accent2, 0.45),
    hillTopMid: mixHex(mixHex(p.accent2, p.surfaceTint, 0.5), horizon, 0.3),
    hillLowMid: sink(p.accent2, 0.42),
    hillTop: mixHex(p.accent2, p.surfaceTint, 0.55),
    hillLow: sink(p.accent2, 0.62),
    rim: lift(p.surfaceTint, 0.4),
    grassLit: lift(p.surfaceTint, 0.22),
    grassMid: mixHex(p.surfaceTint, p.accent2, 0.55),
    grassDark: sink(p.accent2, 0.4),
    grassDeep: sink(p.accent2, 0.66),
    grassTip: lift(p.accent1, 0.3),
    stem: sink(p.accent1, 0.68),
    blossomDeep: sink(p.accent1, 0.3),
    blossomMid: p.accent1,
    blossomLight: lift(p.accent1, 0.32),
    blossomHi: lift(p.accent1, 0.62),
    mote: lift(p.accent1, 0.5),
  };
}

type Palette = ReturnType<typeof derivePalette>;

function paletteKey(theme: ThemeTokens): string {
  const p = theme.palette;
  return [p.bg0, p.bg1, p.surfaceTint, p.text1, p.accent1, p.accent2].join("|");
}

export class MeadowEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private tier: 1 | 2 | 3 = 3;
  private dpr = 1;

  private pal?: Palette;
  private far?: HTMLCanvasElement;
  private near?: HTMLCanvasElement;
  private sprites: HTMLCanvasElement[] = [];
  private bokehSprites: HTMLCanvasElement[] = [];
  private grain?: CanvasPattern;

  private contourL: number[] = [];
  private contourR: number[] = [];
  private contourM: number[] = [];

  private buckets: BladeBucket[] = [];
  private bushes: Bush[] = [];
  private stars: Star[] = [];
  private motes: Mote[] = [];
  private petals: Petal[] = [];
  private gusts: Gust[] = [];
  private nextGustAt = 4;
  private petalAccum = 0;

  private builtKey = "";
  private lastBuildT = -1;
  private driftPhase = Math.random() * 1000;
  private startT = 0;
  private lastT = 0;

  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.tier = (params.tier as 1 | 2 | 3) ?? 3;
    this.startT = 0;
    this.lastT = 0;
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
    // Rebuild is throttled in tick() — theme morphs stream interpolated tokens
    // every frame and re-baking layers 60×/s would jank the transition.
  }

  private cssW(): number {
    return this.canvas?.clientWidth || 0;
  }
  private cssH(): number {
    return this.canvas?.clientHeight || 0;
  }

  private sample(contour: number[], xFrac: number): number {
    const f = Math.max(0, Math.min(1, xFrac)) * (SAMPLES - 1);
    const i = Math.floor(f);
    const u = f - i;
    return contour[i] + (contour[Math.min(SAMPLES - 1, i + 1)] - contour[i]) * u;
  }

  // ---------------------------------------------------------------- rebuild

  private rebuildAll() {
    const theme = this.theme;
    if (!theme || !this.cssW() || !this.cssH()) return;
    this.pal = derivePalette(theme);
    this.builtKey = paletteKey(theme);

    const rng = mulberry32(0x8a3d1);
    this.buildContours(rng);
    this.buildSprites(rng);
    this.bakeFar(rng);
    this.bakeNear(rng);
    this.plantGrass(rng);
    this.buildBushes(rng);
    this.buildStars(rng);
    this.buildMotes(rng);
    this.buildGrain(rng);
  }

  private buildContours(rng: () => number) {
    const n1 = makeNoise(rng);
    const n2 = makeNoise(rng);
    const n3 = makeNoise(rng);
    this.contourL = [];
    this.contourR = [];
    this.contourM = [];
    for (let i = 0; i < SAMPLES; i++) {
      const x = i / (SAMPLES - 1);
      // left hill crests high at the left edge and falls into the valley
      this.contourL.push(0.58 + 0.34 * smoothstep(0, 0.6, x) + (fbm(n1, x * 5) - 0.5) * 0.05);
      // right hill rises again toward the right edge (nearer, bush-topped)
      this.contourR.push(0.96 - 0.3 * smoothstep(0.42, 1, x) + (fbm(n2, x * 6 + 9) - 0.5) * 0.04);
      // mid rolling foothills across the whole valley
      this.contourM.push(0.68 + (fbm(n3, x * 3.4 + 23) - 0.5) * 0.09);
    }
  }

  /** Blossom cluster sprites: dozens of gaussian-scattered dots, lit from the
   * sky side. Sharp variants for the bushes, blurred for the near-lens bush. */
  private buildSprites(rng: () => number) {
    const pal = this.pal!;
    const build = (blur: number): HTMLCanvasElement => {
      const S = 96;
      const c = document.createElement("canvas");
      c.width = S * this.dpr;
      c.height = S * this.dpr;
      const g = c.getContext("2d")!;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (blur > 0) g.filter = `blur(${blur}px)`;
      const tones = [pal.blossomDeep, pal.blossomMid, pal.blossomLight, pal.blossomHi];
      for (let i = 0; i < 110; i++) {
        // gaussian-ish scatter via averaged uniforms
        const gx = ((rng() + rng() + rng()) / 3) * S;
        const gy = ((rng() + rng() + rng()) / 3) * S;
        const r = 2.6 + rng() * 5.4;
        // light comes from the upper sky — bias tone by height in the cluster
        const litBias = 1 - gy / S;
        const idx = Math.min(3, Math.floor((rng() * 0.55 + litBias * 0.45) * 4));
        g.fillStyle = hexToRgba(tones[idx], 0.9);
        g.beginPath();
        g.arc(gx, gy, r, 0, Math.PI * 2);
        g.fill();
      }
      g.filter = "none";
      for (let i = 0; i < 8; i++) {
        g.fillStyle = hexToRgba(pal.blossomHi, 0.85);
        g.beginPath();
        g.arc(20 + rng() * 56, 14 + rng() * 34, 1.2 + rng() * 1.4, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };
    this.sprites = [build(0), build(0), build(0), build(0)];
    this.bokehSprites = [build(4), build(6)];
  }

  private makeLayer(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
    const c = document.createElement("canvas");
    c.width = (this.cssW() + PAD * 2) * this.dpr;
    c.height = (this.cssH() + PAD * 2) * this.dpr;
    const g = c.getContext("2d")!;
    g.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * PAD, this.dpr * PAD);
    return { c, g };
  }

  /** Sky gradient + five ridgelines, each dissolving into horizon haze. */
  private bakeFar(rng: () => number) {
    const pal = this.pal!;
    const W = this.cssW();
    const H = this.cssH();
    const { c, g } = this.makeLayer();

    const sky = g.createLinearGradient(0, -PAD, 0, H * 0.72);
    sky.addColorStop(0, pal.skyTop);
    sky.addColorStop(0.44, pal.skyMid);
    sky.addColorStop(0.7, pal.skyLow);
    sky.addColorStop(0.92, pal.horizon);
    g.fillStyle = sky;
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);

    // baked wide afterglow where the sun went down (slightly right of center)
    const glow = g.createRadialGradient(W * 0.62, H * 0.56, 0, W * 0.62, H * 0.56, W * 0.5);
    glow.addColorStop(0, hexToRgba(pal.glow, 0.22));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);

    for (let k = 0; k < RIDGE_COUNT; k++) {
      const t = k / (RIDGE_COUNT - 1);
      const base = 0.42 + t * 0.175; // baselines march toward the valley floor
      const amp = 0.016 + t * 0.02;
      const freq = 7.5 - t * 3.2; // far chains are busier, near ones broader
      const noise = makeNoise(rng);
      const minY = (base - amp) * H;

      const grad = g.createLinearGradient(0, minY, 0, minY + H * 0.17);
      grad.addColorStop(0, pal.ridges[k].body);
      grad.addColorStop(1, pal.ridges[k].haze);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-PAD, H + PAD);
      for (let i = 0; i < SAMPLES; i++) {
        const x = i / (SAMPLES - 1);
        const y = base + (fbm(noise, x * freq) - 0.5) * 2 * amp;
        g.lineTo(-PAD + x * (W + PAD * 2), y * H);
      }
      g.lineTo(W + PAD, H + PAD);
      g.closePath();
      g.fill();
    }

    this.far = c;
  }

  /** Mid hills with blossom clumps, foreground hill bodies with gradient
   * light, crest rim highlights, and a dense baked under-grass field. */
  private bakeNear(rng: () => number) {
    const pal = this.pal!;
    const W = this.cssW();
    const H = this.cssH();
    const { c, g } = this.makeLayer();

    const fillHill = (contour: number[], top: string, low: string, span: number) => {
      const minY = Math.min(...contour) * H;
      const grad = g.createLinearGradient(0, minY, 0, minY + H * span);
      grad.addColorStop(0, top);
      grad.addColorStop(1, low);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(-PAD, H + PAD);
      for (let i = 0; i < SAMPLES; i++) {
        g.lineTo(-PAD + (i / (SAMPLES - 1)) * (W + PAD * 2), contour[i] * H);
      }
      g.lineTo(W + PAD, H + PAD);
      g.closePath();
      g.fill();
    };

    const rimStroke = (contour: number[], alpha: number) => {
      g.strokeStyle = hexToRgba(pal.rim, alpha);
      g.lineWidth = 1.6;
      g.beginPath();
      for (let i = 0; i < SAMPLES; i++) {
        const x = -PAD + (i / (SAMPLES - 1)) * (W + PAD * 2);
        const y = contour[i] * H - 0.8;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    };

    fillHill(this.contourM, pal.hillTopMid, pal.hillLowMid, 0.4);
    rimStroke(this.contourM, 0.28);

    // blossom clumps dotting the mid hills, like the reference's far bushes
    for (let i = 0; i < 8; i++) {
      const xf = 0.08 + rng() * 0.84;
      const size = H * (0.026 + rng() * 0.03);
      const y = this.sample(this.contourM, xf) * H + size * 0.15;
      const sprite = this.sprites[Math.floor(rng() * this.sprites.length)];
      g.globalAlpha = 0.85;
      g.drawImage(sprite, xf * W - size / 2, y - size / 2, size, size);
      g.globalAlpha = 1;
    }

    const bakeUnderGrass = (contour: number[], xFrom: number, xTo: number, windward: number) => {
      // deep static rows — the dark body of the field under the animated rim
      const rows = [5, 10, 16, 24, 33, 44];
      rows.forEach((dy, r) => {
        const alpha = 0.4 - r * 0.05;
        g.fillStyle = hexToRgba(pal.grassDeep, alpha);
        const spacing = 5 + r * 2;
        for (let x = xFrom * W; x < xTo * W; x += spacing + rng() * spacing * 0.5) {
          const y = this.sample(contour, x / W) * H + dy;
          if (y > H + PAD) continue;
          const h = (11 - r) * (0.8 + rng() * 0.5);
          const bend = (rng() - 0.35) * 0.3 + windward;
          this.fillBlade(g, x, y, h, 1.4 + rng(), bend);
        }
      });
    };

    fillHill(this.contourL, pal.hillTop, pal.hillLow, 0.5);
    rimStroke(this.contourL, 0.5);
    bakeUnderGrass(this.contourL, 0, 1, 0.06);

    fillHill(this.contourR, mixHex(pal.hillTop, pal.hillLow, 0.25), pal.hillLow, 0.42);
    rimStroke(this.contourR, 0.42);
    bakeUnderGrass(this.contourR, 0.3, 1, 0.04);

    this.near = c;
  }

  /** Tapered grass blade: two quadratics forming a filled sliver. */
  private fillBlade(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    h: number,
    w: number,
    bend: number
  ) {
    const tipX = x + bend * h;
    const tipY = y - h * (1 - 0.08 * bend * bend);
    const cx = x + bend * h * 0.32;
    const cy = y - h * 0.55;
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(cx - w * 0.3, cy, tipX, tipY);
    g.quadraticCurveTo(cx + w * 0.3, cy, x + w / 2, y);
    g.closePath();
    g.fill();
  }

  private plantGrass(rng: () => number) {
    const pal = this.pal!;
    const W = this.cssW();
    const H = this.cssH();
    const tierScale = this.tier <= 2 ? 1.9 : 1;
    const map = new Map<string, Blade[]>();
    const put = (fill: string, b: Blade) => {
      const arr = map.get(fill);
      if (arr) arr.push(b);
      else map.set(fill, [b]);
    };

    const plant = (
      contour: number[],
      xFrom: number,
      xTo: number,
      hScale: number,
      windScale: number
    ) => {
      // row 0: the backlit rim — lit lavender with warm pink blades mixed in
      for (let x = xFrom * W; x < xTo * W; x += (5.5 + rng() * 3) * tierScale) {
        const y = this.sample(contour, x / W) * H + 1;
        const roll = rng();
        const fill =
          roll < 0.16
            ? hexToRgba(pal.grassTip, 0.9)
            : roll < 0.5
              ? hexToRgba(pal.grassLit, 0.85)
              : hexToRgba(pal.grassMid, 0.8);
        put(fill, {
          x,
          y,
          h: (17 + rng() * 15) * hScale,
          w: 1.5 + rng() * 1.3,
          phase: rng() * Math.PI * 2,
          flutterHz: 2 + rng() * 1.1,
          bend: 0.24 + rng() * 0.2,
          windScale,
        });
      }
      // row 1: slightly sunk, darker
      for (let x = xFrom * W; x < xTo * W; x += (9 + rng() * 4) * tierScale) {
        const y = this.sample(contour, x / W) * H + 6;
        put(hexToRgba(pal.grassDark, 0.6), {
          x,
          y,
          h: (12 + rng() * 10) * hScale,
          w: 1.4 + rng(),
          phase: rng() * Math.PI * 2,
          flutterHz: 1.8 + rng(),
          bend: 0.2 + rng() * 0.16,
          windScale: windScale * 0.85,
        });
      }
    };

    plant(this.contourL, 0, 1, 1, 1);
    plant(this.contourR, 0.34, 1, 1.12, 1); // nearer hill: taller blades
    // sparse, small, slow blades on the mid hills — depth through motion
    for (let x = 0; x < W; x += (16 + rng() * 8) * tierScale) {
      const y = this.sample(this.contourM, x / W) * H + 1;
      put(hexToRgba(mixHex(pal.hillTopMid, pal.grassLit, 0.5), 0.55), {
        x,
        y,
        h: 6 + rng() * 6,
        w: 1.1,
        phase: rng() * Math.PI * 2,
        flutterHz: 1.6,
        bend: 0.18,
        windScale: 0.4,
      });
    }

    this.buckets = Array.from(map.entries()).map(([fill, blades]) => ({ fill, blades }));
  }

  private buildBushes(rng: () => number) {
    const W = this.cssW();
    const H = this.cssH();

    const makeBush = (
      xFrac: number,
      yPx: number,
      scale: number,
      stemCount: number,
      bokeh: boolean
    ): Bush => {
      const stems: Stem[] = [];
      const stamps: Stamp[] = [];
      for (let i = 0; i < stemCount; i++) {
        const angle = -Math.PI / 2 + (i / (stemCount - 1) - 0.5) * 1.9 + (rng() - 0.5) * 0.25;
        const len = scale * (0.5 + rng() * 0.55);
        const x1 = Math.cos(angle) * len;
        const y1 = Math.sin(angle) * len;
        stems.push({
          x1,
          y1,
          cx: x1 * 0.5 + (rng() - 0.5) * len * 0.3,
          cy: y1 * 0.55,
          width: scale * (0.014 + rng() * 0.012),
          phase: rng() * Math.PI * 2,
        });
        // blossom masses hug the outer half of each stem
        const clusters = 2 + Math.floor(rng() * 2);
        for (let cIdx = 0; cIdx <= clusters; cIdx++) {
          const f = 0.55 + (cIdx / clusters) * 0.45;
          stamps.push({
            x: x1 * f + (rng() - 0.5) * scale * 0.16,
            y: y1 * f + (rng() - 0.5) * scale * 0.14,
            size: scale * (0.34 - cIdx * 0.05 + rng() * 0.08),
            sprite: Math.floor(rng() * 4),
            jPhase: rng() * Math.PI * 2,
          });
        }
      }
      return { x: xFrac * W, y: yPx, scale, phase: rng() * Math.PI * 2, rotAmp: bokeh ? 0 : 1, stems, stamps, bokeh };
    };

    this.bushes = [
      // mid-left bush sitting on the left hill crest
      makeBush(0.14, this.sample(this.contourL, 0.14) * H + 6, H * 0.17, 7, false),
      // small accent bush further down the slope
      makeBush(0.33, this.sample(this.contourL, 0.33) * H + 8, H * 0.09, 5, false),
      // the big right-edge bush crowning the near hill
      makeBush(0.9, this.sample(this.contourR, 0.9) * H + 8, H * 0.24, 9, false),
      // near-lens bokeh mass in the bottom-left corner, like the reference
      makeBush(0.04, H * 1.02, H * 0.3, 6, true),
    ];
  }

  private buildStars(rng: () => number) {
    const W = this.cssW();
    const H = this.cssH();
    this.stars = Array.from({ length: STAR_COUNT }, () => {
      const y = rng() * H * 0.34;
      return {
        x: rng() * W,
        y,
        size: 0.6 + rng() * 1,
        phase: rng() * Math.PI * 2,
        alpha: (0.14 + rng() * 0.34) * (1 - y / (H * 0.4)), // fade toward the glow
      };
    });
  }

  private buildMotes(rng: () => number) {
    const W = this.cssW();
    const H = this.cssH();
    this.motes = Array.from({ length: MOTE_COUNT }, () => ({
      x: rng() * W,
      y: H * (0.55 + rng() * 0.45),
      v: 3 + rng() * 5,
      phase: rng() * Math.PI * 2,
      size: 0.8 + rng() * 1.6,
    }));
  }

  private buildGrain(rng: () => number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const S = 160;
    const tile = document.createElement("canvas");
    tile.width = S;
    tile.height = S;
    const g = tile.getContext("2d")!;
    const img = g.createImageData(S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const light = rng() > 0.5;
      const v = light ? 255 : 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(rng() * 18); // ≈ ±3.5% luminance (§2.3 rule 9)
    }
    g.putImageData(img, 0, 0);
    this.grain = ctx.createPattern(tile, "repeat") ?? undefined;
  }

  // ------------------------------------------------------------------ wind

  /** Slow spatially-coherent breeze: waves that travel across the field. */
  private windBase(x: number, t: number): number {
    return (
      0.45 * Math.sin(t * 0.55 - x * 0.004) +
      0.35 * Math.sin(t * 0.23 - x * 0.0016 + 1.7) +
      0.2 * Math.sin(t * 0.9 - x * 0.006 + 4.1)
    );
  }

  private gustAt(x: number, t: number): number {
    let sum = 0;
    for (const gu of this.gusts) {
      const pos = gu.x + gu.speed * (t - gu.born);
      const d = (x - pos) / gu.width;
      sum += gu.strength * Math.exp(-d * d) * Math.exp(-(t - gu.born) * 0.35);
    }
    return sum;
  }

  // ------------------------------------------------------------------ tick

  tick(t: number) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    if (!ctx || !canvas || !theme) return;
    if (!this.startT) this.startT = t;
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;

    // throttled rebuild: theme morphs stream tokens every frame
    if (this.builtKey !== paletteKey(theme) && t - this.lastBuildT > 0.12) {
      this.lastBuildT = t;
      this.rebuildAll();
    }
    if (!this.far || !this.near || !this.pal) return;

    const W = this.cssW();
    const H = this.cssH();
    const pal = this.pal;
    const speed = theme.motion.speed || 1;
    const wt = t * speed;

    // spontaneous gusts keep the field alive between data events
    if (t >= this.nextGustAt) {
      this.nextGustAt = t + 7 + Math.random() * 8;
      this.gusts.push({
        x: -W * 0.25,
        born: t,
        strength: 0.35 + Math.random() * 0.5,
        speed: W * (0.1 + Math.random() * 0.08),
        width: W * (0.14 + Math.random() * 0.08),
      });
    }
    this.gusts = this.gusts.filter(
      (gu) => t - gu.born < 14 && gu.x + gu.speed * (t - gu.born) < W * 1.6
    );

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // ±6px burn-in drift; far layer parallaxes at 0.4× (§5.1)
    const cyc = (t / 600) * Math.PI * 2 + this.driftPhase;
    const driftX = Math.sin(cyc) * DRIFT_AMP;
    const driftY = Math.cos(cyc * 0.7) * DRIFT_AMP * 0.6;

    ctx.drawImage(this.far, -PAD + driftX * 0.4, -PAD + driftY * 0.4, W + PAD * 2, H + PAD * 2);

    // stars — twilight's first handful, twinkling above the ridgelines
    ctx.fillStyle = pal.star;
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(wt * (0.5 + s.phase * 0.12) + s.phase);
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillRect(s.x + driftX * 0.4, s.y + driftY * 0.4, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // horizon glow breathes over ~9s — the scene's slow heartbeat
    const breathe = 0.055 + 0.03 * Math.sin(wt * 0.14);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(W * 0.62, H * 0.56, 0, W * 0.62, H * 0.56, W * 0.42);
    glow.addColorStop(0, hexToRgba(pal.glow, breathe));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";

    // valley mist band, slowly waxing and waning
    const mistA = 0.05 + 0.028 * Math.sin(wt * 0.11 + 2.1);
    const mist = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.7);
    mist.addColorStop(0, "rgba(0,0,0,0)");
    mist.addColorStop(0.5, hexToRgba(pal.mist, mistA));
    mist.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.54, W, H * 0.16);

    ctx.drawImage(this.near, -PAD + driftX, -PAD + driftY, W + PAD * 2, H + PAD * 2);

    ctx.save();
    ctx.translate(driftX, driftY);
    this.drawGrass(ctx, wt);
    this.drawBushes(ctx, wt, t, dt);
    this.updatePetals(ctx, wt, dt, W, H);
    this.updateMotes(ctx, wt, dt, H);
    ctx.restore();

    // film grain, re-jittered every frame
    if (this.grain) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.translate(-Math.random() * 160, -Math.random() * 160);
      ctx.fillStyle = this.grain;
      ctx.fillRect(0, 0, canvas.width + 160, canvas.height + 160);
      ctx.restore();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

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

  private drawGrass(ctx: CanvasRenderingContext2D, wt: number) {
    for (const bucket of this.buckets) {
      ctx.fillStyle = bucket.fill;
      for (const b of bucket.blades) {
        const base = this.windBase(b.x, wt);
        const flutter = Math.sin(wt * b.flutterHz + b.phase) * (0.05 + 0.09 * Math.abs(base));
        const gust = this.gustAt(b.x, wt);
        const bend = Math.max(-0.5, Math.min(0.85, b.bend * (base * b.windScale + flutter) + gust * 0.4 * b.windScale));
        this.fillBlade(ctx, b.x, b.y, b.h, b.w, bend);
      }
    }
  }

  private drawBushes(ctx: CanvasRenderingContext2D, wt: number, t: number, dt: number) {
    const pal = this.pal!;
    for (const bush of this.bushes) {
      const base = this.windBase(bush.x, wt);
      const gust = this.gustAt(bush.x, wt);
      const windMag = Math.abs(base) + gust;

      // gusts shake petals loose; a gentle ambient shed keeps drift alive
      this.petalAccum += dt * (0.12 + gust * 3.5) * (bush.scale > this.cssH() * 0.15 ? 1 : 0.3);
      while (this.petalAccum >= 1 && this.petals.length < MAX_PETALS) {
        this.petalAccum -= 1;
        const st = bush.stamps[Math.floor(Math.random() * bush.stamps.length)];
        this.spawnPetal(bush.x + st.x, bush.y + st.y, base + gust);
      }

      ctx.save();
      ctx.translate(bush.x, bush.y);
      if (bush.rotAmp > 0) {
        ctx.rotate((base * 0.032 + gust * 0.075 + Math.sin(wt * 0.4 + bush.phase) * 0.014) * bush.rotAmp);
      } else {
        // cropped near-lens mass: translate sway reads better than rotation
        ctx.translate(base * 5 + gust * 9, Math.sin(wt * 0.5 + bush.phase) * 2);
      }

      if (!bush.bokeh) {
        ctx.strokeStyle = hexToRgba(pal.stem, 0.9);
        ctx.lineCap = "round";
        for (const stem of bush.stems) {
          const stemSway = Math.sin(wt * 1.1 + stem.phase) * 0.018 + gust * 0.03;
          ctx.lineWidth = stem.width;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(
            stem.cx + stemSway * bush.scale,
            stem.cy,
            stem.x1 + stemSway * bush.scale * 1.6,
            stem.y1
          );
          ctx.stroke();
        }
      }

      const sprites = bush.bokeh ? this.bokehSprites : this.sprites;
      for (const st of bush.stamps) {
        const jx = Math.sin(wt * 1.6 + st.jPhase) * (0.8 + windMag * 2.2);
        const jy = Math.cos(wt * 1.3 + st.jPhase) * 0.6;
        const sprite = sprites[st.sprite % sprites.length];
        ctx.globalAlpha = bush.bokeh ? 0.88 : 0.96;
        ctx.drawImage(sprite, st.x + jx - st.size / 2, st.y + jy - st.size / 2, st.size, st.size);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  private spawnPetal(x: number, y: number, wind: number) {
    this.petals.push({
      x,
      y,
      vx: 14 + wind * 26 + Math.random() * 10,
      vy: 9 + Math.random() * 9,
      size: 1.6 + Math.random() * 2,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 2.4,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      life: 6 + Math.random() * 3,
    });
  }

  private updatePetals(
    ctx: CanvasRenderingContext2D,
    wt: number,
    dt: number,
    W: number,
    H: number
  ) {
    const pal = this.pal!;
    this.petals = this.petals.filter((p) => {
      p.age += dt;
      if (p.age > p.life || p.x > W + 30 || p.y > H + 20) return false;
      const gust = this.gustAt(p.x, wt);
      p.x += (p.vx + gust * 50 + Math.sin(wt * 1.4 + p.phase) * 8) * dt;
      p.y += (p.vy + Math.cos(wt * 1.1 + p.phase) * 6) * dt;
      p.rot += p.vr * dt;

      const fade = Math.min(1, p.age * 2, (p.life - p.age) / 1.6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.7 * fade;
      ctx.fillStyle = pal.blossomLight;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return true;
    });
    ctx.globalAlpha = 1;
  }

  private updateMotes(ctx: CanvasRenderingContext2D, wt: number, dt: number, H: number) {
    const pal = this.pal!;
    ctx.fillStyle = pal.mote;
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.x += Math.sin(wt * 0.4 + m.phase) * 6 * dt;
      if (m.y < H * 0.5) {
        m.y = H * (0.92 + Math.random() * 0.1);
        m.x = Math.random() * this.cssW();
      }
      ctx.globalAlpha = 0.22 * (0.5 + 0.5 * Math.sin(wt * 0.9 + m.phase));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------- contract

  pulse(originNdc: [number, number], strength: number) {
    const W = this.cssW();
    if (!W) return;
    const x = ((originNdc[0] + 1) / 2) * W;
    // a gust born at the widget, sweeping rightward through the field
    this.gusts.push({
      x: x - W * 0.1,
      born: this.lastT,
      strength: 0.5 + strength * 0.7,
      speed: W * 0.14,
      width: W * 0.13,
    });
    // shake a burst of petals out of the nearest big bush
    const bush = this.bushes
      .filter((b) => !b.bokeh)
      .sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
    if (bush) {
      const count = Math.round(5 + strength * 8);
      for (let i = 0; i < count && this.petals.length < MAX_PETALS; i++) {
        const st = bush.stamps[Math.floor(Math.random() * bush.stamps.length)];
        this.spawnPetal(bush.x + st.x, bush.y + st.y, 0.6 + strength);
      }
    }
  }

  setVignette(v: number, color: string) {
    this.vignette = v;
    this.vignetteColor = color;
  }

  dim(v: number) {
    this.dimAmount = v;
  }

  setMood(_mood: Mood) {
    // moods arrive as dim/vignette calls from the scene layer
  }

  setParams(p: EngineParams) {
    if (typeof p.tier === "number") {
      this.tier = p.tier as 1 | 2 | 3;
      this.builtKey = ""; // replant at the new density on next tick
    }
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    this.dpr = this.tier >= 3 ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = canvas.clientWidth * this.dpr;
    canvas.height = canvas.clientHeight * this.dpr;
    this.rebuildAll();
  }

  dispose() {
    this.ctx = null;
    this.canvas = undefined;
    this.far = undefined;
    this.near = undefined;
    this.sprites = [];
    this.bokehSprites = [];
    this.buckets = [];
    this.bushes = [];
    this.petals = [];
    this.gusts = [];
  }
}
