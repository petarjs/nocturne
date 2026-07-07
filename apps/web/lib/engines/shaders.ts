export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = (position.xy + 1.0) * 0.5;
    gl_Position = vec4(position, 1.0);
  }
`;

// Aurora (§5.2): 4-octave value-noise fbm with domain warping, mandatory
// grain, moment pulses that bend the field, and vignette/dim for alert/sleep.
export const auroraFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform vec2 uRes;
  uniform vec3 uColorBg;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uVignette;
  uniform vec3 uVignetteColor;
  uniform float uDim;
  uniform float uAccent2Mix;
  uniform vec2 uDrift;

  #define MAX_PULSES 4
  uniform vec2 uPulseOrigin[MAX_PULSES];
  uniform float uPulseAge[MAX_PULSES];
  uniform float uPulseStrength[MAX_PULSES];

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  float pulseBend(vec2 uv) {
    float total = 0.0;
    for (int i = 0; i < MAX_PULSES; i++) {
      float age = uPulseAge[i];
      if (age < 0.0) continue;
      float d = length(uv - uPulseOrigin[i]);
      float w = sin(d * 20.0 - age * 6.0) * exp(-d * 4.0 - age * 2.0) * uPulseStrength[i];
      total += w;
    }
    return total;
  }

  float edgeMask(vec2 uv) {
    vec2 d = abs(uv - 0.5) * 2.0;
    float e = max(d.x, d.y);
    return smoothstep(0.55, 1.0, e);
  }

  void main() {
    vec2 uv = vUv + uDrift / uRes;
    vec2 p = uv * 1.5;
    float t = uTime * uSpeed;
    float bend = pulseBend(uv);
    vec2 warp = p + fbm(p + vec2(t * 0.11, -t * 0.08)) + vec2(bend, bend * 0.7);
    float n = fbm(warp + vec2(t * 0.025, t * 0.018));

    vec3 col = mix(uColorBg, uColorA, smoothstep(0.35, 0.75, n));
    col = mix(col, uColorB, smoothstep(0.55, 0.95, fbm(p * 1.7 - t * 0.055)) * uAccent2Mix);

    float grain = (hash(uv * uRes + t) - 0.5) * 0.035;
    col += grain;

    float edge = edgeMask(uv);
    col = mix(col, col * uVignetteColor, uVignette * edge);
    col *= uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// borealis: curtains of vertical-striated light tracing zigzag ridges across
// a near-black emerald void — the "green neon waves" engine. Three depth
// layers flow leftward at separated speeds (parallax); crests rise and sink
// while the glow width breathes; a gleam sweeps along each ridge; moment
// pulses bend the near layers hardest. uTime arrives mood-warped from the
// engine (alert quickens, focus/sleep slow) and uAlert repaints the sky
// green → ember → crimson through OKLCH stops computed CPU-side. Light is
// disciplined for legibility: confined to the lower-mid band, thinned toward
// the top where panels live, soft-kneed per curtain and rolled off through a
// filmic shoulder so text never sits on clipped white.
export const borealisFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;       // mood-warped seconds — the engine integrates pace
  uniform vec2 uRes;
  uniform vec3 uColorBg;
  uniform vec3 uColorA;      // accent1 — the neon green body
  uniform vec3 uColorB;      // accent2 — the teal wash and back curtain
  uniform vec3 uColorHot;    // near-white core where light stacks
  uniform vec3 uAlertHi;     // alert stops: crimson ridge…
  uniform vec3 uAlertMid;    // …through ember gold…
  uniform vec3 uAlertLo;     // …and smoldering teal
  uniform vec3 uAlertHot;    // warm-white core under alert
  uniform float uAlert;      // 0..1 eased alert ramp
  uniform float uCalm;       // 0..1 focus/sleep recession
  uniform float uVignette;
  uniform vec3 uVignetteColor;
  uniform float uDim;
  uniform float uBreath;     // breathing amplitude 0..1
  uniform float uIntensity;  // global gain
  uniform vec2 uDrift;

  #define MAX_PULSES 4
  uniform vec2 uPulseOrigin[MAX_PULSES];
  uniform float uPulseAge[MAX_PULSES];
  uniform float uPulseStrength[MAX_PULSES];

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float hash1(float x) {
    return fract(sin(x * 127.1) * 43758.5453123);
  }

  float noise1(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hash1(i), hash1(i + 1.0), u);
  }

  float pulseBend(vec2 uv) {
    float total = 0.0;
    for (int i = 0; i < MAX_PULSES; i++) {
      float age = uPulseAge[i];
      if (age < 0.0) continue;
      float d = length(uv - uPulseOrigin[i]);
      float w = sin(d * 20.0 - age * 6.0) * exp(-d * 4.0 - age * 2.0) * uPulseStrength[i];
      total += w;
    }
    return total;
  }

  float edgeMask(vec2 uv) {
    vec2 d = abs(uv - 0.5) * 2.0;
    float e = max(d.x, d.y);
    return smoothstep(0.55, 1.0, e);
  }

  // One curtain of light. The ridge is an |sin| zigzag (sharp valleys, round
  // crests) drifting leftward; light hangs below it in a long tail and cuts
  // off fast above, modulated by vertical striations that travel with it.
  float curtain(
    vec2 uv, float t, float seed, float freq, float amp, float yBase,
    float flow, float soft, float strAmt, float bend
  ) {
    float x = uv.x;
    float ph = x * freq + t * flow + seed;
    float zig = abs(sin(ph)) * 0.72 + abs(sin(ph * 0.5 + 1.3)) * 0.28;

    // the dance: crest heights swell and sink, and a slow undulation travels
    // through the curtain so individual peaks rise and fall on their own
    float ampMod = (0.78 + 0.22 * sin(t * 0.16 + seed * 3.1)) * (1.0 - 0.25 * uCalm);
    float lift = (noise1(x * 1.4 - t * 0.045 + seed * 17.0) - 0.5) * 0.16;
    float tremor = (noise1(x * 8.0 - t * 1.3 + seed) - 0.5) * 0.05 * uAlert;

    // two-sine swell with an x-travel term: the glow widens AND the whole
    // curtain billows upward as it brightens — grows up, settles down
    float ba = t * (0.42 + seed * 0.03) + seed * 2.7 + x * 1.3;
    float breath = 1.0 + uBreath * (0.5 * sin(ba) + 0.5 * sin(ba * 0.37 + 1.7));

    float yr = yBase + amp * ampMod * (zig - 0.5) + lift + tremor
             + (breath - 1.0) * 0.09 + bend * 0.22;

    float d = uv.y - yr;
    float widthUp = 0.035 * soft * breath;
    float widthDn = 0.19 * soft * breath;
    float fall = d > 0.0 ? exp(-d / widthUp) : exp(d / widthDn);
    // razor filament on the exact ridge — the neon wire; thin enough that
    // text crossing it stays readable, bright enough to read as electric
    float fil = exp(-abs(d) / (0.0065 * soft * breath)) * 1.15;

    // striations ride the wave (crest x-speed = flow/freq); the rays shimmer
    // slowly when ambient and twitch when alarmed
    float s = x + t * flow / freq;
    float bands = 0.45 + 0.55 * pow(noise1(s * 24.0 + seed * 37.0 + t * (0.18 + 0.5 * uAlert)), 1.6);
    float comb = 0.86 + 0.14 * sin(s * 720.0 + seed * 10.0);
    float striae = mix(1.0, bands * comb, strAmt);

    // a slow gleam sweeps leftward along the ridge — the shine pass
    float gp = 1.15 - fract(t * 0.028 + fract(seed * 0.731)) * 1.5;
    float gleam = 1.0 + exp(-pow((x - gp) * 5.5, 2.0)) * 0.6;

    float gain = (0.9 + 0.25 * max(0.0, breath - 1.0)) * gleam;
    float I = (fall + fil) * striae * gain;
    return I / (1.0 + I * 0.35); // soft knee — luminous, never white-out
  }

  void main() {
    vec2 uv = vUv + uDrift / uRes;
    float t = uTime;
    float bend = pulseBend(uv);

    vec3 col = uColorBg;

    // three depth layers, crest speeds separated ~1 : 1.9 : 3.3 for parallax;
    // pulses bend the near layers hardest so ripples read as depth too
    float back  = curtain(uv, t, 0.0, 9.0, 0.40, 0.50, 0.038, 1.8,  0.5, bend * 0.35);
    float mid   = curtain(uv, t, 2.7, 7.6, 0.42, 0.42, 0.060, 1.25, 0.8, bend * 0.6);
    float front = curtain(uv, t, 5.9, 6.3, 0.46, 0.34, 0.095, 0.9,  1.0, bend);

    // legibility envelope: the light thins toward the top where panels live
    float env = 1.0 - 0.55 * smoothstep(0.58, 0.92, uv.y);
    back *= env;
    mid *= env;
    front *= env;

    // focus/sleep: the supporting layers recede and the field quiets
    float recede = 1.0 - 0.35 * uCalm;
    float wBack = 0.22 * recede;
    float wMid = 0.50 * recede;
    float wFront = 1.05;

    // alert repaints the sky: green → ember gold → crimson
    vec3 cA = mix(mix(uColorA, uAlertMid, clamp(uAlert * 2.0, 0.0, 1.0)),
                  uAlertHi, clamp(uAlert * 2.0 - 1.0, 0.0, 1.0));
    vec3 cB = mix(uColorB, uAlertLo, uAlert);
    vec3 cHot = mix(uColorHot, uAlertHot, uAlert);

    float k = uIntensity * (1.0 - 0.3 * uCalm);
    col += cB * back * wBack * k;
    col += mix(cB, cA, 0.55) * mid * wMid * k;
    col += cA * front * wFront * k;

    // hot core where curtains stack — kept small; text must win
    float total = back * wBack + mid * wMid + front * wFront;
    col += cHot * pow(smoothstep(0.45, 1.5, total), 2.0) * 0.5;

    // a passing ripple flares through the field
    col += cA * abs(bend) * 1.1;

    // glitter inside the bright ridge
    vec2 spc = floor(vec2(uv.x * 140.0 + t * 0.6, uv.y * 80.0));
    float sh = hash(spc);
    if (sh > 0.993) {
      float twk = 0.5 + 0.5 * sin(t * 3.0 + sh * 40.0);
      col += cHot * twk * smoothstep(0.5, 1.0, front) * 0.35;
    }

    // faint teal ambience pooling at the floor — a room, not a hole
    col += cB * smoothstep(0.5, 0.0, uv.y) * 0.035 * k;

    // sparse drifting stars in the dark between curtains
    vec2 sc = uv * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 90.0 + vec2(t * 0.01, 0.0);
    float hstar = hash(floor(sc));
    if (hstar > 0.994) {
      float tw = 0.5 + 0.5 * sin(t * (1.5 + hstar * 3.0) + hstar * 40.0);
      float star = smoothstep(0.12, 0.02, length(fract(sc) - 0.5)) * tw;
      col += uColorHot * star * 0.3 * max(0.0, 1.0 - total * 2.0);
    }

    // filmic shoulder — highlights roll off instead of clipping to white
    col = 1.0 - exp(-col * 1.25);

    float grain = (hash(uv * uRes + t) - 0.5) * 0.035;
    col += grain;

    float edge = edgeMask(uv);
    col = mix(col, col * uVignetteColor, uVignette * edge);
    col *= uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// gridHorizon (§5.2): perspective floor, fog, sparse stars. Preset `sunset`
// adds the striped Synthwave sun disc at the horizon.
export const gridHorizonFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uSpeed;
  uniform vec2 uRes;
  uniform vec3 uColorBg;
  uniform vec3 uColorGrid;
  uniform vec3 uColorFog;
  uniform vec3 uColorSky;
  uniform float uVignette;
  uniform vec3 uVignetteColor;
  uniform float uDim;
  uniform float uDensity;
  uniform float uFog;
  uniform float uSunset;
  uniform vec3 uSunColorA;
  uniform vec3 uSunColorB;
  uniform vec2 uDrift;

  #define MAX_PULSES 4
  uniform vec2 uPulseOrigin[MAX_PULSES];
  uniform float uPulseAge[MAX_PULSES];
  uniform float uPulseStrength[MAX_PULSES];

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float pulseBrighten(vec2 uv) {
    float total = 0.0;
    for (int i = 0; i < MAX_PULSES; i++) {
      float age = uPulseAge[i];
      if (age < 0.0) continue;
      float d = length(uv - uPulseOrigin[i]);
      total += exp(-d * 5.0 - age * 1.5) * uPulseStrength[i] * 0.6;
    }
    return total;
  }

  float edgeMask(vec2 uv) {
    vec2 d = abs(uv - 0.5) * 2.0;
    float e = max(d.x, d.y);
    return smoothstep(0.55, 1.0, e);
  }

  void main() {
    vec2 uv = vUv + uDrift / uRes;
    float t = uTime * uSpeed;
    float horizon = 0.42;
    float pulse = pulseBrighten(uv);

    vec3 col = uColorBg;

    // 3-layer parallax starfield above the horizon — depth drift + twinkle (§5.3)
    if (uv.y > horizon) {
      float skyMask = smoothstep(horizon + 0.02, horizon + 0.22, uv.y);
      for (float layer = 0.0; layer < 3.0; layer += 1.0) {
        float depth = (layer + 1.0) / 3.0;
        float density = 160.0 + layer * 100.0;
        float heightAboveHorizon = (uv.y - horizon) / (1.0 - horizon);
        // nearer the horizon → faster drift (perspective)
        float persp = 1.0 + (1.0 - heightAboveHorizon) * 1.4;
        float driftX = t * 0.014 * persp / depth;
        float driftY = t * 0.005 * persp / depth + (1.0 - uv.y) * t * 0.006;

        vec2 starCoord = uv * vec2(density, density * 0.55);
        starCoord += vec2(driftX, driftY);

        vec2 cell = floor(starCoord);
        vec2 cellUv = fract(starCoord) - 0.5;
        float h = hash(cell + layer * 43.17);

        if (h > 0.991) {
          float twinkle = 0.3 + 0.7 * sin(t * (1.8 + h * 4.0) + h * 6.283);
          float starRadius = 0.06 + fract(h * 17.0) * 0.1;
          float star = smoothstep(starRadius, starRadius * 0.25, length(cellUv)) * twinkle;
          float layerBright = (0.35 + depth * 0.5) * skyMask;
          col = mix(col, uColorSky, star * layerBright);
        }
      }
    }

    // perspective grid floor
    if (uv.y < horizon + 0.02) {
      vec2 guv = vec2(uv.x - 0.5, 1.0 / (uv.y + 0.05));
      vec2 gridUv = fract(guv * uDensity + vec2(0.0, t * 0.4));
      float lineX = smoothstep(0.04, 0.0, abs(gridUv.x - 0.5));
      float lineY = smoothstep(0.03, 0.0, abs(gridUv.y - 0.5));
      float grid = max(lineX, lineY);
      float dist = 1.0 - uv.y;
      float fog = exp(-dist * uFog);
      col = mix(col, uColorGrid * (1.0 + pulse), grid * fog * 0.85);
      col = mix(col, uColorFog, (1.0 - fog) * 0.55);
    }

    // Synthwave sunset disc
    if (uSunset > 0.5 && uv.y < horizon + 0.08) {
      vec2 sunUv = vec2(uv.x - 0.5, (horizon - uv.y) * 8.0);
      float sunDist = length(sunUv);
      if (sunDist < 0.35) {
        float stripes = step(0.5, fract(sin(sunUv.y * 18.0) * 0.5 + 0.5));
        vec3 sunCol = mix(uSunColorA, uSunColorB, stripes);
        col = mix(col, sunCol, smoothstep(0.35, 0.28, sunDist));
      }
    }

    float grain = (hash(uv * uRes + t) - 0.5) * 0.035;
    col += grain;

    float edge = edgeMask(uv);
    col = mix(col, col * uVignetteColor, uVignette * edge);
    col *= uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;
