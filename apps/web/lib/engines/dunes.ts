import * as THREE from "three";
import { formatHex, interpolate } from "culori";
import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";
import { vertexShader, dunesFragmentShader } from "./shaders";
import { growthBus, type GrowthHourEvent } from "./growthBus";

const MAX_PULSES = 4;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Continuous night amount (0 day → 1 night) from the wall clock — dawn
 * breaks 5:15–7:00, dusk falls 18:15–20:00, matching the meadow engine's
 * time-of-day feel so any theme on local time reads consistently. */
function nightFromHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.25) return 1;
  if (h < 7) return 1 - smoothstep(5.25, 7, h);
  if (h < 18.25) return 0;
  if (h < 20) return smoothstep(18.25, 20, h);
  return 1;
}

type Pulse = { origin: [number, number]; age: number; strength: number };

function colorToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/** OKLCH blend — mood repaints travel through clean perceptual midpoints,
 * never muddy RGB averages (§6.5 uses the same space for theme morphs). */
function ok(a: string, b: string, t: number): string {
  return formatHex(interpolate([a, b], "oklch")(t)) ?? a;
}

/** The scene's paintbox: every color the shader takes, as hex. Three full
 * sets exist (day / night / storm) and the tick blends between them. */
type SceneColors = {
  skyTop: string;
  skyMid: string;
  skyHor: string;
  sunGlow: string;
  cloudHi: string;
  cloudLo: string;
  duneLit: string;
  duneShade: string;
  haze: string;
  glint: string;
};

type SceneScalars = {
  sun: number;
  moon: number;
  stars: number;
  cover: number;
  glint: number;
  stream: number;
};

const COLOR_UNIFORMS: Record<keyof SceneColors, string> = {
  skyTop: "uSkyTop",
  skyMid: "uSkyMid",
  skyHor: "uSkyHor",
  sunGlow: "uSunGlow",
  cloudHi: "uCloudHi",
  cloudLo: "uCloudLo",
  duneLit: "uDuneLit",
  duneShade: "uDuneShade",
  haze: "uHaze",
  glint: "uGlint",
};

/** Permanent golden hour, derived entirely from theme tokens so any palette
 * drives the same desert — Pastel Dunes just wears it best. */
function dayColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const rose = p.accent1;
  const peri = p.accent2;
  return {
    skyTop: ok(peri, p.bg0, 0.15),
    skyMid: ok(ok(peri, rose, 0.28), p.text1, 0.26),
    skyHor: ok(rose, p.text1, 0.48),
    sunGlow: ok(rose, "#FFF3E0", 0.62),
    cloudHi: ok(ok(rose, p.text1, 0.75), "#FFFFFF", 0.25),
    cloudLo: ok(ok(peri, rose, 0.55), p.bg0, 0.22),
    duneLit: ok(ok(peri, rose, 0.42), p.text1, 0.34),
    duneShade: ok(ok(peri, p.bg0, 0.56), rose, 0.12),
    haze: ok(ok(rose, peri, 0.5), p.text1, 0.48),
    glint: ok(p.text1, "#FFFFFF", 0.5),
  };
}

/** Sleep: the desert after dark — indigo sky, moon-silvered crests. Lives
 * beneath the global starfield overlay, which fades in above it. */
function nightColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const moonlight = ok(p.text1, p.accent2, 0.35);
  return {
    skyTop: ok(p.bg0, "#060819", 0.55),
    skyMid: ok(p.bg0, p.accent2, 0.2),
    skyHor: ok(ok(p.bg0, p.accent2, 0.32), p.text1, 0.08),
    sunGlow: moonlight,
    cloudHi: ok(ok(p.accent2, p.text1, 0.35), p.bg0, 0.3),
    cloudLo: ok(p.bg0, p.accent2, 0.14),
    duneLit: ok(ok(p.accent2, p.bg0, 0.35), p.text1, 0.16),
    duneShade: ok(p.bg0, "#05060F", 0.4),
    haze: ok(p.bg0, p.accent2, 0.28),
    glint: p.text1,
  };
}

/** Alert: the pastel drains into a bruised ember storm. */
function stormColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const day = dayColors(theme);
  return {
    skyTop: ok(ok(p.accent2, p.bg0, 0.42), p.negative, 0.3),
    skyMid: ok(ok(p.accent2, p.negative, 0.38), p.bg0, 0.3),
    skyHor: ok(p.negative, p.accent1, 0.35),
    sunGlow: ok(p.negative, "#FFD9A0", 0.4),
    cloudHi: ok(ok(p.accent1, p.negative, 0.42), p.text1, 0.24),
    cloudLo: ok(p.bg0, p.negative, 0.2),
    duneLit: ok(day.duneLit, p.negative, 0.32),
    duneShade: ok(ok(p.accent2, p.bg0, 0.6), p.negative, 0.2),
    haze: ok(p.negative, p.bg0, 0.5),
    glint: ok(p.text1, p.negative, 0.3),
  };
}

