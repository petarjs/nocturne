import * as THREE from "three";
import { formatHex, interpolate } from "culori";
import type { ThemeTokens, Mood } from "@nocturne/core";
import type { BackgroundEngine, EngineParams } from "./types";
import {
  grassBladeVertexShader,
  grassBladeFragmentShader,
  grassSkyVertexShader,
  grassSkyFragmentShader,
  grassPostVertexShader,
  grassBrightFragmentShader,
  grassBlurFragmentShader,
  grassCompositeFragmentShader,
} from "./shaders";
import { growthBus, type GrowthHourEvent } from "./growthBus";

const MAX_PULSES = 4;

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Continuous night amount (0 day → 1 night) from the wall clock — dawn
 * breaks 5:15–7:00, dusk falls 18:15–20:00, matching dunes/meadow. */
function nightFromHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5.25) return 1;
  if (h < 7) return 1 - smoothstep(5.25, 7, h);
  if (h < 18.25) return 0;
  if (h < 20) return smoothstep(18.25, 20, h);
  return 1;
}

/** Golden-hour amount: peaks around dawn (6–8) and dusk (17–19.5). */
function goldenFromHour(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  const dawn = smoothstep(5.5, 6.5, h) * (1 - smoothstep(7.5, 9, h));
  const dusk = smoothstep(16.5, 17.5, h) * (1 - smoothstep(19, 20.5, h));
  return Math.max(dawn, dusk);
}

type Pulse = { origin: [number, number]; age: number; strength: number };

function colorToVec3(hex: string): THREE.Vector3 {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
}

function ok(a: string, b: string, t: number): string {
  return formatHex(interpolate([a, b], "oklch")(t)) ?? a;
}

type SceneColors = {
  skyTop: string;
  skyMid: string;
  skyHor: string;
  sunGlow: string;
  grassDeep: string;
  grassMid: string;
  grassLit: string;
  grassTip: string;
  haze: string;
};

type SceneScalars = {
  sun: number;
  moon: number;
  stars: number;
  wind: number;
  gust: number;
  bloom: number;
};

function dayColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  return {
    skyTop: ok(p.text1, "#F7F2E6", 0.55),
    skyMid: ok(ok(p.accent1, p.text1, 0.5), "#EDE4C8", 0.4),
    skyHor: ok(ok(p.accent2, p.accent1, 0.35), "#E8DFC0", 0.45),
    sunGlow: ok(p.text1, "#FFF9EC", 0.75),
    grassDeep: ok(p.bg0, "#06100A", 0.55),
    grassMid: ok(p.accent2, "#2A3F24", 0.35),
    grassLit: ok(p.accent1, "#A8A05A", 0.45),
    grassTip: ok(p.text1, "#F2EBD4", 0.6),
    haze: ok(p.text1, "#F0E8D0", 0.45),
  };
}

function goldenColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const day = dayColors(theme);
  return {
    skyTop: ok(ok(p.accent2, p.bg0, 0.25), "#C4785A", 0.35),
    skyMid: ok(p.accent1, "#E8A070", 0.45),
    skyHor: ok(p.accent1, "#F5C890", 0.55),
    sunGlow: ok(p.accent1, "#FFE0B0", 0.5),
    grassDeep: ok(day.grassDeep, "#1A1208", 0.25),
    grassMid: ok(day.grassMid, p.accent1, 0.22),
    grassLit: ok(day.grassLit, "#E8B878", 0.4),
    grassTip: ok(p.text1, "#FFE8C0", 0.45),
    haze: ok(p.accent1, "#F0C8A0", 0.4),
  };
}

function nightColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const moonlight = ok(p.text1, p.accent2, 0.4);
  return {
    skyTop: ok(p.bg0, "#060819", 0.6),
    skyMid: ok(p.bg0, p.accent2, 0.22),
    skyHor: ok(ok(p.bg0, p.accent2, 0.28), p.text1, 0.06),
    sunGlow: moonlight,
    grassDeep: ok(p.bg0, "#040806", 0.5),
    grassMid: ok(ok(p.accent2, p.bg0, 0.45), "#0C1810", 0.3),
    grassLit: ok(p.accent2, p.text1, 0.25),
    grassTip: ok(p.text1, p.accent2, 0.35),
    haze: ok(p.bg0, p.accent2, 0.25),
  };
}

