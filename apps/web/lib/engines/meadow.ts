import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";
import { growthBus, type GrowthHourEvent } from "./growthBus";

/**
 * `meadow` — a painterly valley that lives on the display's local time and
 * weather. Composition (back to front): time-of-day gradient sky → sun (dawn)
 * or moon (night) → stars, shooting stars, drifting clouds, passing birds →
 * five mountain ridgelines dissolving into horizon haze → breathing glow and
 * valley mist → rolling mid hills with blossom clumps → dense foreground grass
 * field swaying on a coherent wind → flowering bushes → petals, motes, rain.
 *
 * Time: a keyframe table (night → dawn → day → golden hour → dusk → night)
 * drives every baked color; static layers rebake as the clock crawls (~every
 * 2 simulated minutes, throttled). The drawer's time scrubber (growthBus) and
 * `params.hour` override the wall clock for demos.
 *
 * Weather: `alert` mood rolls in a storm — ceiling clouds, rain on the wind,
 * lightning, hard gusts — and `params.weather` ('clear' | 'rain' | 'storm')
 * overrides the mood mapping for agents/demos. Everything ramps continuously;
 * there is never a hard cut.
 *
 * Fidelity strategy: sky+ridges and hills+deep-grass are baked into two
 * offscreen layers at devicePixelRatio; the animated field draws ~2000 blades
 * per frame as batched subpaths (one fill()/stroke() per color bucket), which
 * keeps the whole scene comfortably inside a 60fps budget. 2D canvas — no
 * WebGL context spent.
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

type BladeBucket = {
  style: "fill" | "stroke";
  color: string;
  lineWidth: number;
  blades: Blade[];
};

type Stamp = { x: number; y: number; size: number; sprite: number; jPhase: number };
type Stem = { x1: number; y1: number; cx: number; cy: number; width: number; phase: number };
type Bush = {
  x: number;
  y: number;
  scale: number;
  phase: number;
  rotAmp: number;
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
type Cloud = { x: number; y: number; scale: number; speed: number; sprite: number; storm: boolean };
type RainDrop = { x: number; y: number; len: number; speed: number };
type Meteor = { x: number; y: number; vx: number; vy: number; born: number; life: number };
type Flock = {
  born: number;
  y: number;
  speed: number;
  size: number;
  offsets: { dx: number; dy: number; phase: number }[];
};

type Weather = "clear" | "rain" | "storm";

const RIDGE_COUNT = 5;
const SAMPLES = 256;
const PAD = 16;
const MAX_PETALS = 70;
const MOTE_COUNT = 14;
const STAR_COUNT = 90;
const RAIN_POOL = 170;
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

// ------------------------------------------------------------- time of day

type TimeState = {
  dayLight: number; // 0 night → 1 midday
  warmth: number; // sunrise/sunset color in the low sky
  glowK: number; // horizon glow strength
  starK: number; // star visibility
  moonK: number;
  sunK: number;
  mistK: number; // valley mist thickness
};

const TIME_KEYS: ({ h: number } & TimeState)[] = [
  { h: 0, dayLight: 0, warmth: 0.1, glowK: 0.12, starK: 1, moonK: 1, sunK: 0, mistK: 0.045 },
  { h: 4.5, dayLight: 0, warmth: 0.18, glowK: 0.18, starK: 0.95, moonK: 0.85, sunK: 0, mistK: 0.055 },
  { h: 6, dayLight: 0.3, warmth: 0.9, glowK: 1.2, starK: 0.3, moonK: 0.2, sunK: 0.9, mistK: 0.09 },
  { h: 8, dayLight: 0.65, warmth: 0.45, glowK: 0.6, starK: 0, moonK: 0, sunK: 0.3, mistK: 0.06 },
  { h: 12, dayLight: 1, warmth: 0.18, glowK: 0.35, starK: 0, moonK: 0, sunK: 0, mistK: 0.03 },
  { h: 16, dayLight: 0.85, warmth: 0.4, glowK: 0.55, starK: 0, moonK: 0, sunK: 0, mistK: 0.035 },
  { h: 18.5, dayLight: 0.45, warmth: 1, glowK: 1.25, starK: 0.1, moonK: 0, sunK: 0.5, mistK: 0.05 },
  { h: 20, dayLight: 0.15, warmth: 0.75, glowK: 0.9, starK: 0.45, moonK: 0.25, sunK: 0.1, mistK: 0.055 },
  { h: 21.5, dayLight: 0.02, warmth: 0.3, glowK: 0.3, starK: 0.9, moonK: 0.7, sunK: 0, mistK: 0.05 },
  { h: 24, dayLight: 0, warmth: 0.1, glowK: 0.12, starK: 1, moonK: 1, sunK: 0, mistK: 0.045 },
];

function timeStateAt(hour: number): TimeState {
  const h = ((hour % 24) + 24) % 24;
  let i = 0;
  while (i < TIME_KEYS.length - 2 && TIME_KEYS[i + 1].h <= h) i++;
  const a = TIME_KEYS[i];
  const b = TIME_KEYS[i + 1];
  const t = smoothstep(a.h, b.h, h);
  const lerp = (ka: number, kb: number) => ka + (kb - ka) * t;
  return {
    dayLight: lerp(a.dayLight, b.dayLight),
    warmth: lerp(a.warmth, b.warmth),
    glowK: lerp(a.glowK, b.glowK),
    starK: lerp(a.starK, b.starK),
    moonK: lerp(a.moonK, b.moonK),
    sunK: lerp(a.sunK, b.sunK),
    mistK: lerp(a.mistK, b.mistK),
  };
}

// ----------------------------------------------------------------- palette

/** All meadow colors derive from theme tokens modulated by time of day, so
 * any theme palette drives the same living scene. */
