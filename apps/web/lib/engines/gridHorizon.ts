import * as THREE from "three";
import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";
import { vertexShader, gridHorizonFragmentShader } from "./shaders";

const MAX_PULSES = 4;

type Pulse = { origin: [number, number]; age: number; strength: number };

function colorToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

/** Perspective grid floor with fog and stars (§5.3). Noir / Synthwave. */
export class GridHorizonEngine implements BackgroundEngine {
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

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, _params: EngineParams) {
    if (this.renderer) this.releaseGpu();

    this.canvas = canvas;
    this.theme = theme;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    canvas.addEventListener("webglcontextlost", this.contextLostHandler);
    canvas.addEventListener("webglcontextrestored", this.contextRestoredHandler);

    this.buildMaterial(theme);
    this.resize();
  }

  syncTheme(theme: ThemeTokens) {
    this.theme = theme;
    if (!this.material) return;

    const preset = theme.background.preset ?? "default";
    const isSunset = preset === "sunset";
    const u = this.material.uniforms;

    u.uColorBg.value.copy(colorToVec3(theme.palette.bg0));
    u.uColorGrid.value.copy(colorToVec3(theme.palette.accent1));
    u.uColorFog.value.copy(colorToVec3(theme.palette.bg1));
    u.uColorSky.value.copy(colorToVec3(theme.palette.text2));
    u.uVignetteColor.value.copy(colorToVec3(theme.palette.negative));
    u.uSunColorA.value.copy(colorToVec3(theme.palette.accent1));
    u.uSunColorB.value.copy(colorToVec3(theme.palette.accent2));
    u.uDensity.value = isSunset ? 5.0 : 4.0;
    u.uFog.value = isSunset ? 2.2 : 3.5;
    u.uSunset.value = isSunset ? 1 : 0;
  }

  private buildMaterial(theme: ThemeTokens) {
    const preset = theme.background.preset ?? "default";
    const isSunset = preset === "sunset";

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: gridHorizonFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 0.03 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uColorBg: { value: colorToVec3(theme.palette.bg0) },
        uColorGrid: { value: colorToVec3(theme.palette.accent1) },
        uColorFog: { value: colorToVec3(theme.palette.bg1) },
        uColorSky: { value: colorToVec3(theme.palette.text2) },
        uVignette: { value: 0 },
        uVignetteColor: { value: colorToVec3(theme.palette.negative) },
        uDim: { value: 1 },
        uDensity: { value: isSunset ? 5.0 : 4.0 },
        uFog: { value: isSunset ? 2.2 : 3.5 },
        uSunset: { value: isSunset ? 1 : 0 },
        uSunColorA: { value: colorToVec3(theme.palette.accent1) },
        uSunColorB: { value: colorToVec3(theme.palette.accent2) },
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
    this.init(this.canvas, this.theme, {});
  }

  tick(t: number) {
    if (!this.renderer || !this.material) return;
    const dt = this.lastTime ? t - this.lastTime : 0;
    this.lastTime = t;

    const u = this.material.uniforms;
    u.uTime.value = t;

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

  setMood(_mood: Mood) {}

  setParams(_p: EngineParams) {}

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
