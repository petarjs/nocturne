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
    vec2 warp = p + fbm(p + vec2(t * 0.06, -t * 0.04)) + vec2(bend, bend * 0.7);
    float n = fbm(warp);

    vec3 col = mix(uColorBg, uColorA, smoothstep(0.35, 0.75, n));
    col = mix(col, uColorB, smoothstep(0.55, 0.95, fbm(p * 1.7 - t * 0.03)) * uAccent2Mix);

    float grain = (hash(uv * uRes + t) - 0.5) * 0.035;
    col += grain;

    float edge = edgeMask(uv);
    col = mix(col, col * uVignetteColor, uVignette * edge);
    col *= uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;