function derivePalette(theme: ThemeTokens, ts: TimeState) {
  const p = theme.palette;
  const lift = (c: string, t: number) => mixHex(c, p.text1, t);
  const sink = (c: string, t: number) => mixHex(c, p.bg0, t);
  const nightSink = (c: string, k: number) => mixHex(c, p.bg0, (1 - ts.dayLight) * k);

  const horizonWarm = lift(mixHex(p.accent1, p.accent2, 0.15), 0.42);
  const horizonCool = mixHex(p.bg0, p.accent2, 0.4);
  const horizon = mixHex(horizonCool, horizonWarm, Math.max(ts.warmth, ts.dayLight * 0.4));

  const ridges: { body: string; haze: string }[] = [];
  for (let i = 0; i < RIDGE_COUNT; i++) {
    const t = i / (RIDGE_COUNT - 1);
    const dayBody = mixHex(lift(p.accent2, 0.35), sink(p.accent2, 0.52), t);
    const nightBody = mixHex(p.bg0, p.accent2, 0.16 + t * 0.1);
    const body = mixHex(nightBody, dayBody, Math.min(1, ts.dayLight + ts.warmth * 0.35));
    const hazeAmt = (0.62 - t * 0.34) * (0.4 + 0.6 * Math.max(ts.warmth, ts.dayLight * 0.5));
    ridges.push({ body, haze: mixHex(body, horizon, hazeAmt) });
  }

  return {
    skyTop: mixHex(mixHex(p.bg0, "#050610", 0.55), mixHex(p.bg0, p.accent2, 0.35), ts.dayLight),
    skyMid: mixHex(p.bg0, p.accent2, 0.18 + 0.4 * ts.dayLight),
    skyLow: mixHex(
      lift(p.accent2, 0.08 + 0.28 * ts.dayLight),
      lift(mixHex(p.accent2, p.accent1, 0.5), 0.24),
      ts.warmth
    ),
    horizon,
    glow: lift(p.accent1, 0.55),
    star: p.text1,
    moon: lift(p.text1, 0.2),
    sun: lift(p.accent1, 0.65),
    // near-ink silhouette — must read against both the day and dusk sky
    bird: mixHex(p.bg0, "#05060c", 0.55),
    cloudLight: lift(p.accent2, 0.5),
    cloudDark: sink(p.accent2, 0.5),
    rain: lift(p.accent2, 0.5),
    boltCore: p.text1,
    boltGlow: p.accent2,
    stormCeil: mixHex(p.bg0, "#05060c", 0.4),
    ridges,
    mist: lift(p.accent2, 0.45),
    hillTopMid: nightSink(mixHex(mixHex(p.accent2, p.surfaceTint, 0.5), horizonWarm, 0.3), 0.3),
    hillLowMid: nightSink(sink(p.accent2, 0.42), 0.25),
    hillTop: nightSink(mixHex(p.accent2, p.surfaceTint, 0.55), 0.3),
    hillLow: nightSink(sink(p.accent2, 0.62), 0.2),
    rim: nightSink(lift(p.surfaceTint, 0.4), 0.35),
    grassLit: nightSink(lift(p.surfaceTint, 0.22), 0.3),
    grassMid: nightSink(mixHex(p.surfaceTint, p.accent2, 0.55), 0.25),
    grassDark: nightSink(sink(p.accent2, 0.4), 0.2),
    grassDeep: nightSink(sink(p.accent2, 0.66), 0.15),
    grassTip: nightSink(lift(p.accent1, 0.3), 0.35),
    stem: sink(p.accent1, 0.68),
    blossomDeep: nightSink(sink(p.accent1, 0.3), 0.2),
    blossomMid: nightSink(p.accent1, 0.28),
    blossomLight: nightSink(lift(p.accent1, 0.32), 0.3),
    blossomHi: nightSink(lift(p.accent1, 0.62), 0.35),
    mote: lift(p.accent1, 0.5),
  };
}

type Palette = ReturnType<typeof derivePalette>;

function paletteKey(theme: ThemeTokens): string {
  const p = theme.palette;
  return [p.bg0, p.bg1, p.surfaceTint, p.text1, p.accent1, p.accent2].join("|");
}

