export type CardPersonality = "monkeyclaw" | "velox" | "flowe" | "nexarad" | "etch";

export type CardUniforms = {
  resolution: [number, number];
  time: number;
  hover: number;
  active: number;
  pointer: [number, number];
  clickPulse: number;
  clickOrigin: [number, number];
  personality: CardPersonality;
  reducedMotion: number;
  blueIntensity: number;
  organicAmount: number;
  thickness: number;
  causticSpeed: number;
  rimSoftness: number;
  specularIntensity: number;
  lowerWeight: number;
  edgeSoftness: number;
  seed: number;
};

export type CardPersonalityPreset = Omit<
  CardUniforms,
  "resolution" | "time" | "hover" | "active" | "pointer" | "clickPulse" | "clickOrigin" | "personality"
>;

export const PERSONALITY_PRESETS: Record<CardPersonality, CardPersonalityPreset> = {
  monkeyclaw: {
    reducedMotion: 0,
    blueIntensity: 0.74,
    organicAmount: 0.16,
    thickness: 1.14,
    causticSpeed: 0.85,
    rimSoftness: 0.44,
    specularIntensity: 0.92,
    lowerWeight: 1.08,
    edgeSoftness: 0.54,
    seed: 12.7,
  },
  velox: {
    reducedMotion: 0,
    blueIntensity: 0.56,
    organicAmount: 0.12,
    thickness: 1.02,
    causticSpeed: 1.45,
    rimSoftness: 0.56,
    specularIntensity: 1.02,
    lowerWeight: 0.88,
    edgeSoftness: 0.68,
    seed: 34.1,
  },
  flowe: {
    reducedMotion: 0,
    blueIntensity: 0.62,
    organicAmount: 0.14,
    thickness: 1.08,
    causticSpeed: 0.68,
    rimSoftness: 0.50,
    specularIntensity: 0.84,
    lowerWeight: 0.98,
    edgeSoftness: 0.62,
    seed: 56.3,
  },
  nexarad: {
    reducedMotion: 0,
    blueIntensity: 0.86,
    organicAmount: 0.15,
    thickness: 1.22,
    causticSpeed: 1.05,
    rimSoftness: 0.40,
    specularIntensity: 1.02,
    lowerWeight: 1.12,
    edgeSoftness: 0.48,
    seed: 78.9,
  },
  etch: {
    reducedMotion: 0,
    blueIntensity: 0.64,
    organicAmount: 0.12,
    thickness: 0.98,
    causticSpeed: 1.18,
    rimSoftness: 0.54,
    specularIntensity: 0.96,
    lowerWeight: 0.92,
    edgeSoftness: 0.60,
    seed: 91.4,
  },
};