function stormColors(theme: ThemeTokens): SceneColors {
  const p = theme.palette;
  const day = dayColors(theme);
  return {
    skyTop: ok(ok(p.accent2, p.bg0, 0.4), p.negative, 0.28),
    skyMid: ok(ok(p.accent2, p.negative, 0.35), p.bg0, 0.28),
    skyHor: ok(p.negative, p.accent1, 0.4),
    sunGlow: ok(p.negative, "#FFD9A0", 0.45),
    grassDeep: ok(day.grassDeep, p.negative, 0.22),
    grassMid: ok(day.grassMid, p.negative, 0.28),
    grassLit: ok(day.grassLit, p.accent1, 0.35),
    grassTip: ok(p.text1, p.negative, 0.3),
    haze: ok(p.negative, p.bg0, 0.45),
  };
}

type BladeLayer = {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  count: number;
};

/**
 * `grass` — 3D instanced blade field: low-angle camera in the grass, tapered
 * soft-alpha quads with vertex wind, cream backlight, and a bloom/trail
 * composite for the long-exposure reference look (§5 background contract).
 *
 * Moods are weather and tempo: day/golden/night/storm palettes in OKLCH;
 * sleep force-commits to night; alert races the wind; focus stills it.
 * Params: `wind` (sway ×).
 */
export class GrassEngine implements BackgroundEngine {
  minTier: 1 | 2 | 3 = 2;

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private canvas?: HTMLCanvasElement;
  private pulses: Pulse[] = [];
  private driftPhase = Math.random() * 1000;
  private lastTime = 0;
  private contextLostHandler = (e: Event) => e.preventDefault();
  private contextRestoredHandler = () => this.rebuild();
  private theme?: ThemeTokens;
  private params: EngineParams = {};
  private tier: 1 | 2 | 3 = 3;

  private mood: Mood = "ambient";
  private alertT = 0;
  private calmT = 0;
  private nightT = 0;
  private goldenT = 0;
  private warpedT = 0;
  private baseSpeed = 1;

  private day?: SceneColors;
  private golden?: SceneColors;
  private night?: SceneColors;
  private storm?: SceneColors;
  private appliedAlert = -1;
  private appliedNight = -1;
  private appliedGolden = -1;
  private appliedCalm = -1;
  private paletteDirty = true;

  private hourOverride: number | null = null;
  private clockNightT = 0;
  private clockGoldenT = 0;
  private onHour = (e: Event) => {
    this.hourOverride = (e as CustomEvent<GrowthHourEvent>).detail.hour;
  };

  private skyMaterial?: THREE.ShaderMaterial;
  private bladeLayers: BladeLayer[] = [];

  // post: scene → bright → blurH → blurV → composite(+trail)
  private sceneTarget?: THREE.WebGLRenderTarget;
  private brightTarget?: THREE.WebGLRenderTarget;
  private blurTargetA?: THREE.WebGLRenderTarget;
  private blurTargetB?: THREE.WebGLRenderTarget;
  private trailTargetA?: THREE.WebGLRenderTarget;
  private trailTargetB?: THREE.WebGLRenderTarget;
  private trailFlip = false;
  private postScene = new THREE.Scene();
  private postCamera = new THREE.Camera();
  private postMesh?: THREE.Mesh;
  private brightMaterial?: THREE.ShaderMaterial;
  private blurMaterial?: THREE.ShaderMaterial;
  private compositeMaterial?: THREE.ShaderMaterial;
  private copyMaterial?: THREE.ShaderMaterial;
  private vignette = 0;
  private vignetteColor = new THREE.Vector3(1, 0.3, 0.3);
  private dimAmount = 1;
  private lastScalars?: SceneScalars;