function parseWeather(v: unknown): Weather | null {
  return v === "clear" || v === "rain" || v === "storm" ? v : null;
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
  private cloudSprites: { light: HTMLCanvasElement; dark: HTMLCanvasElement }[] = [];
  private grain?: CanvasPattern;

  private contourL: number[] = [];
  private contourR: number[] = [];
  private contourM: number[] = [];

  private buckets: BladeBucket[] = [];
  private bushes: Bush[] = [];
  private stars: Star[] = [];
  private motes: Mote[] = [];
  private clouds: Cloud[] = [];
  private petals: Petal[] = [];
  private gusts: Gust[] = [];
  private rain: RainDrop[] = [];
  private meteor: Meteor | null = null;
  private flock: Flock | null = null;
  private boltPts: [number, number][][] = [];
  private boltAge = 1;
  private flashA = 0;

  private mood: Mood = "ambient";
  private weatherOverride: Weather | null = null;
  private stormT = 0;

  private hourOverride: number | null = null;
  private bakedHour = -99;
  private builtKey = "";
  private lastBuildT = -1;

  private nextGustAt = 4;
  private nextBoltAt = 0;
  private nextMeteorAt = 20;
  private nextBirdsAt = 12;
  private petalAccum = 0;

  private driftPhase = Math.random() * 1000;
  private startT = 0;
  private lastT = 0;

  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;

  private onHour = (e: Event) => {
    this.hourOverride = (e as CustomEvent<GrowthHourEvent>).detail.hour;
  };

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.tier = (params.tier as 1 | 2 | 3) ?? 3;
    if (typeof params.hour === "number") this.hourOverride = params.hour;
    this.weatherOverride = parseWeather(params.weather);
    this.startT = 0;
    this.lastT = 0;
    growthBus.addEventListener("growth-hour", this.onHour);
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
    this.weatherOverride = parseWeather(theme.background.params?.weather);
    // rebake is throttled in tick() — morphs stream tokens every frame
  }

  setMood(mood: Mood) {
    this.mood = mood;
  }

  private hourNow(): number {
    if (this.hourOverride !== null) return this.hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  private weatherTarget(): number {
    const w = this.weatherOverride ?? (this.mood === "alert" ? "storm" : "clear");
    return w === "storm" ? 1 : w === "rain" ? 0.55 : 0;
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
    const hour = this.hourNow();
    const ts = timeStateAt(hour);
    this.pal = derivePalette(theme, ts);
    this.builtKey = paletteKey(theme);
    this.bakedHour = hour;

    const rng = mulberry32(0x8a3d1);
    this.buildContours(rng);
    this.buildSprites(rng);
    this.buildCloudSprites(rng);
    this.bakeFar(rng, ts);
    this.bakeNear(rng);
    this.plantGrass(rng);
    this.buildBushes(rng);
    this.buildStars(rng);
    this.buildMotes(rng);
    this.buildClouds(rng);
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
      this.contourL.push(0.58 + 0.34 * smoothstep(0, 0.6, x) + (fbm(n1, x * 5) - 0.5) * 0.05);
      this.contourR.push(0.96 - 0.3 * smoothstep(0.42, 1, x) + (fbm(n2, x * 6 + 9) - 0.5) * 0.04);
      this.contourM.push(0.68 + (fbm(n3, x * 3.4 + 23) - 0.5) * 0.09);
    }
  }

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
        const gx = ((rng() + rng() + rng()) / 3) * S;
        const gy = ((rng() + rng() + rng()) / 3) * S;
        const r = 2.6 + rng() * 5.4;
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

  /** Soft cloud sprites — a row of overlapping radial-gradient blobs. */
  private buildCloudSprites(rng: () => number) {
    const pal = this.pal!;
    const build = (color: string): HTMLCanvasElement => {
      const W = 360;
      const H = 150;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d")!;
      for (let i = 0; i < 11; i++) {
        const bx = 40 + rng() * (W - 80);
        const by = H * 0.55 + (rng() - 0.5) * 34;
        const r = 28 + rng() * 46;
        const grad = g.createRadialGradient(bx, by, 0, bx, by, r);
        grad.addColorStop(0, hexToRgba(color, 0.5));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(bx, by, r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };
    this.cloudSprites = [
      { light: build(pal.cloudLight), dark: build(pal.cloudDark) },
      { light: build(pal.cloudLight), dark: build(pal.cloudDark) },
    ];
  }

  private makeLayer(): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
    const c = document.createElement("canvas");
    c.width = (this.cssW() + PAD * 2) * this.dpr;
    c.height = (this.cssH() + PAD * 2) * this.dpr;
    const g = c.getContext("2d")!;
    g.setTransform(this.dpr, 0, 0, this.dpr, this.dpr * PAD, this.dpr * PAD);
    return { c, g };
  }

  private bakeFar(rng: () => number, ts: TimeState) {
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

    // baked afterglow anchor; the breathing pass scales with glowK live
    const glow = g.createRadialGradient(W * 0.62, H * 0.56, 0, W * 0.62, H * 0.56, W * 0.5);
    glow.addColorStop(0, hexToRgba(pal.glow, 0.16 * ts.glowK));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(-PAD, -PAD, W + PAD * 2, H + PAD * 2);

    for (let k = 0; k < RIDGE_COUNT; k++) {
      const t = k / (RIDGE_COUNT - 1);
      const base = 0.42 + t * 0.175;
      const amp = 0.016 + t * 0.02;
      const freq = 7.5 - t * 3.2;
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
      const rows = [26, 36, 48, 62];
      rows.forEach((dy, r) => {
        g.fillStyle = hexToRgba(pal.grassDeep, 0.34 - r * 0.06);
        const spacing = 6 + r * 2;
        g.beginPath();
        for (let x = xFrom * W; x < xTo * W; x += spacing + rng() * spacing * 0.5) {
          const y = this.sample(contour, x / W) * H + dy;
          if (y > H + PAD) continue;
          const h = (10 - r) * (0.8 + rng() * 0.5);
          this.appendBladeFill(g, x, y, h, 1.4 + rng(), (rng() - 0.35) * 0.3 + windward);
        }
        g.fill();
      });
    };

    fillHill(this.contourL, pal.hillTop, pal.hillLow, 0.5);
    rimStroke(this.contourL, 0.5);
    bakeUnderGrass(this.contourL, 0, 0.78, 0.06);

    fillHill(this.contourR, mixHex(pal.hillTop, pal.hillLow, 0.25), pal.hillLow, 0.42);
    rimStroke(this.contourR, 0.42);
    bakeUnderGrass(this.contourR, 0.36, 1, 0.04);

    this.near = c;
  }

  /** Append a tapered blade as a filled subpath (batched — no fill() here). */
  private appendBladeFill(
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
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(cx - w * 0.3, cy, tipX, tipY);
    g.quadraticCurveTo(cx + w * 0.3, cy, x + w / 2, y);
    g.closePath();
  }

  private appendBladeStroke(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    h: number,
    bend: number
  ) {
    const tipX = x + bend * h;
    const tipY = y - h * (1 - 0.08 * bend * bend);
    g.moveTo(x, y);
    g.quadraticCurveTo(x + bend * h * 0.32, y - h * 0.55, tipX, tipY);
  }

  /** The field: dense rows along both crests plus a near fringe at the bottom
   * edge. Rows 0–1 are tapered fills; deeper rows are batched strokes. */
  private plantGrass(rng: () => number) {
    const pal = this.pal!;
    const W = this.cssW();
    const H = this.cssH();
    const tierScale = this.tier <= 2 ? 1.9 : 1;
    const map = new Map<string, BladeBucket>();
    const put = (style: "fill" | "stroke", color: string, lineWidth: number, b: Blade) => {
      const key = `${style}|${color}|${lineWidth}`;
      let bucket = map.get(key);
      if (!bucket) {
        bucket = { style, color, lineWidth, blades: [] };
        map.set(key, bucket);
      }
      bucket.blades.push(b);
    };

    const blade = (
      x: number,
      y: number,
      h: number,
      w: number,
      windScale: number,
      overrides?: Partial<Blade>
    ): Blade => ({
      x,
      y,
      h,
      w,
      phase: rng() * Math.PI * 2,
      flutterHz: 1.7 + rng() * 1.4,
      bend: 0.2 + rng() * 0.22,
      windScale,
      ...overrides,
    });

    const plantHill = (contour: number[], xFrom: number, xTo: number, hScale: number) => {
      // row 0 — the backlit rim: lit + warm-tipped blades breaking the crest
      for (let x = xFrom * W; x < xTo * W; x += (4.2 + rng() * 2) * tierScale) {
        const y = this.sample(contour, x / W) * H - 1;
        const roll = rng();
        const color =
          roll < 0.16
            ? hexToRgba(pal.grassTip, 0.9)
            : roll < 0.5
              ? hexToRgba(pal.grassLit, 0.85)
              : hexToRgba(pal.grassMid, 0.8);
        const h = (16 + rng() * 16) * hScale;
        put("fill", color, 0, blade(x, y, h, 1.4 + rng() * 1.2, 1));
        // tufts: a shorter companion sells density for one extra subpath
        if (rng() < 0.35) {
          put("fill", color, 0, blade(x + (rng() - 0.5) * 4, y + 1, h * 0.55, 1.2, 1));
        }
      }
      // row 1 — just below the rim
      for (let x = xFrom * W; x < xTo * W; x += (6 + rng() * 2.5) * tierScale) {
        const y = this.sample(contour, x / W) * H + 5;
        put(
          "fill",
          hexToRgba(pal.grassDark, 0.72),
          0,
          blade(x, y, (11 + rng() * 10) * hScale, 1.3 + rng(), 0.9)
        );
      }
      // rows 2–3 — the field body, batched strokes
      for (let x = xFrom * W; x < xTo * W; x += (8 + rng() * 3.5) * tierScale) {
        const y = this.sample(contour, x / W) * H + 12;
        put("stroke", hexToRgba(pal.grassDark, 0.55), 1.5, blade(x, y, (9 + rng() * 8) * hScale, 0, 0.75));
      }
      for (let x = xFrom * W; x < xTo * W; x += (11 + rng() * 4) * tierScale) {
        const y = this.sample(contour, x / W) * H + 21;
        put("stroke", hexToRgba(pal.grassDeep, 0.5), 1.4, blade(x, y, (7 + rng() * 6) * hScale, 0, 0.55));
      }
    };

    plantHill(this.contourL, 0, 0.76, 1);
    plantHill(this.contourR, 0.4, 1, 1.14);

    // near fringe along the bottom edge — the closest, largest silhouettes
    for (let x = -10; x < W + 10; x += (7.5 + rng() * 4) * tierScale) {
      put(
        "stroke",
        hexToRgba(pal.grassDeep, 0.8),
        2.4,
        blade(x, H + 4, 26 + rng() * 26, 0, 1.3, { bend: 0.26 + rng() * 0.2 })
      );
    }

    // sparse, small, slow blades on the mid hills — depth through motion
    for (let x = 0; x < W; x += (13 + rng() * 6) * tierScale) {
      const y = this.sample(this.contourM, x / W) * H + 1;
      put(
        "stroke",
        hexToRgba(mixHex(pal.hillTopMid, pal.grassLit, 0.5), 0.55),
        1.1,
        blade(x, y, 5 + rng() * 6, 0, 0.4)
      );
    }

    this.buckets = Array.from(map.values());
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
      return {
        x: xFrac * W,
        y: yPx,
        scale,
        phase: rng() * Math.PI * 2,
        rotAmp: bokeh ? 0 : 1,
        stems,
        stamps,
        bokeh,
      };
    };

    this.bushes = [
      makeBush(0.14, this.sample(this.contourL, 0.14) * H + 6, H * 0.17, 7, false),
      makeBush(0.33, this.sample(this.contourL, 0.33) * H + 8, H * 0.09, 5, false),
      makeBush(0.9, this.sample(this.contourR, 0.9) * H + 8, H * 0.24, 9, false),
      makeBush(0.04, H * 1.02, H * 0.3, 6, true),
    ];
  }

  private buildStars(rng: () => number) {
    const W = this.cssW();
    const H = this.cssH();
    this.stars = Array.from({ length: STAR_COUNT }, () => {
      const y = rng() * H * 0.36;
      return {
        x: rng() * W,
        y,
        size: 0.6 + rng() * 1,
        phase: rng() * Math.PI * 2,
        alpha: (0.16 + rng() * 0.36) * (1 - y / (H * 0.42)),
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

  private buildClouds(rng: () => number) {
    const W = this.cssW();
    const H = this.cssH();
    if (this.clouds.length) return; // survive rebakes — clouds keep drifting
    this.clouds = [];
    for (let i = 0; i < 3; i++) {
      this.clouds.push({
        x: rng() * W,
        y: H * (0.05 + rng() * 0.16),
        scale: W * (0.16 + rng() * 0.12),
        speed: 2.5 + rng() * 4,
        sprite: i % 2,
        storm: false,
      });
    }
    for (let i = 0; i < 4; i++) {
      this.clouds.push({
        x: rng() * W,
        y: H * (0.0 + rng() * 0.1),
        scale: W * (0.3 + rng() * 0.16),
        speed: 9 + rng() * 7,
        sprite: i % 2,
        storm: true,
      });
    }
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
      const v = rng() > 0.5 ? 255 : 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = Math.floor(rng() * 18); // ≈ ±3.5% luminance (§2.3 rule 9)
    }
    g.putImageData(img, 0, 0);
    this.grain = ctx.createPattern(tile, "repeat") ?? undefined;
  }

  // ------------------------------------------------------------------ wind

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

    const hour = this.hourNow();
    const staleBake =
      this.builtKey !== paletteKey(theme) || Math.abs(hour - this.bakedHour) > 0.033;
    if (staleBake && t - this.lastBuildT > 0.15) {
      this.lastBuildT = t;
      this.rebuildAll();
    }
    if (!this.far || !this.near || !this.pal) return;

    const W = this.cssW();
    const H = this.cssH();
    const pal = this.pal;
    const ts = timeStateAt(hour);
    const speed = theme.motion.speed || 1;
    const wt = t * speed;

    // weather ramp — storms roll in over ~2.5s, never cut
    this.stormT += (this.weatherTarget() - this.stormT) * Math.min(1, dt / 2.5);
    const storm = this.stormT;
    const windMul = 1 + storm * 1.4;

    // schedulers -----------------------------------------------------------
    if (t >= this.nextGustAt) {
      this.nextGustAt = t + (7 + Math.random() * 8) / (1 + storm * 1.6);
      this.gusts.push({
        x: -W * 0.25,
        born: t,
        strength: (0.35 + Math.random() * 0.5) * (1 + storm * 0.7),
        speed: W * (0.1 + Math.random() * 0.08) * (1 + storm * 0.5),
        width: W * (0.14 + Math.random() * 0.08),
      });
    }
    this.gusts = this.gusts.filter(
      (gu) => t - gu.born < 14 && gu.x + gu.speed * (t - gu.born) < W * 1.6
    );

    if (storm > 0.7 && t >= this.nextBoltAt) {
      this.nextBoltAt = t + 5 + Math.random() * 9;
      this.flashA = 0.7 + Math.random() * 0.3;
      this.boltPts = Math.random() < 0.5 ? this.makeBolt(W, H) : [];
      this.boltAge = 0;
    } else if (this.nextBoltAt === 0) {
      this.nextBoltAt = t + 3;
    }
    this.flashA *= Math.exp(-dt * 9);
    this.boltAge += dt;

    if (ts.starK > 0.5 && storm < 0.2 && t >= this.nextMeteorAt && !this.meteor) {
      this.nextMeteorAt = t + 90 + Math.random() * 110;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.meteor = {
        x: W * (0.15 + Math.random() * 0.7),
        y: H * (0.04 + Math.random() * 0.16),
        vx: dir * W * (0.55 + Math.random() * 0.25),
        vy: W * (0.22 + Math.random() * 0.12),
        born: t,
        life: 0.9,
      };
    }
    if (ts.dayLight > 0.35 && storm < 0.3 && t >= this.nextBirdsAt && !this.flock) {
      this.nextBirdsAt = t + 100 + Math.random() * 140;
      const count = 3 + Math.floor(Math.random() * 4);
      this.flock = {
        born: t,
        y: H * (0.12 + Math.random() * 0.2),
        speed: W / (26 + Math.random() * 14),
        size: 4.5 + Math.random() * 3,
        offsets: Array.from({ length: count }, (_, i) => ({
          dx: -i * (14 + Math.random() * 10) - Math.random() * 8,
          dy: (i % 2 === 0 ? 1 : -1) * (i * 4 + Math.random() * 6),
          phase: Math.random() * Math.PI * 2,
        })),
      };
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const cyc = (t / 600) * Math.PI * 2 + this.driftPhase;
    const driftX = Math.sin(cyc) * DRIFT_AMP;
    const driftY = Math.cos(cyc * 0.7) * DRIFT_AMP * 0.6;

    ctx.drawImage(this.far, -PAD + driftX * 0.4, -PAD + driftY * 0.4, W + PAD * 2, H + PAD * 2);

    this.drawMoonSun(ctx, W, H, hour, ts, storm, driftX, driftY);

    // stars + the occasional meteor
    const starVis = ts.starK * (1 - storm);
    if (starVis > 0.02) {
      ctx.fillStyle = pal.star;
      for (const s of this.stars) {
        const tw = 0.55 + 0.45 * Math.sin(wt * (0.5 + s.phase * 0.12) + s.phase);
        ctx.globalAlpha = s.alpha * tw * starVis;
        ctx.fillRect(s.x + driftX * 0.4, s.y + driftY * 0.4, s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }
    this.drawMeteor(ctx, t, starVis);

    // horizon glow breathes; storm smothers it
    const glowA = (0.05 + 0.03 * Math.sin(wt * 0.14)) * ts.glowK * (1 - storm * 0.75);
    if (glowA > 0.003) {
      ctx.globalCompositeOperation = "lighter";
      const glow = ctx.createRadialGradient(W * 0.62, H * 0.56, 0, W * 0.62, H * 0.56, W * 0.42);
      glow.addColorStop(0, hexToRgba(pal.glow, glowA));
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }

    this.drawClouds(ctx, dt, W, H, ts, storm);
    this.drawBirds(ctx, wt, t, W);

    const mistA = (ts.mistK + storm * 0.05) * (1 + 0.4 * Math.sin(wt * 0.11 + 2.1));
    const mist = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.7);
    mist.addColorStop(0, "rgba(0,0,0,0)");
    mist.addColorStop(0.5, hexToRgba(pal.mist, mistA));
    mist.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.54, W, H * 0.16);

    ctx.drawImage(this.near, -PAD + driftX, -PAD + driftY, W + PAD * 2, H + PAD * 2);

    ctx.save();
    ctx.translate(driftX, driftY);
    this.drawGrass(ctx, wt, windMul);
    this.drawBushes(ctx, wt, dt, windMul);
    this.updatePetals(ctx, wt, dt, W, H);
    if (storm < 0.5) this.updateMotes(ctx, wt, dt, H, ts, storm);
    ctx.restore();

    this.updateRain(ctx, wt, dt, W, H, storm);

    // storm broods over everything scene-side
    if (storm > 0.01) {
      const ceil = ctx.createLinearGradient(0, 0, 0, H * 0.3);
      ceil.addColorStop(0, hexToRgba(pal.stormCeil, storm * 0.5));
      ceil.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ceil;
      ctx.fillRect(0, 0, W, H * 0.3);
      ctx.fillStyle = hexToRgba(pal.stormCeil, storm * 0.22);
      ctx.fillRect(0, 0, W, H);
    }

    this.drawLightning(ctx, W, H, storm);

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

  // ---------------------------------------------------------- sky dwellers

  private drawMoonSun(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    hour: number,
    ts: TimeState,
    storm: number,
    driftX: number,
    driftY: number
  ) {
    const pal = this.pal!;
    const moonA = ts.moonK * (1 - storm);
    if (moonA > 0.02) {
      // the moon arcs slowly across the night — burn-in never sees it parked
      const prog = hour >= 19 ? (hour - 19) / 11 : (hour + 5) / 11;
      const mx = W * (0.82 - 0.4 * prog) + driftX * 0.4;
      const my = H * (0.13 + 0.06 * Math.sin(prog * Math.PI)) + driftY * 0.4;
      const r = H * 0.045;
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, r * 3);
      halo.addColorStop(0, hexToRgba(pal.moon, 0.14 * moonA));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, r * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hexToRgba(pal.moon, 0.75 * moonA);
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const sunA = ts.sunK * (1 - storm);
    if (sunA > 0.02) {
      // dawn: the disc climbs out of the haze; dusk: it sinks back
      const rising = hour < 12;
      const prog = rising ? smoothstep(5, 9, hour) : 1 - smoothstep(17, 20.5, hour);
      const sx = W * 0.62 + driftX * 0.4;
      const sy = H * (0.6 - 0.24 * prog) + driftY * 0.4;
      const r = H * 0.05;
      ctx.globalCompositeOperation = "lighter";
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
      halo.addColorStop(0, hexToRgba(pal.sun, 0.35 * sunA));
      halo.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
      ctx.fillStyle = hexToRgba(pal.sun, 0.8 * sunA);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }

  private drawMeteor(ctx: CanvasRenderingContext2D, t: number, starVis: number) {
    const m = this.meteor;
    if (!m) return;
    const age = t - m.born;
    if (age > m.life || starVis < 0.1) {
      this.meteor = null;
      return;
    }
    const pal = this.pal!;
    const px = m.x + m.vx * age;
    const py = m.y + m.vy * age;
    const env = Math.sin((Math.PI * age) / m.life) * starVis;
    const spd = Math.hypot(m.vx, m.vy);
    const tx = px - (m.vx / spd) * 110;
    const ty = py - (m.vy / spd) * 110;
    const grad = ctx.createLinearGradient(px, py, tx, ty);
    grad.addColorStop(0, hexToRgba(pal.star, 0.9 * env));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(pal.star, env);
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    dt: number,
    W: number,
    H: number,
    ts: TimeState,
    storm: number
  ) {
    if (!this.cloudSprites.length) return;
    for (const cl of this.clouds) {
      const alpha = cl.storm
        ? storm * 0.7
        : (0.06 + 0.1 * ts.dayLight) * (1 - storm * 0.4);
      cl.x += cl.speed * (cl.storm ? 1 + storm : 1) * dt;
      if (cl.x - cl.scale / 2 > W) cl.x = -cl.scale / 2 - Math.random() * W * 0.2;
      if (alpha < 0.01) continue;
      const spr = this.cloudSprites[cl.sprite % this.cloudSprites.length];
      const img = cl.storm ? spr.dark : spr.light;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, cl.x - cl.scale / 2, cl.y, cl.scale, cl.scale * 0.42);
      ctx.globalAlpha = 1;
    }
  }

  private drawBirds(ctx: CanvasRenderingContext2D, wt: number, t: number, W: number) {
    const flock = this.flock;
    if (!flock) return;
    const lead = (t - flock.born) * flock.speed - 40;
    if (lead > W + 120) {
      this.flock = null;
      return;
    }
    const pal = this.pal!;
    ctx.strokeStyle = hexToRgba(pal.bird, 0.85);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const o of flock.offsets) {
      const bx = lead + o.dx;
      const by = flock.y + o.dy + Math.sin(wt * 0.7 + o.phase) * 3;
      if (bx < -30 || bx > W + 30) continue;
      const s = flock.size;
      const flap = Math.sin(wt * 5.2 + o.phase) * 0.55;
      ctx.moveTo(bx - s, by - s * flap);
      ctx.quadraticCurveTo(bx - s * 0.35, by - s * 0.55 * flap - s * 0.2, bx, by);
      ctx.quadraticCurveTo(bx + s * 0.35, by - s * 0.55 * flap - s * 0.2, bx + s, by - s * flap);
    }
    ctx.stroke();
  }

  // ------------------------------------------------------------ foreground

  private drawGrass(ctx: CanvasRenderingContext2D, wt: number, windMul: number) {
    for (const bucket of this.buckets) {
      ctx.beginPath();
      for (const b of bucket.blades) {
        const base = this.windBase(b.x, wt) * windMul;
        const flutter = Math.sin(wt * b.flutterHz + b.phase) * (0.05 + 0.09 * Math.abs(base));
        const gust = this.gustAt(b.x, wt);
        const bend = Math.max(
          -0.6,
          Math.min(0.95, b.bend * (base * b.windScale + flutter) + gust * 0.4 * b.windScale)
        );
        if (bucket.style === "fill") this.appendBladeFill(ctx, b.x, b.y, b.h, b.w, bend);
        else this.appendBladeStroke(ctx, b.x, b.y, b.h, bend);
      }
      if (bucket.style === "fill") {
        ctx.fillStyle = bucket.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = bucket.color;
        ctx.lineWidth = bucket.lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
      }
    }
  }

  private drawBushes(ctx: CanvasRenderingContext2D, wt: number, dt: number, windMul: number) {
    const pal = this.pal!;
    for (const bush of this.bushes) {
      const base = this.windBase(bush.x, wt) * windMul;
      const gust = this.gustAt(bush.x, wt);
      const windMag = Math.abs(base) + gust;

      this.petalAccum +=
        dt * (0.12 + gust * 3.5) * (bush.scale > this.cssH() * 0.15 ? 1 : 0.3);
      while (this.petalAccum >= 1 && this.petals.length < MAX_PETALS) {
        this.petalAccum -= 1;
        const st = bush.stamps[Math.floor(Math.random() * bush.stamps.length)];
        this.spawnPetal(bush.x + st.x, bush.y + st.y, base + gust);
      }

      ctx.save();
      ctx.translate(bush.x, bush.y);
      if (bush.rotAmp > 0) {
        ctx.rotate(
          (base * 0.032 + gust * 0.075 + Math.sin(wt * 0.4 + bush.phase) * 0.014) * bush.rotAmp
        );
      } else {
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

  private updateMotes(
    ctx: CanvasRenderingContext2D,
    wt: number,
    dt: number,
    H: number,
    ts: TimeState,
    storm: number
  ) {
    const pal = this.pal!;
    // pollen by day, fireflies by night
    const strength = (0.45 + 0.55 * (1 - ts.dayLight)) * (1 - storm * 2);
    if (strength <= 0) return;
    ctx.fillStyle = pal.mote;
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.x += Math.sin(wt * 0.4 + m.phase) * 6 * dt;
      if (m.y < H * 0.5) {
        m.y = H * (0.92 + Math.random() * 0.1);
        m.x = Math.random() * this.cssW();
      }
      ctx.globalAlpha = 0.22 * strength * (0.5 + 0.5 * Math.sin(wt * 0.9 + m.phase));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // --------------------------------------------------------------- weather

  private updateRain(
    ctx: CanvasRenderingContext2D,
    wt: number,
    dt: number,
    W: number,
    H: number,
    storm: number
  ) {
    const targetCount = Math.round(RAIN_POOL * storm * (this.tier <= 2 ? 0.5 : 1));
    while (this.rain.length < targetCount) {
      this.rain.push({
        x: Math.random() * (W + 100) - 50,
        y: Math.random() * H,
        len: 9 + Math.random() * 8,
        speed: 560 + Math.random() * 300,
      });
    }
    if (this.rain.length > targetCount) this.rain.length = targetCount;
    if (!this.rain.length) return;

    const pal = this.pal!;
    const slant = this.windBase(W / 2, wt) * 60 + storm * 50;
    ctx.strokeStyle = hexToRgba(pal.rain, 0.17);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const d of this.rain) {
      d.y += d.speed * dt;
      d.x += slant * dt;
      if (d.y > H + 20) {
        d.y = -20 - Math.random() * 40;
        d.x = Math.random() * (W + 100) - 50;
      }
      const dx = (slant / d.speed) * d.len;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - dx, d.y - d.len);
    }
    ctx.stroke();
  }

  private makeBolt(W: number, H: number): [number, number][][] {
    const paths: [number, number][][] = [];
    const x0 = W * (0.15 + Math.random() * 0.7);
    const yEnd = H * (0.42 + Math.random() * 0.13);
    const main: [number, number][] = [[x0, H * 0.02]];
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const prev = main[i - 1];
      main.push([
        prev[0] + (Math.random() - 0.5) * W * 0.045,
        H * 0.02 + ((yEnd - H * 0.02) * i) / steps,
      ]);
    }
    paths.push(main);
    // one fork partway down
    const forkAt = main[3 + Math.floor(Math.random() * 3)];
    const fork: [number, number][] = [forkAt];
    for (let i = 1; i <= 3; i++) {
      const prev = fork[i - 1];
      fork.push([prev[0] + (Math.random() * 0.5 + 0.2) * W * 0.03, prev[1] + H * 0.045]);
    }
    paths.push(fork);
    return paths;
  }

  private drawLightning(ctx: CanvasRenderingContext2D, W: number, H: number, storm: number) {
    const pal = this.pal!;
    if (this.boltPts.length && this.boltAge < 0.22) {
      const flicker = 0.55 + 0.45 * Math.sin(this.boltAge * 200);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const path of this.boltPts) {
        ctx.strokeStyle = hexToRgba(pal.boltGlow, 0.3 * flicker);
        ctx.lineWidth = 6;
        ctx.beginPath();
        path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
        ctx.strokeStyle = hexToRgba(pal.boltCore, 0.9 * flicker);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        path.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      }
    }
    if (this.flashA > 0.01) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = hexToRgba(pal.boltGlow, this.flashA * 0.13 * storm);
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // ------------------------------------------------------------- contract

  pulse(originNdc: [number, number], strength: number) {
    const W = this.cssW();
    if (!W) return;
    const x = ((originNdc[0] + 1) / 2) * W;
    this.gusts.push({
      x: x - W * 0.1,
      born: this.lastT,
      strength: (0.5 + strength * 0.7) * (1 + this.stormT * 0.5),
      speed: W * 0.14,
      width: W * 0.13,
    });
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

  setParams(p: EngineParams) {
    if (typeof p.tier === "number") {
      this.tier = p.tier as 1 | 2 | 3;
      this.builtKey = "";
    }
    if (typeof p.hour === "number") this.hourOverride = p.hour;
    const w = parseWeather(p.weather);
    if (w) this.weatherOverride = w;
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    this.dpr = this.tier >= 3 ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    canvas.width = canvas.clientWidth * this.dpr;
    canvas.height = canvas.clientHeight * this.dpr;
    this.clouds = []; // re-seed for the new geometry
    this.rebuildAll();
  }

  dispose() {
    growthBus.removeEventListener("growth-hour", this.onHour);
    this.ctx = null;
    this.canvas = undefined;
    this.far = undefined;
    this.near = undefined;
    this.sprites = [];
    this.bokehSprites = [];
    this.cloudSprites = [];
    this.buckets = [];
    this.bushes = [];
    this.petals = [];
    this.gusts = [];
    this.rain = [];
    this.clouds = [];
  }
}