export const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_hover;
  uniform float u_active;
  uniform vec2 u_pointer;
  uniform float u_clickPulse;
  uniform vec2 u_clickOrigin;
  uniform float u_blueIntensity;
  uniform float u_organicAmount;
  uniform float u_thickness;
  uniform float u_causticSpeed;
  uniform float u_rimSoftness;
  uniform float u_specularIntensity;
  uniform float u_lowerWeight;
  uniform float u_edgeSoftness;
  uniform float u_seed;
  uniform float u_reducedMotion;

  const vec3 COLOR_BLUE = vec3(0.118, 0.435, 1.0);
  const vec3 COLOR_BLUE_SOFT = vec3(0.184, 0.502, 1.0);
  const vec3 COLOR_BLUE_GLOW = vec3(0.369, 0.635, 1.0);
  const vec3 COLOR_WHITE = vec3(1.0, 1.0, 1.0);
  const vec3 COLOR_FROST = vec3(0.976, 0.988, 1.0);
  const vec3 COLOR_SHADOW = vec3(0.42, 0.51, 0.62);

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123 + u_seed);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  float sdRoundedRect(vec2 p, vec2 b, vec4 r) {
    r.xy = (p.x > 0.0) ? r.yz : r.xw;
    r.x = (p.y > 0.0) ? r.x : r.y;
    vec2 q = abs(p) - b + r.x;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r.x;
  }

  float organicEdge(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.045 + t * 0.35) * 1.0;
    h += sin(p.y * 0.032 + t * 0.22) * 0.8;
    h += sin((p.x * 0.7 + p.y) * 0.018 + t * 0.14) * 1.1;
    h += sin(p.x * 0.12 + p.y * 0.08 + t * 0.28) * 0.35;
    h += sin(length(p) * 0.04 - t * 0.2) * 0.45;
    return h;
  }

  float caustics(vec2 p, float t) {
    vec2 q = p * 0.012;
    float c = 0.0;
    c += sin(q.x * 1.0 + t * 0.4);
    c += sin(q.y * 1.3 + t * 0.3);
    c += sin((q.x + q.y) * 1.1 + t * 0.5);
    c += sin(length(q) * 2.0 - t * 0.2);
    c += fbm(q * 2.0 + t * 0.1) * 0.5;
    c = c * 0.25 + 0.5;
    return pow(c, 2.2);
  }

  float pointerRipple(vec2 p, vec2 center, float strength) {
    float d = length(p - center);
    float ripple = sin(d * 0.18 - u_time * 5.0) * exp(-d * 0.012);
    return ripple * strength * 4.0;
  }

  float clickWave(vec2 p, vec2 origin, float pulse) {
    if (pulse <= 0.0) return 0.0;
    float d = length(p - origin);
    float wave = sin(d * 0.14 - pulse * 18.0) * exp(-d * 0.006);
    return wave * pulse * 6.0;
  }

  void main() {
    vec2 px = vUv * u_resolution;
    vec2 center = u_resolution * 0.5;
    vec2 p = px - center;

    float motion = 1.0 - u_reducedMotion;
    float t = u_time * motion;

    float morph = u_hover * 0.72 + u_active * 0.36;

    vec2 halfSize = u_resolution * 0.5 - vec2(15.0);
    vec2 safeSize = halfSize - vec2(8.0);
    float pillRadius = min(safeSize.y * 0.98, safeSize.x * 0.34);

    vec4 cornerRadii = mix(
      vec4(pillRadius),
      vec4(pillRadius * 0.96),
      morph
    );

    cornerRadii += vec4(
      sin(u_seed) * 1.0,
      cos(u_seed * 0.7) * 0.8,
      sin(u_seed * 1.3) * 0.9,
      cos(u_seed * 1.7) * 0.8
    ) * (1.0 - morph);

    float sdf = sdRoundedRect(p, safeSize, cornerRadii);

    float edgeNoise = organicEdge(p, t * 0.5) * u_organicAmount * (1.0 - morph) * 0.62;

    float arrowRadius = min(u_resolution.y * 0.28, 30.0);
    vec2 arrowCenter = vec2(safeSize.x - 36.0, 0.0);
    float arrowDist = length(p - arrowCenter);
    float arrowPocket = arrowDist - arrowRadius;
    float arrowPocketShape = smoothstep(0.0, -arrowRadius, arrowPocket);
    float pocketNoiseDamp = smoothstep(0.0, 70.0, arrowDist);
    edgeNoise *= pocketNoiseDamp;
    sdf += edgeNoise;
    sdf += arrowPocketShape * 1.2;

    float pointerDist = length(px - u_pointer);
    float pointerStrength = u_hover * smoothstep(175.0, 0.0, pointerDist);
    float pressure = exp(-pointerDist * 0.018) * u_hover;
    float edgeBulge = pointerStrength * 4.8 * smoothstep(0.0, 34.0, abs(sdf));
    float ripple = pointerRipple(px, u_pointer, pointerStrength);
    float wave = clickWave(px, u_clickOrigin, u_clickPulse);
    sdf += ripple * 0.55 + wave * 0.65 - edgeBulge - pressure * 1.4;

    float rimWidth = mix(24.0, 18.0, morph) * u_thickness;
    float innerPad = mix(13.0, 8.0, morph);

    float outerShadow = (1.0 - smoothstep(0.0, 42.0, sdf)) * smoothstep(0.0, 2.0, sdf);
    float contactShadow = (1.0 - smoothstep(0.0, 24.0, sdf)) * smoothstep(0.0, 1.0, sdf);
    float rimMask = smoothstep(rimWidth, -2.0, sdf) * (1.0 - smoothstep(-innerPad, 0.0, sdf));
    float bodyMask = smoothstep(0.0, -2.0, sdf);
    float innerMask = smoothstep(-innerPad, -innerPad - 6.0, sdf);
    float edgeMask = smoothstep(9.0, -2.0, sdf) * (1.0 - smoothstep(-rimWidth * 1.25, -rimWidth * 2.0, sdf));

    float lowerEdge = 1.0 - smoothstep(center.y - halfSize.y * 0.52, center.y + halfSize.y * 0.68, px.y);
    float lowerFactor = pow(lowerEdge, 1.72) * u_lowerWeight;
    float bottomBand = exp(-pow((px.y - 17.0) / max(u_resolution.y * 0.18, 1.0), 2.0)) * bodyMask;

    vec4 fragColor = vec4(0.0);

    vec3 shadowColor = mix(COLOR_SHADOW, COLOR_BLUE, 0.08) * 0.30;
    fragColor.rgb += shadowColor * outerShadow * 0.50;
    fragColor.rgb += COLOR_BLUE * contactShadow * lowerFactor * 0.12 * u_blueIntensity;
    fragColor.a += outerShadow * 0.24 + contactShadow * lowerFactor * 0.16;

    float caustic = caustics(px * 0.85, t * u_causticSpeed);
    float sidePressure = smoothstep(safeSize.x * 0.55, safeSize.x, abs(p.x)) * bodyMask;
    float causticMask = edgeMask * lowerFactor * 1.18 * u_blueIntensity;
    causticMask += edgeMask * sidePressure * 0.58 * u_blueIntensity;
    causticMask += bodyMask * lowerFactor * 0.14 * u_blueIntensity;
    causticMask += bottomBand * 0.58 * u_blueIntensity;
    causticMask *= smoothstep(0.0, -8.0, sdf) * 0.78 + smoothstep(0.0, 4.0, sdf) * 0.12;
    causticMask = clamp(causticMask, 0.0, 1.0);
    vec3 blueGlow = mix(COLOR_BLUE, COLOR_BLUE_GLOW, caustic * 0.7);
    blueGlow = mix(blueGlow, COLOR_BLUE_SOFT, lowerFactor * 0.45);
    fragColor.rgb += blueGlow * causticMask * caustic * 1.34;
    fragColor.a += causticMask * caustic * 0.46;

    vec3 bodyColor = COLOR_FROST;
    float bodyAlpha = mix(0.46, 0.58, morph) * bodyMask;
    float cloud = fbm(px * 0.014 + t * 0.006) * 0.5 + 0.5;
    float frostVeil = fbm(px * 0.025 + vec2(t * 0.014, -t * 0.009)) * innerMask;
    bodyColor = mix(bodyColor, COLOR_WHITE, cloud * 0.22 * innerMask);
    bodyColor -= COLOR_SHADOW * frostVeil * 0.030;
    bodyColor += COLOR_BLUE_GLOW * bottomBand * caustic * 0.24 * u_blueIntensity;
    bodyAlpha *= 1.0 + innerMask * 0.08 + lowerFactor * 0.05;
    fragColor.rgb += bodyColor * bodyAlpha;
    fragColor.a += bodyAlpha;

    float innerShadow = smoothstep(-rimWidth * 0.45, -rimWidth * 1.35, sdf) * bodyMask;
    innerShadow *= 1.0 - smoothstep(-rimWidth * 1.35, -rimWidth * 2.8, sdf);
    float lowerPocket = pow(lowerEdge, 2.35) * bodyMask;
    fragColor.rgb -= mix(COLOR_SHADOW, COLOR_BLUE, 0.08) * innerShadow * 0.15;
    fragColor.rgb -= COLOR_BLUE * lowerPocket * u_blueIntensity * 0.035;
    fragColor.a += innerShadow * 0.16 + lowerPocket * 0.08;

    float rimLight = pow(1.0 - clamp(abs(sdf) / rimWidth, 0.0, 1.0), 1.6 + u_rimSoftness * 0.8);
    rimLight *= rimMask;
    rimLight *= 1.0 + lowerFactor * 0.18;
    vec2 lightDir = normalize(vec2(-0.8, -0.6));
    vec2 surfGrad = normalize(p + vec2(0.001, 0.001));
    float diffuse = max(dot(surfGrad, lightDir), 0.0);
    vec3 rimColor = mix(COLOR_WHITE, COLOR_BLUE_GLOW, (1.0 - diffuse) * 0.34 * lowerFactor);
    fragColor.rgb += rimColor * rimLight * 1.48 * u_specularIntensity;
    fragColor.a += rimLight * 0.84;

    float meniscus = smoothstep(0.0, -18.0, sdf) * (1.0 - smoothstep(-28.0, -64.0, sdf));
    meniscus *= lowerFactor * (0.72 + 0.28 * caustic);
    fragColor.rgb += mix(COLOR_WHITE, COLOR_BLUE_GLOW, 0.48) * meniscus * 0.96 * u_blueIntensity;
    fragColor.a += meniscus * 0.36;

    float streaks = sin(px.x * 0.012 + px.y * 0.004 + t * 0.04) * 0.5 + 0.5;
    streaks *= smoothstep(0.0, 1.0, fbm(px * 0.022 + vec2(t * 0.012, 0.0)));
    streaks *= innerMask * 0.14;
    fragColor.rgb += COLOR_WHITE * streaks * 0.22;

    float topT = smoothstep(center.y + halfSize.y * 0.2, center.y + halfSize.y, px.y);
    float topSheen = pow(topT, 2.2) * innerMask * 0.75 * u_specularIntensity;
    float glint = sin(px.x * 0.018 + t * 0.12) * 0.5 + 0.5;
    topSheen *= mix(0.7, 1.0, glint);
    fragColor.rgb += COLOR_WHITE * topSheen * 0.72;
    fragColor.a += topSheen * 0.28;

    float convex = smoothstep(0.35, 0.95, organicEdge(px, t * 0.4 + 1.0));
    float glintMask = smoothstep(0.0, 6.0, sdf) * (1.0 - smoothstep(0.0, -rimWidth, sdf));
    fragColor.rgb += COLOR_WHITE * convex * glintMask * 0.32 * u_specularIntensity;
    fragColor.a += convex * glintMask * 0.12;

    float pocketRimMask = smoothstep(0.0, 10.0, arrowPocket + 6.0) * (1.0 - smoothstep(-6.0, -14.0, arrowPocket));
    pocketRimMask *= bodyMask;
    fragColor.rgb += COLOR_WHITE * pocketRimMask * 0.22 * u_specularIntensity;
    fragColor.rgb += COLOR_BLUE_GLOW * pocketRimMask * 0.06 * u_blueIntensity;
    fragColor.a += pocketRimMask * 0.07;

    fragColor.rgb *= 1.0 - u_active * 0.05;
    fragColor.a *= 1.0 - u_active * 0.04;

    fragColor.rgb = pow(fragColor.rgb, vec3(0.92));
    float capsuleAlpha = clamp(bodyMask + rimMask + edgeMask + outerShadow * 0.42, 0.0, 1.0);
    fragColor.a = clamp(fragColor.a, 0.0, 0.82) * capsuleAlpha;

    gl_FragColor = fragColor;
  }
`;
