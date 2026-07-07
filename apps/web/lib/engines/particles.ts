import type { ThemeTokens, Mood } from "@/lib/schema";
import type { BackgroundEngine, EngineParams } from "./types";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  rot: number;
  rotSpeed: number;
  layer: number;
  brightness: number;
};

type Preset = "starfield" | "petals" | "motes";

const STARFIELD_LAYERS = [
  { sizeMin: 0.4, sizeMax: 1.0, brightness: 0.45, drift: 0.6 },
  { sizeMin: 0.8, sizeMax: 1.6, brightness: 0.7, drift: 1.0 },
  { sizeMin: 1.2, sizeMax: 2.4, brightness: 1.0, drift: 1.4 },
];

/**
 * Canvas particle system (§5.4). Presets: starfield (900 pts, 3 parallax layers),
 * petals (≤120), motes (Requiem).
 */
export class ParticlesEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private preset: Preset = "petals";
  private particles: Particle[] = [];
  private tier: 1 | 2 | 3 = 3;
  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;
  private pulseImpulses: { x: number; y: number; age: number; strength: number }[] = [];

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.tier = (params.tier as 1 | 2 | 3) ?? 3;
    this.preset =
      (params.preset as Preset) ?? (theme.background.preset as Preset) ?? "petals";
    this.spawnParticles();
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
  }

  private particleCount(): number {
    const tierScale = this.tier <= 2 ? 0.5 : 1;
    if (this.preset === "starfield") return Math.round(900 * tierScale);
    if (this.preset === "motes") return Math.round(60 * tierScale);
    return Math.round(55 * tierScale);
  }

  private spawnParticles() {
    const count = this.particleCount();
    this.particles = Array.from({ length: count }, () => this.makeParticle(true));
  }

  private makeParticle(randomY = false): Particle {
    const w = this.canvas?.clientWidth ?? 1920;
    const h = this.canvas?.clientHeight ?? 1080;

    if (this.preset === "starfield") {
      const layerIdx = Math.floor(Math.random() * STARFIELD_LAYERS.length);
      const layer = STARFIELD_LAYERS[layerIdx];
      const driftPxPerMin = 2 * layer.drift;
      const driftPerFrame = driftPxPerMin / 60 / 60;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * driftPerFrame * 0.3,
        vy: driftPerFrame * (0.5 + Math.random() * 0.5),
        size: layer.sizeMin + Math.random() * (layer.sizeMax - layer.sizeMin),
        phase: Math.random() * Math.PI * 2,
        rot: 0,
        rotSpeed: 0,
        layer: layerIdx,
        brightness: layer.brightness,
      };
    }

    if (this.preset === "motes") {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -(Math.random() * 0.15 + 0.05),
        size: Math.random() * 2.5 + 1,
        phase: Math.random() * Math.PI * 2,
        rot: 0,
        rotSpeed: 0,
        layer: 0,
        brightness: 1,
      };
    }

    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 - Math.random() * h * 0.3,
      vx: (Math.random() - 0.5) * 0.25,
      vy: Math.random() * 0.25 + 0.18,
      size: Math.random() * 4 + 3,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.015,
      layer: 0,
      brightness: 0.45 + Math.random() * 0.25,
    };
  }

  tick(t: number) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    if (!ctx || !canvas || !theme) return;

    const w = canvas.width;
    const h = canvas.height;
    const scaleX = w / canvas.clientWidth;
    const scaleY = h / canvas.clientHeight;

    ctx.fillStyle = theme.palette.bg0;
    ctx.fillRect(0, 0, w, h);

    const wash = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.7);
    const washAlpha = this.preset === "petals" ? 0.02 : 0.06;
    wash.addColorStop(0, hexToRgba(theme.palette.accent2, washAlpha));
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    this.pulseImpulses.forEach((p) => (p.age += 1 / 60));
    this.pulseImpulses = this.pulseImpulses.filter((p) => p.age < 2);

    const sorted =
      this.preset === "starfield"
        ? [...this.particles].sort((a, b) => a.layer - b.layer)
        : this.particles;

    for (const p of sorted) {
      const flutter =
        this.preset === "petals" ? Math.sin(t * 1.8 + p.phase) * 0.4 : 0;
      p.x += (p.vx + flutter) * scaleX;
      p.y += p.vy * scaleY;
      p.rot += p.rotSpeed;

      for (const impulse of this.pulseImpulses) {
        const dx = p.x - impulse.x * scaleX;
        const dy = p.y - impulse.y * scaleY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 180 * scaleX) {
          const force = (1 - d / (180 * scaleX)) * impulse.strength * 0.8;
          p.vx += (dx / (d || 1)) * force * 0.3;
          p.vy += (dy / (d || 1)) * force * 0.3;
        }
      }

      if (p.x < -20 * scaleX) p.x = w + 20 * scaleX;
      if (p.x > w + 20 * scaleX) p.x = -20 * scaleX;
      if (p.y > h + 30 * scaleY) Object.assign(p, this.makeParticle());

      this.drawParticle(ctx, p, t, theme);
    }

    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 800; i++) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      const g = (Math.random() - 0.5) * 255;
      ctx.fillStyle =
        g > 0 ? `rgba(255,255,255,${Math.abs(g) / 255})` : `rgba(0,0,0,${Math.abs(g) / 255})`;
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;

    if (this.dimAmount < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - this.dimAmount})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.vignette > 0) {
      const r = Math.max(w, h) * 0.75;
      const rg = ctx.createRadialGradient(w / 2, h / 2, r * 0.5, w / 2, h / 2, r);
      rg.addColorStop(0, "rgba(0,0,0,0)");
      rg.addColorStop(1, hexToRgba(this.vignetteColor, this.vignette * 0.6));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawParticle(
    ctx: CanvasRenderingContext2D,
    p: Particle,
    t: number,
    theme: ThemeTokens
  ) {
    const twinkle =
      this.preset === "starfield"
        ? 0.35 + 0.65 * Math.sin(t * (1.2 + p.layer * 0.4) + p.phase)
        : 1;
    const color =
      this.preset === "petals"
        ? theme.palette.accent1
        : this.preset === "motes"
          ? theme.palette.accent2
          : theme.palette.text2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha =
      twinkle *
      p.brightness *
      (this.preset === "motes" ? 0.35 : this.preset === "starfield" ? 0.85 : 0.38);

    if (this.preset === "petals") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  pulse(originNdc: [number, number], strength: number) {
    const canvas = this.canvas;
    if (!canvas) return;
    const x = ((originNdc[0] + 1) / 2) * canvas.clientWidth;
    const y = ((1 - originNdc[1]) / 2) * canvas.clientHeight;
    this.pulseImpulses.push({ x, y, age: 0, strength });
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
    if (typeof p.preset === "string") {
      this.preset = p.preset as Preset;
      this.spawnParticles();
    }
    if (typeof p.tier === "number") {
      this.tier = p.tier as 1 | 2 | 3;
      this.spawnParticles();
    }
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  dispose() {
    this.ctx = null;
    this.canvas = undefined;
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
