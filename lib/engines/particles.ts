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
};

type Preset = "starfield" | "petals" | "motes";

/**
 * Canvas particle system (§5.4). Presets: starfield (sleep/universal),
 * petals (Kanso interim until growth engine ships), motes (Requiem).
 */
export class ParticlesEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private preset: Preset = "petals";
  private particles: Particle[] = [];
  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;
  private pulseImpulses: { x: number; y: number; age: number; strength: number }[] = [];

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.preset = (theme.background.preset as Preset) ?? (params.preset as Preset) ?? "petals";
    this.spawnParticles();
    this.resize();
  }

  private spawnParticles() {
    const count =
      this.preset === "starfield" ? 280 : this.preset === "motes" ? 60 : 90;
    this.particles = Array.from({ length: count }, () => this.makeParticle(true));
  }

  private makeParticle(randomY = false): Particle {
    const w = this.canvas?.clientWidth ?? 1920;
    const h = this.canvas?.clientHeight ?? 1080;

    if (this.preset === "starfield") {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.08,
        vy: Math.random() * 0.04 + 0.01,
        size: Math.random() * 1.8 + 0.6,
        phase: Math.random() * Math.PI * 2,
        rot: 0,
        rotSpeed: 0,
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
      };
    }

    // petals — flutter down from above (Kanso interim)
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -20 - Math.random() * h * 0.3,
      vx: (Math.random() - 0.5) * 0.35,
      vy: Math.random() * 0.35 + 0.25,
      size: Math.random() * 7 + 5,
      phase: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
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

    // soft wash using accent2 at low opacity
    const wash = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.5, w * 0.7);
    wash.addColorStop(0, hexToRgba(theme.palette.accent2, 0.06));
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    this.pulseImpulses.forEach((p) => (p.age += 1 / 60));
    this.pulseImpulses = this.pulseImpulses.filter((p) => p.age < 2);

    for (const p of this.particles) {
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

    // mandatory grain (§2.3 rule 9)
    ctx.globalAlpha = 0.035;
    for (let i = 0; i < 800; i++) {
      const gx = Math.random() * w;
      const gy = Math.random() * h;
      const g = (Math.random() - 0.5) * 255;
      ctx.fillStyle = g > 0 ? `rgba(255,255,255,${Math.abs(g) / 255})` : `rgba(0,0,0,${Math.abs(g) / 255})`;
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

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle, t: number, theme: ThemeTokens) {
    const twinkle =
      this.preset === "starfield" ? 0.45 + 0.55 * Math.sin(t * 2 + p.phase) : 1;
    const color =
      this.preset === "petals"
        ? theme.palette.accent1
        : this.preset === "motes"
          ? theme.palette.accent2
          : theme.palette.text2;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = twinkle * (this.preset === "motes" ? 0.35 : 0.75);

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
  }

  resize() {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  dispose() {}
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
