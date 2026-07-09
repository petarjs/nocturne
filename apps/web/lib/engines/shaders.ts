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

// dunes: a pastel desert at permanent golden hour — rolling velvet dunes
// under a periwinkle-to-peach sky with billowing, sun-lit cumulus drifting
// across it. Everything is one fragment pass. Clouds are domain-warped fbm
// lit directionally (density sampled toward the sun → bright faces, shaded
// bellies, silver-lined edges near the sun); dunes are five layered smooth
// ridgelines shaded by their slope against the sun with valley falloff,
// crest rim-light, atmospheric haze, drifting cloud shadows, and sparse sand
// glints on the lit faces. Gusts occasionally blow a wisp of sand off the
// front crests. All colors arrive pre-blended from the engine, which mixes
// day → night → storm palettes in OKLCH as moods change: sleep brings a
// moon, stars, and moonlit sand; alert rolls the sky over into a racing
// ember storm with heat lightning (uFlash). Moment pulses send a wave of
// warm light rolling across the sand while the cloud field flinches. uTime
// arrives mood-warped (alert quickens the wind, focus/sleep slow it); the
// burn-in drift rides uDrift as everywhere else.
export const dunesFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;       // mood-warped seconds — the engine integrates pace
  uniform vec2 uRes;
  uniform vec2 uDrift;

  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uSkyHor;
  uniform vec3 uSunGlow;     // day: peach light · night: moon silver · alert: ember
  uniform vec3 uCloudHi;
  uniform vec3 uCloudLo;
  uniform vec3 uDuneLit;
  uniform vec3 uDuneShade;
  uniform vec3 uHaze;
  uniform vec3 uGlint;

  uniform float uSun;        // sun presence 0..1
  uniform float uMoon;       // moon presence 0..1 (sleep)
  uniform float uStars;      // star visibility 0..1 (sleep)
  uniform float uCover;      // cloud coverage 0..1 (storm pushes toward 1)
  uniform float uGlintK;     // sand-glint strength
  uniform float uStreamK;    // crest sand-streamer strength
  uniform float uFlash;      // heat-lightning flash, CPU-scheduled decay
  uniform float uSunX;       // sun horizontal position in uv

  uniform float uVignette;
  uniform vec3 uVignetteColor;
  uniform float uDim;

  // rolling dust cloud — an occasional event, not a permanent fixture
  // (§4.6 heartbeat-scheduled from the CPU side, see DunesEngine)
  uniform float uDustXFar;    // far layer center, uv-aspect space, drifts right→left
  uniform float uDustXNear;   // near layer center, faster, lower, denser
  uniform float uDustAFar;    // far layer envelope 0..1
  uniform float uDustANear;   // near layer envelope 0..1
  uniform float uDustSeed;

  #define MAX_PULSES 4
  uniform vec2 uPulseOrigin[MAX_PULSES];
  uniform float uPulseAge[MAX_PULSES];
  uniform float uPulseStrength[MAX_PULSES];

  varying vec2 vUv;

  #define HOR 0.42
  #define SUN_Y 0.47

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

  // octaves rotated against each other so cloud masses billow instead of
  // showing the lattice
  float fbm(vec2 p) {
    const mat2 R = mat2(0.8, 0.6, -0.6, 0.8);
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = R * p * 2.03 + vec2(11.3, 7.1);
      a *= 0.5;
    }
    return v;
  }

  // dune ridgeline: two octaves of smooth 1D noise creeping imperceptibly —
  // dunes migrate, they do not fidget
  float duneH(float x, float seed, float t) {
    float creep = t * 0.006;
    return noise(vec2(x + creep, seed)) * 0.78
         + noise(vec2(x * 2.3 - creep * 1.6, seed + 7.3)) * 0.22;
  }

  // fine wind-ripple corrugation — a much higher-frequency third octave,
  // sampled only for shading (never geometry) so grazing light catches
  // hundreds of tiny sand ridges without moving the silhouette
  float rippleN(float x, float y, float seed, float t) {
    float creep = t * 0.006;
    return noise(vec2(x * 34.0 + creep * 3.0, y * 60.0 + seed * 5.0)) * 0.6
         + noise(vec2(x * 71.0 - creep * 2.0, y * 130.0 + seed * 9.0)) * 0.4;
  }

  float edgeMask(vec2 uv) {
    vec2 d = abs(uv - 0.5) * 2.0;
    float e = max(d.x, d.y);
    return smoothstep(0.55, 1.0, e);
  }

  // a gust sweeps left→right every minute or so (per seed); some pass over
  float gustEnv(float x, float t, float seed) {
    float cycle = t * 0.019 + seed * 0.37;
    float pos = fract(cycle) * 1.8 - 0.4;
    float on = smoothstep(0.4, 0.75, noise(vec2(floor(cycle) * 7.13, seed)));
    float d = (x - pos) / 0.16;
    return exp(-d * d) * on;
  }

  // one cumulus layer: warped fbm mass, density sampled toward the sun for
  // lit faces vs shaded bellies, silver lining where thin cloud meets sun
  vec3 cloudLayer(
    vec3 sky, vec2 uv, float aspect, float t,
    float scale, float speed, float alphaK, float seed,
    float sunDist, float bend, bool litSample
  ) {
    vec2 p = vec2(uv.x * aspect * scale - t * speed + seed, uv.y * scale * 1.6);
    vec2 q = vec2(fbm(p * 0.85 + vec2(t * 0.045, 0.0)), fbm(p * 0.85 + vec2(5.2, 1.3)));
    q += bend * 0.6;
    vec2 wp = p + (q - 0.5) * 0.55;
    float den = fbm(wp);

    float cover = mix(0.60, 0.38, uCover);
    float soft = mix(0.30, 0.22, uCover);
    float m = smoothstep(cover, cover + soft, den);
    m *= smoothstep(HOR + 0.02, HOR + 0.20, uv.y);
    if (m < 0.004) return sky;

    float lit;
    if (litSample) {
      vec2 L = normalize(vec2((uSunX - uv.x) * aspect, SUN_Y - uv.y) + vec2(1e-4));
      float den2 = fbm(wp + L * 0.14);
      lit = clamp(0.55 + (den - den2) * 3.2, 0.0, 1.0);
    } else {
      lit = clamp(1.9 - den * 2.1, 0.1, 1.0); // far layer: dense core = shaded
    }
    lit = lit * lit * (3.0 - 2.0 * lit);
    vec3 c = mix(uCloudLo, uCloudHi, lit);

    // silver lining: half-density edges glow near the light
    float edge = m * (1.0 - m) * 4.0;
    c += uSunGlow * edge * exp(-sunDist * 2.0) * 0.8 * (uSun + uMoon * 0.5);

    // heat lightning blooms inside the mass
    c += vec3(1.0, 0.96, 0.9) * uFlash * (0.3 + den * 0.9);

    return mix(sky, c, m * alphaK);
  }

  // one dune: masked ridgeline shaded by slope vs sun, valley falloff, haze,
  // crest rim-light, cloud shadow, sand glints; streamers handled by caller
  void duneLayer(
    inout vec3 col, out float crestY, vec2 uv, float aspect, float t,
    float yb, float amp, float fr, float seed,
    float hazeK, float lightK, float cloudShadow, float bend, float glintK
  ) {
    float x = uv.x * aspect * fr + bend * 0.02;
    float h = duneH(x, seed, t);
    float y = yb + (h - 0.5) * 2.0 * amp;
    crestY = y;

    float aa = 2.0 / uRes.y;
    float m = smoothstep(y + aa, y - aa, uv.y);
    if (m < 0.002) return;

    // slope against the light: faces toward the sun glow, lee sides fall
    // into violet — the velvet
    float slope = (duneH(x + 0.05, seed, t) - duneH(x - 0.05, seed, t)) * amp * 42.0;
    float ldir = clamp((uSunX - uv.x) * 2.4, -1.0, 1.0);
    float litBase = clamp(0.5 - slope * ldir * 1.7, 0.0, 1.0);

    // fine wind-ripple corrugation modulates the base slope shading —
    // hundreds of tiny sand ridges, brightest where they face the sun
    float ripple = rippleN(x, uv.y, seed, t) - 0.5;
    float lit = clamp(litBase + ripple * 0.16 * (0.35 + 0.65 * abs(ldir)), 0.0, 1.0);
    lit = lit * lit * (3.0 - 2.0 * lit);

    // warm-lit face vs cool violet shadow — a wider tonal split than a flat
    // two-color mix reads as sculpted, not painted
    vec3 shadeCool = mix(uDuneShade, uHaze, 0.18);
    vec3 body = mix(shadeCool, uDuneLit, lit);

    // valleys sink into shadow below the crest — ambient occlusion deepens
    // toward the trough floor instead of a single flat step
    float below = y - uv.y;
    float deepK = smoothstep(0.0, amp * 1.8 + 0.10, below);
    float deepK2 = smoothstep(0.0, amp * 4.0 + 0.16, below);
    body = mix(body, shadeCool * 0.78, deepK * 0.62);
    body = mix(body, shadeCool * 0.58, deepK2 * 0.30);

    // a sliver of warm bounce light right at the terminator, fading with depth
    float bounce = exp(-abs(lit - 0.42) * 9.0) * (1.0 - deepK);
    body += uSunGlow * bounce * 0.10 * (uSun + uMoon * 0.4);

    // crest rim-light on sun-facing ridges — tight, bright highlight where
    // the light grazes the very top of the ridge
    float rim = exp(-below * 190.0) * clamp(lit * 2.2 - 0.75, 0.0, 1.0);
    body += uSunGlow * rim * (0.55 * uSun + 0.30 * uMoon);
    float rimWide = exp(-below * 70.0) * clamp(lit * 1.7 - 0.5, 0.0, 1.0);
    body += uSunGlow * rimWide * (0.16 * uSun + 0.08 * uMoon);

    // cloud shadows drift across the sand
    body *= 1.0 - cloudShadow * (0.05 + 0.11 * (1.0 - hazeK)) * lightK;

    // sparse glints on lit faces — soft round grains catching the light,
    // not hard pixel pops: a distance-falloff dot inside a sparse cell grid
    if (glintK > 0.001) {
      vec2 gp = vec2(x * 190.0, uv.y * 190.0 * fr);
      vec2 gc = floor(gp + seed);
      vec2 gf = fract(gp + seed) - 0.5;
      float gh = hash(gc);
      float on = smoothstep(0.965, 0.995, gh);
      float dot = smoothstep(0.5, 0.05, length(gf));
      float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(t * (0.8 + gh * 1.6) + gh * 40.0));
      body += uGlint * on * dot * tw * lit * (1.0 - deepK) * glintK * 0.55;
    }

    // distance dissolves into the horizon haze
    body = mix(body, uHaze, hazeK);

    col = mix(col, body, m);
  }

  // a rolling dust cloud: an elongated, wind-warped mass hugging the dune
  // crests, trailing tendrils behind it — travels right→left and dissolves,
  // never a static texture. Two calls with different depth params (§ main)
  // give it parallax: the far cloud sits higher, slower, and paler; the
  // near one lower, faster, and denser, so the two visibly separate.
  vec3 dustCloud(
    vec3 col, vec2 uv, float aspect, float t,
    float cx, float envelope, float seed,
    float yMid, float yScale, float widthK, vec3 tint
  ) {
    if (envelope < 0.003) return col;
    vec2 p = vec2((uv.x * aspect - cx) / widthK, (uv.y - yMid) / yScale);
    // domain-warp the mass so it billows and trails rather than reading as
    // an ellipse — trailing tendrils stretch behind (to the right, upwind)
    vec2 warp = vec2(fbm(p * 1.1 + vec2(seed, seed * 1.7)) - 0.5,
                      fbm(p * 1.1 + vec2(seed * 2.3, seed)) - 0.5);
    vec2 wp = p + warp * vec2(0.85, 0.35) + vec2(max(p.x, 0.0) * 0.5, 0.0);
    float d = length(wp * vec2(0.62, 1.55));
    float body = smoothstep(1.05, 0.05, d);
    // fine internal turbulence so it reads as tumbling dust, not a flat blob
    float detail = fbm(vec2(uv.x * aspect * 3.4 - t * 0.24 + seed * 5.0, uv.y * 7.0 + seed));
    body *= smoothstep(0.22, 0.86, detail + 0.28);
    body = clamp(body, 0.0, 1.0) * envelope;
    if (body < 0.003) return col;
    // dust scatters light warm where it's thin, goes opaque/cool in its core
    vec3 c = mix(tint, uHaze, smoothstep(0.15, 0.7, body));
    return mix(col, c, body);
  }

  void main() {
    vec2 uv = vUv + uDrift / uRes;
    float aspect = uRes.x / max(uRes.y, 1.0);
    float t = uTime;

    // moment ripples: signed bend (field flinch) + positive wave (light)
    float bend = 0.0;
    float wave = 0.0;
    for (int i = 0; i < MAX_PULSES; i++) {
      float age = uPulseAge[i];
      if (age < 0.0) continue;
      float d = length(uv - uPulseOrigin[i]);
      float w = sin(d * 22.0 - age * 6.5) * exp(-d * 3.2 - age * 2.1) * uPulseStrength[i];
      bend += w;
      wave += max(w, 0.0);
    }

    // ---- sky
    vec3 col = mix(uSkyMid, uSkyTop, smoothstep(HOR + 0.05, 0.96, uv.y));
    col = mix(uSkyHor, col, smoothstep(HOR - 0.05, HOR + 0.30, uv.y));

    // sun: no disc, just a gentle warmth pooling behind the clouds
    vec2 sunP = vec2(uSunX, SUN_Y);
    float sd = length(vec2((uv.x - sunP.x) * aspect, uv.y - sunP.y));
    col += uSunGlow * (exp(-sd * sd * 30.0) * 0.20 + exp(-sd * 3.6) * 0.07) * uSun;
    // horizon light band — the far haze catches the glow
    col += uSunGlow * exp(-abs(uv.y - HOR) * 15.0) * 0.07 * (uSun + uMoon * 0.35);

    // ---- stars (sleep) — parallax-free, twinkling, thinning toward horizon
    if (uStars > 0.01 && uv.y > HOR) {
      vec2 sc = uv * vec2(aspect, 1.0) * 90.0 + vec2(t * 0.012, 0.0);
      vec2 cell = floor(sc);
      float sh = hash(cell);
      if (sh > 0.988) {
        float twk = 0.5 + 0.5 * sin(t * (1.2 + sh * 4.0) + sh * 40.0);
        float star = smoothstep(0.14, 0.03, length(fract(sc) - 0.5));
        float heightK = smoothstep(HOR + 0.04, HOR + 0.3, uv.y);
        col += mix(uCloudHi, vec3(1.0), 0.4) * star * twk * heightK * uStars * 0.8;
      }
    }

    // ---- moon (sleep): soft disc + halo, high right
    if (uMoon > 0.01) {
      vec2 mp = vec2(0.72, 0.80);
      float md = length(vec2((uv.x - mp.x) * aspect, uv.y - mp.y));
      float disc = smoothstep(0.036, 0.031, md);
      float dark = smoothstep(0.030, 0.024, length(vec2((uv.x - mp.x - 0.011) * aspect, uv.y - mp.y - 0.006)));
      col += uSunGlow * (max(disc - dark * 0.55, 0.0) * 0.9 + exp(-md * 10.0) * 0.22) * uMoon;
    }

    // ---- high cirrus wisps — thin streaks combed by the wind
    float cir = fbm(vec2(uv.x * aspect * 2.1 - t * 0.05, uv.y * 13.0));
    float cirA = smoothstep(0.56, 0.94, cir) * smoothstep(0.52, 0.8, uv.y);
    col = mix(col, uCloudHi, cirA * 0.10);

    // ---- cumulus: far layer drifts slow, near layer billows past faster
    col = cloudLayer(col, uv, aspect, t, 4.2, 0.030, 0.55, 19.0, sd, bend, false);
    col = cloudLayer(col, uv, aspect, t, 2.4, 0.055, 0.90, 3.0, sd, bend, true);

    // ---- dunes, back to front
    float lightK = uSun + uMoon * 0.5;
    float cloudShadow = smoothstep(0.5, 0.8, fbm(vec2(uv.x * aspect * 1.15 - t * 0.09, uv.y * 0.6 + 7.7)))
                      * (0.25 + 0.6 * uCover);
    float crest;
    duneLayer(col, crest, uv, aspect, t, 0.420, 0.020, 2.6, 11.0, 0.78, lightK, cloudShadow, bend, 0.0);
    duneLayer(col, crest, uv, aspect, t, 0.355, 0.030, 2.2, 23.0, 0.55, lightK, cloudShadow, bend, 0.0);
    duneLayer(col, crest, uv, aspect, t, 0.280, 0.042, 1.7, 37.0, 0.34, lightK, cloudShadow, bend, 0.0);

    // front two layers can shed sand: a low, continuous haze clings to the
    // crest and drifts downwind, breathing louder when a gust passes — never
    // popping fully on/off, so it reads as blown sand, not a flying speck
    duneLayer(col, crest, uv, aspect, t, 0.190, 0.058, 1.3, 51.0, 0.16, lightK, cloudShadow, bend, uGlintK * 0.6);
    float above3 = uv.y - crest;
    if (above3 > 0.0 && above3 < 0.05 && uStreamK > 0.001) {
      float haze = fbm(vec2(uv.x * aspect * 8.0 - t * 0.5, above3 * 50.0 - t * 0.6));
      float band = exp(-above3 * 46.0);
      float gust = 0.35 + 0.65 * gustEnv(uv.x, t, 51.0);
      col += uGlint * band * smoothstep(0.35, 0.9, haze) * gust * uStreamK * 0.11;
    }

    duneLayer(col, crest, uv, aspect, t, 0.085, 0.075, 1.0, 67.0, 0.0, lightK, cloudShadow, bend, uGlintK);
    float above4 = uv.y - crest;
    if (above4 > 0.0 && above4 < 0.05 && uStreamK > 0.001) {
      float haze = fbm(vec2(uv.x * aspect * 9.0 - t * 0.65, above4 * 46.0 - t * 0.75));
      float band = exp(-above4 * 40.0);
      float gust = 0.35 + 0.65 * gustEnv(uv.x, t, 67.0);
      col += uGlint * band * smoothstep(0.33, 0.88, haze) * gust * uStreamK * 0.13;
    }

    // ---- rolling dust cloud: an occasional event (§4.6 heartbeat-scheduled
    // from the CPU), never a permanent fixture. Two parallax layers — the
    // far one higher and paler along the horizon haze, the near one lower,
    // denser, and warmer as it crosses in front of the crests — travel
    // right→left at different speeds so the pair visibly separates.
    col = dustCloud(col, uv, aspect, t, uDustXFar, uDustAFar, uDustSeed,
                     0.47, 0.16, 0.62, mix(uHaze, uCloudHi, 0.35));
    col = dustCloud(col, uv, aspect, t, uDustXNear, uDustANear, uDustSeed + 4.1,
                     0.34, 0.22, 0.85, mix(uDuneLit, uSunGlow, 0.4));

    // ---- moment light rolls across the sand; the whole frame breathes with it
    col += uSunGlow * wave * (0.20 + 0.45 * smoothstep(HOR + 0.06, HOR - 0.22, uv.y));

    // lightning also throws a faint glow onto the sand
    col += uSunGlow * uFlash * 0.08;

    // soft shoulder: pastels below stay true, highlights roll off instead of clipping
    vec3 e = max(col - 0.86, vec3(0.0));
    col = min(col, vec3(0.86)) + e / (1.0 + e * 3.0);

    float grain = (hash(uv * uRes + t) - 0.5) * 0.035;
    col += grain;

    float edge = edgeMask(uv);
    col = mix(col, col * uVignetteColor, uVignette * edge);
    col *= uDim;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// grass: 3D instanced blade field — tapered quads with vertex wind, soft
// alpha edges, backlight coloring, plus a sky wash and a cheap bloom/trail
// composite so the right side blows out like the long-exposure reference.
// Used by GrassEngine (perspective camera in the field, not a 2D UV paint).

export const grassBladeVertexShader = /* glsl */ `
  attribute float aPhase;
  attribute float aLean;
  attribute float aHeight;
  attribute float aWidth;
  attribute float aShade;

  uniform float uTime;
  uniform float uWind;
  uniform float uGust;
  uniform vec3 uPulseOrigin[4];
  uniform float uPulseAge[4];
  uniform float uPulseStrength[4];

  varying vec2 vUv;
  varying float vShade;
  varying float vHeight;
  varying float vBacklit;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vShade = aShade;
    vHeight = position.y; // 0 root → 1 tip (pre-scale)

    vec3 pos = position;
    pos.x *= aWidth;
    pos.y *= aHeight;

    // tip bends more than root
    float tip = pow(clamp(position.y, 0.0, 1.0), 1.65);
    float t = uTime;
    float windAmp = uWind * (0.55 + uGust * 0.85);

    float sway =
      sin(t * 0.85 + aPhase) * 0.55 +
      sin(t * 1.55 + aPhase * 1.7) * 0.28 +
      sin(t * 3.2 + aPhase * 3.1) * 0.12 * uGust +
      sin(t * 0.35 + aPhase * 0.4) * 0.18;
    sway *= windAmp * tip;

    float nod =
      cos(t * 0.7 + aPhase * 1.3) * 0.08 * windAmp * tip;

    // lean the whole blade toward the light (+X)
    float lean = aLean + sway;
    pos.x += lean * tip * aHeight;
    pos.z += nod * aHeight;
    pos.y -= abs(sway) * 0.04 * tip * aHeight;

    // instanceMatrix is injected by Three when rendering InstancedMesh
    #ifdef USE_INSTANCING
      vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    #else
      vec3 root = vec3(0.0);
    #endif

    for (int i = 0; i < 4; i++) {
      if (uPulseAge[i] < 0.0) continue;
      float age = uPulseAge[i];
      vec2 o = uPulseOrigin[i].xz;
      float d = length(root.xz - o);
      float wave = sin(d * 2.4 - age * 5.0) * exp(-d * 0.55 - age * 1.7);
      pos.x += wave * uPulseStrength[i] * tip * 0.35;
    }

    #ifdef USE_INSTANCING
      vec4 world = modelMatrix * instanceMatrix * vec4(pos, 1.0);
    #else
      vec4 world = modelMatrix * vec4(pos, 1.0);
    #endif
    vWorldPos = world.xyz;

    // backlight factor: faces toward +X/+Y light read brighter at tips
    vec3 toLight = normalize(vec3(4.5, 3.2, -1.0) - world.xyz);
    vBacklit = clamp(dot(normalize(vec3(lean * 0.3, 1.0, 0.1)), toLight) * 0.5 + 0.5, 0.0, 1.0);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const grassBladeFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uGrassDeep;
  uniform vec3 uGrassMid;
  uniform vec3 uGrassLit;
  uniform vec3 uGrassTip;
  uniform vec3 uSunGlow;
  uniform float uBloom;
  uniform float uSun;
  uniform float uMoon;

  varying vec2 vUv;
  varying float vShade;
  varying float vHeight;
  varying float vBacklit;
  varying vec3 vWorldPos;

  void main() {
    // soft horizontal falloff — ethereal edges, never hard silhouettes
    float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
    float alpha = smoothstep(0.0, 0.45, edge);
    alpha *= smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.05, 0.72, vUv.y);
    // tips thin out
    alpha *= mix(1.0, 0.55, vHeight);
    if (alpha < 0.01) discard;

    float h = vHeight;
    vec3 col = mix(uGrassDeep, uGrassMid, smoothstep(0.0, 0.45, h) * (0.55 + vShade * 0.45));
    col = mix(col, uGrassLit, smoothstep(0.35, 0.85, h) * vBacklit);
    col = mix(col, uGrassTip, pow(h, 2.2) * vBacklit * (0.35 + uBloom * 0.4));

    // cream rim on backlit tips
    float rim = pow(h, 2.8) * vBacklit * uBloom * (uSun + uMoon * 0.45);
    col += uSunGlow * rim * 0.65;

    // denser/darker blades on the -X (left) side of the field
    float leftCrush = smoothstep(2.0, -3.5, vWorldPos.x);
    col *= mix(1.0, 0.72, leftCrush);

    gl_FragColor = vec4(col, alpha);
  }
`;

export const grassSkyVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const grassSkyFragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uSkyHor;
  uniform vec3 uSunGlow;
  uniform vec3 uHaze;
  uniform float uSun;
  uniform float uMoon;
  uniform float uStars;
  uniform float uBloom;
  uniform vec2 uSunDir; // xz direction of light in view-ish space, 0..1 mapped

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv;
    float lightX = smoothstep(0.0, 1.0, uv.x);
    float lightY = smoothstep(0.0, 1.0, uv.y);

    vec3 sky = mix(uSkyHor, uSkyMid, lightY * 0.7 + lightX * 0.3);
    sky = mix(sky, uSkyTop, lightX * lightY);

    vec2 lightPos = vec2(0.78, 0.72);
    float sunDist = length((uv - lightPos) * vec2(1.4, 1.0));
    float bloom = exp(-sunDist * sunDist * 2.2) * uBloom;
    float bloomWide = exp(-sunDist * 0.9) * uBloom * 0.55;

    sky = mix(sky, uSunGlow, bloom * 0.75 * (uSun + uMoon * 0.5));
    sky += uSunGlow * bloomWide * 0.5 * (uSun + uMoon * 0.4);
    sky = mix(sky, uHaze, bloomWide * 0.22);

    if (uSun > 0.02) {
      sky += uSunGlow * exp(-sunDist * sunDist * 32.0) * 1.1 * uSun;
    }
    if (uMoon > 0.02) {
      float md = length((uv - vec2(0.74, 0.80)) * vec2(1.3, 1.0));
      sky += uSunGlow * exp(-md * md * 60.0) * 0.8 * uMoon;
    }
    if (uStars > 0.01) {
      float star = step(0.997, hash(floor(uv * 420.0)));
      star *= hash(floor(uv * 420.0) + 19.0);
      sky += vec3(0.85, 0.9, 1.0) * star * uStars * lightY;
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

// Fullscreen triangle for post passes (NDC)
export const grassPostVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const grassBrightFragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
    float m = smoothstep(uThreshold, uThreshold + 0.35, lum);
    // bias toward the lit (right) side so the cream wash blooms harder
    m *= mix(0.55, 1.25, smoothstep(0.2, 0.95, vUv.x));
    gl_FragColor = vec4(c.rgb * m, 1.0);
  }
`;

export const grassBlurFragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  uniform vec2 uRes;
  varying vec2 vUv;
  void main() {
    vec2 px = uDirection / uRes;
    vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;
    c += texture2D(tDiffuse, vUv + px * 1.0).rgb * 0.1945946;
    c += texture2D(tDiffuse, vUv - px * 1.0).rgb * 0.1945946;
    c += texture2D(tDiffuse, vUv + px * 2.0).rgb * 0.1216216;
    c += texture2D(tDiffuse, vUv - px * 2.0).rgb * 0.1216216;
    c += texture2D(tDiffuse, vUv + px * 3.0).rgb * 0.054054;
    c += texture2D(tDiffuse, vUv - px * 3.0).rgb * 0.054054;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const grassCompositeFragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform sampler2D tTrail;
  uniform float uBloomStrength;
  uniform float uTrailMix;
  uniform float uVignette;
  uniform vec3 uVignetteColor;
  uniform float uDim;
  uniform vec2 uDrift;
  uniform vec2 uRes;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 uv = vUv + uDrift / max(uRes, vec2(1.0));
    vec3 scene = texture2D(tScene, uv).rgb;
    vec3 bloom = texture2D(tBloom, uv).rgb;
    vec3 trail = texture2D(tTrail, uv).rgb;

    // long-exposure smear: previous frame ghosts along the sway
    vec3 col = mix(scene, trail, uTrailMix);
    col += bloom * uBloomStrength;

    // right-side cream lift
    float wash = smoothstep(0.35, 1.0, uv.x);
    col = mix(col, col + bloom * 0.35, wash * 0.45);

    col += (hash(uv * uRes + uTime) - 0.5) * 0.035;

    vec2 d = abs(uv - 0.5) * 2.0;
    float edge = smoothstep(0.55, 1.0, max(d.x, d.y));
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
