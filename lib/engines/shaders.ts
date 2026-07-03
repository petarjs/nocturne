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