/**
 * `dunes` — a pastel desert at permanent golden hour: velvet dunes, drifting
 * sun-lit cumulus, cloud shadows crossing the sand (§5 background contract).
 *
 * Moods are weather and time, not just dim/vignette. The engine keeps three
 * OKLCH-blendable palettes (day / night / storm) plus scalar sets and eases
 * between them: `sleep` is dusk falling — moon, stars, silvered sand —
 * beneath the global starfield fade; `alert` rolls the sky over into a
 * racing ember storm with CPU-scheduled heat lightning; `focus` stills the
 * wind and the glitter. A mood-warped clock drives the wind so tempo glides,
 * never jumps. Pulses roll a wave of warm light across the sand.
 *
 * Params: `wind` (drift speed ×), `cloudCover` (0–1 ambient coverage),
 * `sunX` (sun position 0–1), `glint` (sand sparkle ×).
 */
export class DunesEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private material?: THREE.ShaderMaterial;
  private canvas?: HTMLCanvasElement;
  private pulses: Pulse[] = [];
  private driftPhase = Math.random() * 1000;
  private lastTime = 0;
  private contextLostHandler = (e: Event) => e.preventDefault();
  private contextRestoredHandler = () => this.rebuild();
  private theme?: ThemeTokens;
  private params: EngineParams = {};

  private mood: Mood = "ambient";
  private alertT = 0;
  private calmT = 0;
  private nightT = 0;
  private warpedT = 0;
  private baseSpeed = 1;

  private day?: SceneColors;
  private night?: SceneColors;
  private storm?: SceneColors;
  private appliedAlert = -1;
  private appliedNight = -1;
  private appliedCalm = -1;
  private paletteDirty = true;

  private flash = 0;
  private nextFlashAt = 0;

  // rolling dust cloud: a rare heartbeat-scheduled event (§4.6), not a
  // permanent fixture — "from time to time" per the desert reference
  private dustActive = false;
  private dustStart = 0;
  private dustDuration = 0;
  private dustSeed = 0;
  private nextDustAt = 6 + Math.random() * 20;

  private hourOverride: number | null = null;
  private clockNightT = 0;
  private onHour = (e: Event) => {
    this.hourOverride = (e as CustomEvent<GrowthHourEvent>).detail.hour;
  };

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    if (this.renderer) this.releaseGpu();

    this.canvas = canvas;
    this.params = params;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    // tier 2 renders at 1× and lets the browser upscale (§4.7)
    const tier = typeof params.tier === "number" ? params.tier : 3;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier >= 3 ? 2 : 1));

    canvas.addEventListener("webglcontextlost", this.contextLostHandler);
    canvas.addEventListener("webglcontextrestored", this.contextRestoredHandler);

    if (typeof params.hour === "number") this.hourOverride = params.hour;
    growthBus.removeEventListener("growth-hour", this.onHour);
    growthBus.addEventListener("growth-hour", this.onHour);

    this.buildMaterial();
    this.syncTheme(theme);
    this.resize();
  }

  private hourNow(): number {
    if (this.hourOverride !== null) return this.hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }

  private num(key: string, fallback: number): number {
    const fromInit = this.params[key];
    if (typeof fromInit === "number") return fromInit;
    const fromTheme = this.theme?.background.params?.[key];
    return typeof fromTheme === "number" ? fromTheme : fallback;
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
    this.baseSpeed = (theme.motion.speed || 1) * this.num("wind", 1);
    this.day = dayColors(theme);
    this.night = nightColors(theme);
    this.storm = stormColors(theme);
    this.paletteDirty = true;
    if (this.material) {
      this.material.uniforms.uSunX.value = this.num("sunX", 0.3);
      this.material.uniforms.uVignetteColor.value.copy(colorToVec3(theme.palette.negative));
    }
  }

  /** Scalar sets follow the same day/night/storm blend as the colors. */
  private blendScalars(): SceneScalars {
    const cover = Math.min(1, Math.max(0, this.num("cloudCover", 0.5)));
    const glint = this.num("glint", 1);
    const day: SceneScalars = { sun: 1, moon: 0, stars: 0, cover, glint, stream: 1 };
    const night: SceneScalars = { sun: 0, moon: 1, stars: 1, cover: 0.32, glint: glint * 0.4, stream: 0.25 };
    const storm: SceneScalars = { sun: 0.4, moon: 0, stars: 0, cover: 0.95, glint: glint * 0.3, stream: 1.6 };

    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const keys = Object.keys(day) as (keyof SceneScalars)[];
    const out = {} as SceneScalars;
    for (const k of keys) {
      out[k] = l(l(day[k], night[k], this.nightT), storm[k], this.alertT);
    }
    // focus stills the glitter and the streamers
    out.glint *= 1 - this.calmT * 0.7;
    out.stream *= 1 - this.calmT * 0.8;
    return out;
  }

  private applyMoodUniforms() {
    if (!this.material || !this.day || !this.night || !this.storm) return;
    const changed =
      this.paletteDirty ||
      Math.abs(this.alertT - this.appliedAlert) > 0.002 ||
      Math.abs(this.nightT - this.appliedNight) > 0.002 ||
      Math.abs(this.calmT - this.appliedCalm) > 0.002;
    if (!changed) return;
    this.appliedAlert = this.alertT;
    this.appliedNight = this.nightT;
    this.appliedCalm = this.calmT;
    this.paletteDirty = false;

    const u = this.material.uniforms;
    for (const key of Object.keys(COLOR_UNIFORMS) as (keyof SceneColors)[]) {
      const dusk = ok(this.day[key], this.night[key], this.nightT);
      u[COLOR_UNIFORMS[key]].value.copy(colorToVec3(ok(dusk, this.storm[key], this.alertT)));
    }
    const s = this.blendScalars();
    u.uSun.value = s.sun;
    u.uMoon.value = s.moon;
    u.uStars.value = s.stars;
    u.uCover.value = s.cover;
    u.uGlintK.value = s.glint;
    u.uStreamK.value = s.stream;
  }

  private buildMaterial() {
    const v3 = () => ({ value: new THREE.Vector3() });
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: dunesFragmentShader,
      uniforms: {
        uTime: { value: this.warpedT },
        uRes: { value: new THREE.Vector2(1, 1) },
        uDrift: { value: new THREE.Vector2(0, 0) },
        uSkyTop: v3(),
        uSkyMid: v3(),
        uSkyHor: v3(),
        uSunGlow: v3(),
        uCloudHi: v3(),
        uCloudLo: v3(),
        uDuneLit: v3(),
        uDuneShade: v3(),
        uHaze: v3(),
        uGlint: v3(),
        uSun: { value: 1 },
        uMoon: { value: 0 },
        uStars: { value: 0 },
        uCover: { value: 0.5 },
        uGlintK: { value: 1 },
        uStreamK: { value: 1 },
        uFlash: { value: 0 },
        uDustXFar: { value: -2 },
        uDustXNear: { value: -2 },
        uDustAFar: { value: 0 },
        uDustANear: { value: 0 },
        uDustSeed: { value: 0 },
        uSunX: { value: 0.3 },
        uVignette: { value: 0 },
        uVignetteColor: { value: new THREE.Vector3(0, 0, 0) },
        uDim: { value: 1 },
        uPulseOrigin: { value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector2(0, 0)) },
        uPulseAge: { value: new Float32Array(MAX_PULSES).fill(-1) },
        uPulseStrength: { value: new Float32Array(MAX_PULSES).fill(0) },
      },
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    this.scene.clear();
    this.scene.add(new THREE.Mesh(geometry, this.material));
  }

  private rebuild() {
    if (!this.canvas || !this.theme) return;
    this.init(this.canvas, this.theme, this.params);
  }

  tick(t: number) {
    if (!this.renderer || !this.material) return;
    const dt = this.lastTime ? Math.min(0.1, Math.max(0, t - this.lastTime)) : 0;
    this.lastTime = t;

    // eased mood ramps + integrated pace: the wind glides, never jumps
    const targetAlert = this.mood === "alert" ? 1 : 0;
    // the sky follows the wall clock; `sleep` mood force-commits to full night
    const targetClockNight = nightFromHour(this.hourNow());
    this.clockNightT += (targetClockNight - this.clockNightT) * Math.min(1, dt / 3.0);
    const targetNight = Math.max(this.clockNightT, this.mood === "sleep" ? 1 : 0);
    const targetCalm = this.mood === "focus" ? 0.65 : this.mood === "sleep" ? 1 : 0;
    this.alertT += (targetAlert - this.alertT) * Math.min(1, dt / 1.2);
    this.nightT += (targetNight - this.nightT) * Math.min(1, dt / 2.0);
    this.calmT += (targetCalm - this.calmT) * Math.min(1, dt / 1.6);
    const pace = (1 + this.alertT * 1.7) * (1 - this.calmT * 0.5);
    this.warpedT += dt * this.baseSpeed * pace;

    // heat lightning: sparse strikes, sometimes a 140ms double-strobe
    if (this.alertT > 0.5 && t >= this.nextFlashAt) {
      this.flash = 0.7 + Math.random() * 0.45;
      this.nextFlashAt = t + (Math.random() < 0.3 ? 0.14 : 3.5 + Math.random() * 6.5);
    }
    this.flash *= Math.exp(-dt * 6.5);

    this.applyMoodUniforms();

    const u = this.material.uniforms;
    u.uTime.value = this.warpedT;
    u.uFlash.value = this.flash < 0.004 ? 0 : this.flash;

    // rolling dust cloud: rare, wind-scheduled, never during sleep/alert —
    // this is weather, not a status effect
    if (!this.dustActive && this.mood !== "sleep" && this.mood !== "alert" && t >= this.nextDustAt) {
      this.dustActive = true;
      this.dustStart = t;
      this.dustDuration = 22 + Math.random() * 16;
      this.dustSeed = Math.random() * 90;
    }
    if (this.dustActive) {
      const dur = this.dustDuration;
      // near layer crosses in the base duration; far layer lags ~1.7×
      // slower, giving the pair visible parallax separation
      const progNear = Math.min(1, (t - this.dustStart) / dur);
      const progFar = Math.min(1, (t - this.dustStart) / (dur * 1.7));
      const envNear = smoothstep(0, 0.1, progNear) * (1 - smoothstep(0.82, 1, progNear));
      const envFar = smoothstep(0, 0.14, progFar) * (1 - smoothstep(0.82, 1, progFar));
      u.uDustXNear.value = 1.35 - 1.7 * progNear;
      u.uDustXFar.value = 1.25 - 1.55 * progFar;
      u.uDustANear.value = envNear * this.baseSpeed;
      u.uDustAFar.value = envFar * 0.6 * this.baseSpeed;
      u.uDustSeed.value = this.dustSeed;
      if (progNear >= 1 && progFar >= 1) {
        this.dustActive = false;
        this.nextDustAt = t + 50 + Math.random() * 110;
      }
    } else {
      u.uDustANear.value = 0;
      u.uDustAFar.value = 0;
    }

    // ±6px drift over a 10-minute cycle — the OLED burn-in guard (§5.1).
    // Wall-clock time: the guard must not slow down with the mood.
    const cycle = (t / 600) * Math.PI * 2 + this.driftPhase;
    u.uDrift.value.set(Math.sin(cycle) * 6, Math.cos(cycle * 0.7) * 6);

    this.pulses.forEach((p) => (p.age += dt));
    this.pulses = this.pulses.filter((p) => p.age < 3);
    for (let i = 0; i < MAX_PULSES; i++) {
      const p = this.pulses[i];
      u.uPulseOrigin.value[i].set(p ? p.origin[0] : 0, p ? p.origin[1] : 0);
      u.uPulseAge.value[i] = p ? p.age : -1;
      u.uPulseStrength.value[i] = p ? p.strength : 0;
    }

    this.renderer.render(this.scene, this.camera);
  }

  pulse(originNdc: [number, number], strength: number) {
    const uv: [number, number] = [(originNdc[0] + 1) / 2, (originNdc[1] + 1) / 2];
    if (this.pulses.length >= MAX_PULSES) this.pulses.shift();
    this.pulses.push({ origin: uv, age: 0, strength });
  }

  setVignette(v: number, color: string) {
    if (!this.material) return;
    this.material.uniforms.uVignette.value = v;
    this.material.uniforms.uVignetteColor.value.copy(colorToVec3(color));
  }

  dim(v: number) {
    if (!this.material) return;
    this.material.uniforms.uDim.value = v;
  }

  setMood(mood: Mood) {
    this.mood = mood;
    // a remount mid-alert must come back stormy, mid-sleep moonlit —
    // Background calls setMood right after init, before the first tick
    if (!this.lastTime) {
      const hourNight = nightFromHour(this.hourNow());
      this.alertT = mood === "alert" ? 1 : 0;
      this.clockNightT = hourNight;
      this.nightT = Math.max(hourNight, mood === "sleep" ? 1 : 0);
      this.calmT = mood === "focus" ? 0.65 : mood === "sleep" ? 1 : 0;
    }
  }

  setParams(p: EngineParams) {
    this.params = { ...this.params, ...p };
    if (this.theme) this.syncTheme(this.theme);
  }

  resize() {
    if (!this.renderer || !this.canvas || !this.material) return;
    const { clientWidth, clientHeight } = this.canvas;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.material.uniforms.uRes.value.set(clientWidth, clientHeight);
  }

  private releaseGpu() {
    this.material?.dispose();
    this.renderer?.dispose();
    this.material = undefined;
    this.renderer = undefined;
  }

  dispose() {
    this.canvas?.removeEventListener("webglcontextlost", this.contextLostHandler);
    this.canvas?.removeEventListener("webglcontextrestored", this.contextRestoredHandler);
    growthBus.removeEventListener("growth-hour", this.onHour);
    this.releaseGpu();
    this.canvas = undefined;
  }
}