  init(canvas: HTMLCanvasElement, theme: ThemeTokens, params: EngineParams) {
    if (this.renderer) this.releaseGpu();

    this.canvas = canvas;
    this.params = params;
    this.tier = typeof params.tier === "number" ? (params.tier as 1 | 2 | 3) : 3;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x070e09, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.tier >= 3 ? 1.5 : 1));
    this.renderer.autoClear = true;

    canvas.addEventListener("webglcontextlost", this.contextLostHandler);
    canvas.addEventListener("webglcontextrestored", this.contextRestoredHandler);

    if (typeof params.hour === "number") this.hourOverride = params.hour;
    growthBus.removeEventListener("growth-hour", this.onHour);
    growthBus.addEventListener("growth-hour", this.onHour);

    this.buildScene();
    this.buildPost();
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
    this.golden = goldenColors(theme);
    this.night = nightColors(theme);
    this.storm = stormColors(theme);
    this.paletteDirty = true;
    this.vignetteColor.copy(colorToVec3(theme.palette.negative));
  }

  private blendScalars(): SceneScalars {
    const windBase = this.num("wind", 1);
    const day: SceneScalars = { sun: 1, moon: 0, stars: 0, wind: windBase, gust: 0.15, bloom: 1 };
    const golden: SceneScalars = {
      sun: 1,
      moon: 0,
      stars: 0,
      wind: windBase * 0.85,
      gust: 0.1,
      bloom: 1.35,
    };
    const night: SceneScalars = {
      sun: 0,
      moon: 1,
      stars: 1,
      wind: windBase * 0.45,
      gust: 0.05,
      bloom: 0.4,
    };
    const storm: SceneScalars = {
      sun: 0.35,
      moon: 0,
      stars: 0,
      wind: windBase * 2.2,
      gust: 1.4,
      bloom: 0.75,
    };

    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const keys = Object.keys(day) as (keyof SceneScalars)[];
    const out = {} as SceneScalars;
    for (const k of keys) {
      const warm = l(day[k], golden[k], this.goldenT);
      const tod = l(warm, night[k], this.nightT);
      out[k] = l(tod, storm[k], this.alertT);
    }
    out.wind *= 1 - this.calmT * 0.7;
    out.gust *= 1 - this.calmT * 0.85;
    return out;
  }

  private applyMoodUniforms() {
    if (!this.skyMaterial || !this.day || !this.golden || !this.night || !this.storm) return;
    const changed =
      this.paletteDirty ||
      Math.abs(this.alertT - this.appliedAlert) > 0.002 ||
      Math.abs(this.nightT - this.appliedNight) > 0.002 ||
      Math.abs(this.goldenT - this.appliedGolden) > 0.002 ||
      Math.abs(this.calmT - this.appliedCalm) > 0.002;
    if (!changed && this.lastScalars) return;

    this.appliedAlert = this.alertT;
    this.appliedNight = this.nightT;
    this.appliedGolden = this.goldenT;
    this.appliedCalm = this.calmT;
    this.paletteDirty = false;

    const blend = (key: keyof SceneColors) => {
      const warm = ok(this.day![key], this.golden![key], this.goldenT);
      const tod = ok(warm, this.night![key], this.nightT);
      return colorToVec3(ok(tod, this.storm![key], this.alertT));
    };

    const skyTop = blend("skyTop");
    const skyMid = blend("skyMid");
    const skyHor = blend("skyHor");
    const sunGlow = blend("sunGlow");
    const grassDeep = blend("grassDeep");
    const grassMid = blend("grassMid");
    const grassLit = blend("grassLit");
    const grassTip = blend("grassTip");
    const haze = blend("haze");
    const s = this.blendScalars();
    this.lastScalars = s;

    const skyU = this.skyMaterial.uniforms;
    skyU.uSkyTop.value.copy(skyTop);
    skyU.uSkyMid.value.copy(skyMid);
    skyU.uSkyHor.value.copy(skyHor);
    skyU.uSunGlow.value.copy(sunGlow);
    skyU.uHaze.value.copy(haze);
    skyU.uSun.value = s.sun;
    skyU.uMoon.value = s.moon;
    skyU.uStars.value = s.stars;
    skyU.uBloom.value = s.bloom;

    for (const layer of this.bladeLayers) {
      const u = layer.material.uniforms;
      u.uGrassDeep.value.copy(grassDeep);
      u.uGrassMid.value.copy(grassMid);
      u.uGrassLit.value.copy(grassLit);
      u.uGrassTip.value.copy(grassTip);
      u.uSunGlow.value.copy(sunGlow);
      u.uBloom.value = s.bloom;
      u.uSun.value = s.sun;
      u.uMoon.value = s.moon;
      u.uWind.value = s.wind;
      u.uGust.value = s.gust;
    }

    if (this.compositeMaterial) {
      this.compositeMaterial.uniforms.uBloomStrength.value = 0.55 + s.bloom * 0.55;
    }
  }

  private makeBladeGeometry(): THREE.PlaneGeometry {
    // vertical plane, root at y=0, tip at y=1 — subdivided for soft bend
    const geo = new THREE.PlaneGeometry(1, 1, 1, 6);
    geo.translate(0, 0.5, 0);
    return geo;
  }

  private createBladeLayer(
    count: number,
    opts: {
      zMin: number;
      zMax: number;
      xSpread: number;
      hMin: number;
      hMax: number;
      wMin: number;
      wMax: number;
      leanBias: number;
    }
  ): BladeLayer {
    const geo = this.makeBladeGeometry();
    const phases = new Float32Array(count);
    const leans = new Float32Array(count);
    const heights = new Float32Array(count);
    const widths = new Float32Array(count);
    const shades = new Float32Array(count);

    const dummy = new THREE.Object3D();
    const material = new THREE.ShaderMaterial({
      vertexShader: grassBladeVertexShader,
      fragmentShader: grassBladeFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWind: { value: 1 },
        uGust: { value: 0.15 },
        uGrassDeep: { value: new THREE.Vector3() },
        uGrassMid: { value: new THREE.Vector3() },
        uGrassLit: { value: new THREE.Vector3() },
        uGrassTip: { value: new THREE.Vector3() },
        uSunGlow: { value: new THREE.Vector3(1, 1, 1) },
        uBloom: { value: 1 },
        uSun: { value: 1 },
        uMoon: { value: 0 },
        uPulseOrigin: {
          value: Array.from({ length: MAX_PULSES }, () => new THREE.Vector3(0, 0, 0)),
        },
        uPulseAge: { value: new Float32Array(MAX_PULSES).fill(-1) },
        uPulseStrength: { value: new Float32Array(MAX_PULSES).fill(0) },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });

    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 2 - 1) * opts.xSpread;
      // denser on the left (negative X) — reference composition
      const leftBias = Math.random() < 0.55 ? -Math.random() * opts.xSpread * 0.55 : 0;
      const px = x + leftBias * 0.35;
      const z = opts.zMin + Math.random() * (opts.zMax - opts.zMin);
      const h = opts.hMin + Math.random() * (opts.hMax - opts.hMin);
      const w = opts.wMin + Math.random() * (opts.wMax - opts.wMin);
      const yaw = (Math.random() - 0.5) * 0.7;

      dummy.position.set(px, 0, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      phases[i] = Math.random() * Math.PI * 2;
      leans[i] = opts.leanBias + (Math.random() - 0.3) * 0.35;
      heights[i] = h;
      widths[i] = w;
      shades[i] = Math.random();
    }
    mesh.instanceMatrix.needsUpdate = true;

    geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    geo.setAttribute("aLean", new THREE.InstancedBufferAttribute(leans, 1));
    geo.setAttribute("aHeight", new THREE.InstancedBufferAttribute(heights, 1));
    geo.setAttribute("aWidth", new THREE.InstancedBufferAttribute(widths, 1));
    geo.setAttribute("aShade", new THREE.InstancedBufferAttribute(shades, 1));

    return { mesh, material, count };
  }

  private buildScene() {
    this.scene.clear();
    this.bladeLayers = [];

    // low-angle camera looking through the field toward the light (+X / -Z)
    this.camera.fov = 48;
    this.camera.near = 0.05;
    this.camera.far = 60;
    this.camera.position.set(-0.15, 0.55, 3.4);
    this.camera.lookAt(1.2, 1.1, -2.5);
    this.camera.updateProjectionMatrix();

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: grassSkyVertexShader,
      fragmentShader: grassSkyFragmentShader,
      uniforms: {
        uSkyTop: { value: new THREE.Vector3() },
        uSkyMid: { value: new THREE.Vector3() },
        uSkyHor: { value: new THREE.Vector3() },
        uSunGlow: { value: new THREE.Vector3(1, 1, 1) },
        uHaze: { value: new THREE.Vector3() },
        uSun: { value: 1 },
        uMoon: { value: 0 },
        uStars: { value: 0 },
        uBloom: { value: 1 },
        uSunDir: { value: new THREE.Vector2(0.78, 0.72) },
      },
      depthWrite: false,
      depthTest: false,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), this.skyMaterial);
    sky.position.set(2.5, 3.5, -12);
    sky.renderOrder = -10;
    this.scene.add(sky);

    const scale = this.tier >= 3 ? 1 : 0.55;
    const far = this.createBladeLayer(Math.round(2200 * scale), {
      zMin: -10,
      zMax: -4.5,
      xSpread: 7,
      hMin: 1.6,
      hMax: 2.8,
      wMin: 0.035,
      wMax: 0.08,
      leanBias: 0.55,
    });
    const mid = this.createBladeLayer(Math.round(2800 * scale), {
      zMin: -5,
      zMax: -1.2,
      xSpread: 5.5,
      hMin: 1.1,
      hMax: 2.1,
      wMin: 0.04,
      wMax: 0.1,
      leanBias: 0.45,
    });
    const near = this.createBladeLayer(Math.round(1800 * scale), {
      zMin: -1.8,
      zMax: 1.6,
      xSpread: 4.2,
      hMin: 0.7,
      hMax: 1.5,
      wMin: 0.05,
      wMax: 0.14,
      leanBias: 0.35,
    });

    for (const layer of [far, mid, near]) {
      this.bladeLayers.push(layer);
      this.scene.add(layer.mesh);
    }
  }

  private makeFsTriangle(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
    );
    return geometry;
  }

  private buildPost() {
    const geo = this.makeFsTriangle();

    this.brightMaterial = new THREE.ShaderMaterial({
      vertexShader: grassPostVertexShader,
      fragmentShader: grassBrightFragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.42 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      vertexShader: grassPostVertexShader,
      fragmentShader: grassBlurFragmentShader,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader: grassPostVertexShader,
      fragmentShader: grassCompositeFragmentShader,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        tTrail: { value: null },
        uBloomStrength: { value: 1.0 },
        uTrailMix: { value: 0.28 },
        uVignette: { value: 0 },
        uVignetteColor: { value: this.vignetteColor },
        uDim: { value: 1 },
        uDrift: { value: new THREE.Vector2(0, 0) },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });

    // simple trail accumulate: mix previous trail with current scene
    this.copyMaterial = new THREE.ShaderMaterial({
      vertexShader: grassPostVertexShader,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform sampler2D tPrev;
        uniform float uDecay;
        varying vec2 vUv;
        void main() {
          vec3 cur = texture2D(tDiffuse, vUv).rgb;
          vec3 prev = texture2D(tPrev, vUv).rgb;
          gl_FragColor = vec4(mix(cur, prev, uDecay), 1.0);
        }
      `,
      uniforms: {
        tDiffuse: { value: null },
        tPrev: { value: null },
        uDecay: { value: 0.72 },
      },
      depthTest: false,
      depthWrite: false,
    });

    this.postMesh = new THREE.Mesh(geo, this.compositeMaterial);
    this.postScene.clear();
    this.postScene.add(this.postMesh);
  }

  private ensureTargets(w: number, h: number) {
    const pr = this.renderer?.getPixelRatio() ?? 1;
    const rw = Math.max(1, Math.floor(w * pr));
    const rh = Math.max(1, Math.floor(h * pr));
    const bloomScale = this.tier >= 3 ? 0.5 : 0.35;
    const bw = Math.max(1, Math.floor(rw * bloomScale));
    const bh = Math.max(1, Math.floor(rh * bloomScale));

    const needs =
      !this.sceneTarget ||
      this.sceneTarget.width !== rw ||
      this.sceneTarget.height !== rh;

    if (!needs) return;

    this.sceneTarget?.dispose();
    this.brightTarget?.dispose();
    this.blurTargetA?.dispose();
    this.blurTargetB?.dispose();
    this.trailTargetA?.dispose();
    this.trailTargetB?.dispose();

    const opts: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    };
    this.sceneTarget = new THREE.WebGLRenderTarget(rw, rh, opts);
    const trailOpts = { ...opts, depthBuffer: false };
    this.trailTargetA = new THREE.WebGLRenderTarget(rw, rh, trailOpts);
    this.trailTargetB = new THREE.WebGLRenderTarget(rw, rh, trailOpts);
    const bloomOpts = { ...opts, depthBuffer: false };
    this.brightTarget = new THREE.WebGLRenderTarget(bw, bh, bloomOpts);
    this.blurTargetA = new THREE.WebGLRenderTarget(bw, bh, bloomOpts);
    this.blurTargetB = new THREE.WebGLRenderTarget(bw, bh, bloomOpts);
  }

  private rebuild() {
    if (!this.canvas || !this.theme) return;
    this.init(this.canvas, this.theme, this.params);
  }

  tick(t: number) {
    if (!this.renderer || !this.skyMaterial || !this.compositeMaterial) return;
    const dt = this.lastTime ? Math.min(0.1, Math.max(0, t - this.lastTime)) : 0;
    this.lastTime = t;

    const targetAlert = this.mood === "alert" ? 1 : 0;
    const targetClockNight = nightFromHour(this.hourNow());
    const targetClockGolden = goldenFromHour(this.hourNow());
    this.clockNightT += (targetClockNight - this.clockNightT) * Math.min(1, dt / 3.0);
    this.clockGoldenT += (targetClockGolden - this.clockGoldenT) * Math.min(1, dt / 2.5);
    const targetNight = Math.max(this.clockNightT, this.mood === "sleep" ? 1 : 0);
    const targetGolden = this.mood === "sleep" ? 0 : this.clockGoldenT * (1 - targetNight);
    const targetCalm = this.mood === "focus" ? 0.65 : this.mood === "sleep" ? 1 : 0;
    this.alertT += (targetAlert - this.alertT) * Math.min(1, dt / 1.2);
    this.nightT += (targetNight - this.nightT) * Math.min(1, dt / 2.0);
    this.goldenT += (targetGolden - this.goldenT) * Math.min(1, dt / 2.0);
    this.calmT += (targetCalm - this.calmT) * Math.min(1, dt / 1.6);
    const pace = (1 + this.alertT * 1.8) * (1 - this.calmT * 0.55);
    this.warpedT += dt * this.baseSpeed * pace;

    this.applyMoodUniforms();

    this.pulses.forEach((p) => (p.age += dt));
    this.pulses = this.pulses.filter((p) => p.age < 3);

    for (const layer of this.bladeLayers) {
      const u = layer.material.uniforms;
      u.uTime.value = this.warpedT;
      for (let i = 0; i < MAX_PULSES; i++) {
        const p = this.pulses[i];
        // map screen UV pulse → approximate world XZ in the field
        if (p) {
          const wx = (p.origin[0] - 0.5) * 8;
          const wz = (0.5 - p.origin[1]) * 6 - 2;
          u.uPulseOrigin.value[i].set(wx, 0, wz);
          u.uPulseAge.value[i] = p.age;
          u.uPulseStrength.value[i] = p.strength;
        } else {
          u.uPulseAge.value[i] = -1;
          u.uPulseStrength.value[i] = 0;
        }
      }
    }

    const { clientWidth: w, clientHeight: h } = this.canvas!;
    this.ensureTargets(w, h);
    if (
      !this.sceneTarget ||
      !this.brightTarget ||
      !this.blurTargetA ||
      !this.blurTargetB ||
      !this.trailTargetA ||
      !this.trailTargetB
    ) {
      return;
    }

    const r = this.renderer;
    const trailRead = this.trailFlip ? this.trailTargetB : this.trailTargetA;
    const trailWrite = this.trailFlip ? this.trailTargetA : this.trailTargetB;

    // 1) scene into target
    r.setRenderTarget(this.sceneTarget);
    r.clear();
    r.render(this.scene, this.camera);

    // 2) bright extract (half-res)
    this.brightMaterial!.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.postMesh!.material = this.brightMaterial!;
    r.setRenderTarget(this.brightTarget);
    r.clear();
    r.render(this.postScene, this.postCamera);

    // 3) separable blur
    const bloomRes = new THREE.Vector2(this.brightTarget.width, this.brightTarget.height);
    this.blurMaterial!.uniforms.uRes.value.copy(bloomRes);
    this.blurMaterial!.uniforms.tDiffuse.value = this.brightTarget.texture;
    this.blurMaterial!.uniforms.uDirection.value.set(1, 0);
    this.postMesh!.material = this.blurMaterial!;
    r.setRenderTarget(this.blurTargetA);
    r.clear();
    r.render(this.postScene, this.postCamera);

    this.blurMaterial!.uniforms.tDiffuse.value = this.blurTargetA.texture;
    this.blurMaterial!.uniforms.uDirection.value.set(0, 1);
    r.setRenderTarget(this.blurTargetB);
    r.clear();
    r.render(this.postScene, this.postCamera);

    // extra blur pass for softer wash
    this.blurMaterial!.uniforms.tDiffuse.value = this.blurTargetB.texture;
    this.blurMaterial!.uniforms.uDirection.value.set(1, 0);
    r.setRenderTarget(this.blurTargetA);
    r.clear();
    r.render(this.postScene, this.postCamera);
    this.blurMaterial!.uniforms.tDiffuse.value = this.blurTargetA.texture;
    this.blurMaterial!.uniforms.uDirection.value.set(0, 1);
    r.setRenderTarget(this.blurTargetB);
    r.clear();
    r.render(this.postScene, this.postCamera);

    // 4) composite to screen
    const cycle = (t / 600) * Math.PI * 2 + this.driftPhase;
    const cu = this.compositeMaterial.uniforms;
    cu.tScene.value = this.sceneTarget.texture;
    cu.tBloom.value = this.blurTargetB.texture;
    cu.tTrail.value = trailRead.texture;
    cu.uTrailMix.value = 0.22 + this.alertT * 0.08;
    cu.uVignette.value = this.vignette;
    cu.uVignetteColor.value.copy(this.vignetteColor);
    cu.uDim.value = this.dimAmount;
    cu.uDrift.value.set(Math.sin(cycle) * 6, Math.cos(cycle * 0.7) * 6);
    cu.uRes.value.set(w, h);
    cu.uTime.value = this.warpedT;
    this.postMesh!.material = this.compositeMaterial;
    r.setRenderTarget(null);
    r.clear();
    r.render(this.postScene, this.postCamera);

    // 5) trail accumulate for next frame's long-exposure ghost
    this.copyMaterial!.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.copyMaterial!.uniforms.tPrev.value = trailRead.texture;
    this.copyMaterial!.uniforms.uDecay.value = 0.7;
    this.postMesh!.material = this.copyMaterial!;
    r.setRenderTarget(trailWrite);
    r.render(this.postScene, this.postCamera);
    r.setRenderTarget(null);
    this.trailFlip = !this.trailFlip;
  }

  pulse(originNdc: [number, number], strength: number) {
    const uv: [number, number] = [(originNdc[0] + 1) / 2, (originNdc[1] + 1) / 2];
    if (this.pulses.length >= MAX_PULSES) this.pulses.shift();
    this.pulses.push({ origin: uv, age: 0, strength });
  }

  setVignette(v: number, color: string) {
    this.vignette = v;
    this.vignetteColor.copy(colorToVec3(color));
  }

  dim(v: number) {
    this.dimAmount = v;
  }

  setMood(mood: Mood) {
    this.mood = mood;
    if (!this.lastTime) {
      const hourNight = nightFromHour(this.hourNow());
      const hourGolden = goldenFromHour(this.hourNow());
      this.alertT = mood === "alert" ? 1 : 0;
      this.clockNightT = hourNight;
      this.clockGoldenT = hourGolden;
      this.nightT = Math.max(hourNight, mood === "sleep" ? 1 : 0);
      this.goldenT = mood === "sleep" ? 0 : hourGolden * (1 - this.nightT);
      this.calmT = mood === "focus" ? 0.65 : mood === "sleep" ? 1 : 0;
    }
  }

  setParams(p: EngineParams) {
    this.params = { ...this.params, ...p };
    if (this.theme) this.syncTheme(this.theme);
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const { clientWidth, clientHeight } = this.canvas;
    this.renderer.setSize(clientWidth, clientHeight, false);
    this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
    this.camera.updateProjectionMatrix();
    this.ensureTargets(clientWidth, clientHeight);
  }

  private releaseGpu() {
    for (const layer of this.bladeLayers) {
      layer.material.dispose();
      layer.mesh.geometry.dispose();
      this.scene.remove(layer.mesh);
    }
    this.bladeLayers = [];
    this.skyMaterial?.dispose();
    this.skyMaterial = undefined;
    this.brightMaterial?.dispose();
    this.blurMaterial?.dispose();
    this.compositeMaterial?.dispose();
    this.copyMaterial?.dispose();
    this.brightMaterial = undefined;
    this.blurMaterial = undefined;
    this.compositeMaterial = undefined;
    this.copyMaterial = undefined;
    this.sceneTarget?.dispose();
    this.brightTarget?.dispose();
    this.blurTargetA?.dispose();
    this.blurTargetB?.dispose();
    this.trailTargetA?.dispose();
    this.trailTargetB?.dispose();
    this.sceneTarget = undefined;
    this.brightTarget = undefined;
    this.blurTargetA = undefined;
    this.blurTargetB = undefined;
    this.trailTargetA = undefined;
    this.trailTargetB = undefined;
    this.postMesh = undefined;
    this.scene.clear();
    this.renderer?.dispose();
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
