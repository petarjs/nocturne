import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";

/**
 * `flat` (§4.7, §5.1): the tier-1 / no-WebGL fallback. A slow two-stop
 * gradient hue drift on a 2D canvas — every theme automatically maps to
 * this at tier 1, with its own palette. Still has the mandatory grain
 * (§2.3 rule 9) and still honors vignette/dim so alert/sleep read the same
 * regardless of tier.
 */
export class FlatEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 1;

  private ctx: CanvasRenderingContext2D | null = null;
  private canvas?: HTMLCanvasElement;
  private theme?: ThemeTokens;
  private vignette = 0;
  private vignetteColor = "#000000";
  private dimAmount = 1;
  private grain?: ImageData;

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, _params?: EngineParams) {
    this.canvas = canvas;
    this.theme = theme;
    this.ctx = canvas.getContext("2d");
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
  }

  setParams(_p: EngineParams) {}

  tick(t: number) {
    const ctx = this.ctx;
    const canvas = this.canvas;
    const theme = this.theme;
    if (!ctx || !canvas || !theme) return;

    const w = canvas.width;
    const h = canvas.height;
    const hueDrift = (Math.sin(t * 0.02) + 1) / 2; // slow drift, minutes-scale

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, theme.palette.bg0);
    grad.addColorStop(1, mix(theme.palette.bg1, theme.palette.accent1, hueDrift * 0.15));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

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

    if (this.grain) ctx.putImageData(this.grain, 0, 0);
  }

  pulse() {
    // flat has no field to bend — pulses are a no-op at this tier, by design
  }

  setVignette(v: number, color: string) {
    this.vignette = v;
    this.vignetteColor = color;
  }

  dim(v: number) {
    this.dimAmount = v;
  }

  setMood(_mood: Mood) {}

  resize() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    this.grain = buildGrain(ctx, canvas.width, canvas.height);
  }

  dispose() {}
}

function buildGrain(ctx: CanvasRenderingContext2D, w: number, h: number): ImageData {
  const image = ctx.createImageData(w, h);
  for (let i = 0; i < image.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 0.035 * 255;
    image.data[i] = 0;
    image.data[i + 1] = 0;
    image.data[i + 2] = 0;
    image.data[i + 3] = Math.abs(n);
  }
  return image;
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(hexA: string, hexB: string, t: number): string {
  const a = hexA.replace("#", "");
  const b = hexB.replace("#", "");
  const ar = parseInt(a.substring(0, 2), 16);
  const ag = parseInt(a.substring(2, 4), 16);
  const ab = parseInt(a.substring(4, 6), 16);
  const br = parseInt(b.substring(0, 2), 16);
  const bg = parseInt(b.substring(2, 4), 16);
  const bb = parseInt(b.substring(4, 6), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
