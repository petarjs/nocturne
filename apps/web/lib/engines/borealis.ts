import * as THREE from "three";
import { formatHex, interpolate } from "culori";
import type { ThemeTokens, Mood } from "@/lib/schema";
import type { BackgroundEngine, EngineParams } from "./types";
import { vertexShader, borealisFragmentShader } from "./shaders";

const MAX_PULSES = 4;

type Pulse = { origin: [number, number]; age: number; strength: number };

function colorToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/** OKLCH blend so the alert repaint runs green → ember → crimson without
 * muddy RGB midpoints (§6.5 uses the same space for theme morphs). */
function mixOklch(a: string, b: string, t: number): THREE.Vector3 {
  return colorToVec3(formatHex(interpolate([a, b], "oklch")(t)) ?? a);
}

/** Peak-of-the-wave color: accent1 lifted most of the way to white, so the
 * hottest ridges read as light, not paint. */
function hotColor(theme: ThemeTokens): THREE.Vector3 {
  const c = new THREE.Color(theme.palette.accent1).lerp(new THREE.Color("#ffffff"), 0.62);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/**
 * `borealis` — curtains of green neon light over an emerald void. Three
 * vertical-striated wave layers flow leftward at separated speeds; crests
 * rise and sink while the glow breathes; a gleam sweeps along each ridge.
 *
 * Moods are physics here, not just dim/vignette: the engine integrates a
 * mood-warped clock (alert ≈ 2.3× pace, focus/sleep ≈ 0.55×) so tempo
 * changes glide instead of jumping, and an eased alert ramp repaints the
 * curtains through OKLCH stops while a tremor runs through the ridges.
 * Pulses bend the near layers hardest — data ripples read as depth.
 *
 * Params: `flow` (leftward speed ×), `breath` (swell amplitude 0–1),
 * `intensity` (global gain ×).
 */
export class BorealisEngine implements BackgroundEngine {
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
  private warpedT = 0;
  private baseSpeed = 1;

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    if (this.renderer) this.releaseGpu();

    this.canvas = canvas;
    this.theme = theme;
    this.params = params;
    this.baseSpeed = (theme.motion.speed || 1) * this.num("flow", 1);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    canvas.addEventListener("webglcontextlost", this.contextLostHandler);
    canvas.addEventListener("webglcontextrestored", this.contextRestoredHandler);

    this.buildMaterial(theme);
    this.resize();
  }

  private num(key: string, fallback: number): number {
    const fromInit = this.params[key];
    if (typeof fromInit === "number") return fromInit;
    const fromTheme = this.theme?.background.params?.[key];
    return typeof fromTheme === "number" ? fromTheme : fallback;
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
    this.baseSpeed = (theme.motion.speed || 1) * this.num("flow", 1);
    if (!this.material) return;
    const p = theme.palette;
    const u = this.material.uniforms;
    u.uBreath.value = this.num("breath", 0.45);
    u.uIntensity.value = this.num("intensity", 1);
    u.uColorBg.value.copy(colorToVec3(p.bg0));
    u.uColorA.value.copy(colorToVec3(p.accent1));
    u.uColorB.value.copy(colorToVec3(p.accent2));
    u.uColorHot.value.copy(hotColor(theme));
    u.uAlertHi.value.copy(mixOklch(p.accent1, p.negative, 0.82));
    u.uAlertMid.value.copy(mixOklch(p.accent1, p.negative, 0.45));
    u.uAlertLo.value.copy(mixOklch(p.accent2, p.negative, 0.6));
    u.uAlertHot.value.copy(mixOklch(p.negative, "#ffffff", 0.55));
    u.uVignetteColor.value.copy(colorToVec3(p.negative));
  }

  private buildMaterial(theme: ThemeTokens) {
    const p = theme.palette;
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: borealisFragmentShader,
      uniforms: {
        uTime: { value: this.warpedT },
        uRes: { value: new THREE.Vector2(1, 1) },
        uColorBg: { value: colorToVec3(p.bg0) },
        uColorA: { value: colorToVec3(p.accent1) },
        uColorB: { value: colorToVec3(p.accent2) },
        uColorHot: { value: hotColor(theme) },
        uAlertHi: { value: mixOklch(p.accent1, p.negative, 0.82) },
        uAlertMid: { value: mixOklch(p.accent1, p.negative, 0.45) },
        uAlertLo: { value: mixOklch(p.accent2, p.negative, 0.6) },
        uAlertHot: { value: mixOklch(p.negative, "#ffffff", 0.55) },
        uAlert: { value: this.alertT },
        uCalm: { value: this.calmT },
        uVignette: { value: 0 },
        uVignetteColor: { value: colorToVec3(p.negative) },
        uDim: { value: 1 },
        uBreath: { value: this.num("breath", 0.45) },
        uIntensity: { value: this.num("intensity", 1) },
        uDrift: { value: new THREE.Vector2(0, 0) },
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

    // eased mood ramps + integrated pace: tempo glides, never jumps
    const targetAlert = this.mood === "alert" ? 1 : 0;
    const targetCalm = this.mood === "focus" ? 0.6 : this.mood === "sleep" ? 1 : 0;
    this.alertT += (targetAlert - this.alertT) * Math.min(1, dt / 1.2);
    this.calmT += (targetCalm - this.calmT) * Math.min(1, dt / 1.6);
    const pace = (1 + this.alertT * 1.35) * (1 - this.calmT * 0.45);
    this.warpedT += dt * this.baseSpeed * pace;

    const u = this.material.uniforms;
    u.uTime.value = this.warpedT;
    u.uAlert.value = this.alertT;
    u.uCalm.value = this.calmT;

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
    // a remount mid-alert must come back stormy, not calm — Background calls
    // setMood right after init, before the first tick
    if (!this.lastTime) {
      this.alertT = mood === "alert" ? 1 : 0;
      this.calmT = mood === "focus" ? 0.6 : mood === "sleep" ? 1 : 0;
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
    this.releaseGpu();
    this.canvas = undefined;
  }
}
