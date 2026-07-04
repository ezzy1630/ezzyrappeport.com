export const VERTEX_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const FRAGMENT_SOURCE = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_energy;
uniform vec2 u_pointer;
uniform vec4 u_ripples[12];
uniform sampler2D u_texture;
uniform sampler2D u_text;
uniform float u_nameOpacity;

in vec2 v_uv;
out vec4 outColor;

#define MENISCUS_AMP 0.62
#define REFRACTION   0.192
#define RIM_AMP      2.18
#define SPEC_SHINE   92.0
#define SPEC_AMP     1.08
#define FRES_AMP     1.28
#define DOME_AMP     0.54
#define GLOSS_AMP    0.96
#define CAUSTIC_AMP  0.40
#define BUBBLE_RIM   1.32

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
  vec2 m = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, m.x), mix(c, d, m.x), m.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += noise(p) * a;
    p = mat2(1.62, 1.08, -1.08, 1.62) * p + 9.7;
    a *= 0.52;
  }
  return v;
}

float fbm3(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += noise(p) * a;
    p = mat2(1.62, 1.08, -1.08, 1.62) * p + 9.7;
    a *= 0.52;
  }
  return v;
}

float ridge(float v, float w) {
  return 1.0 - smoothstep(0.0, w, abs(v));
}

float ellipseRing(vec2 uv, vec2 c, float r, vec2 squash, float w) {
  float d = length((uv - c) * squash);
  return ridge(d - r, w);
}

float caustics(vec2 p, float time) {
  float v = 0.0;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    float s = 1.0 + float(i) * 0.35;
    v += abs(sin(p.x * 12.0 * s + time * 0.45) + sin(p.y * 10.0 * s - time * 0.35)) * (0.5 / s);
    p = rot * p * 1.35 + float(i) * 1.3;
  }
  return v / 2.5;
}

vec2 cursorLens(vec2 uv, vec2 pointer, out float lens) {
  float d = distance(uv, pointer);
  lens = exp(-d * 5.5) * (0.45 + u_energy * 0.85);
  vec2 dir = uv - pointer;
  float len = length(dir);
  vec2 n = len > 0.0001 ? dir / len : vec2(0.0);
  return n * lens * 0.022;
}

vec3 rippleField(vec2 pos, vec2 pointer, float time) {
  float blue = 0.0;
  float white = 0.0;
  float warp = 0.0;

  float dp = distance(pos, pointer);
  float pr = sin(dp * 32.0 - time * 5.5);
  float penv = exp(-dp * 3.6) * u_energy;
  float phalo = exp(-dp * 2.5) * u_energy;
  blue += max(pr, 0.0) * penv * 0.18 + phalo * 0.032;
  white += ridge(dp - 0.078 - sin(time * 1.2) * 0.009, 0.018) * penv * 0.32;
  warp += pr * penv * 0.022;

  for (int i = 0; i < 12; i++) {
    vec4 r = u_ripples[i];
    float age = time - r.z;
    if (age > 0.0 && age < 3.2 && r.w > 0.001) {
      float d = distance(pos * u_resolution, r.xy);
      float radius = 24.0 + age * 155.0;
      float ring = sin((d - radius) * 0.058);
      float env = exp(-abs(d - radius) / 86.0) * (1.0 - age / 3.2) * r.w;
      blue += max(ring, 0.0) * env * 0.38;
      white += max(-ring, 0.0) * env * 0.50;
      warp += ring * env * 0.042;
    }
  }

  return vec3(blue, white, warp);
}

float textCov(vec2 uv) {
  return texture(u_text, uv).a * u_nameOpacity;
}

float textSurfH(vec2 uv, float time) {
  float c = textCov(uv);
  float edge = 4.0 * c * (1.0 - c);
  float dome = smoothstep(0.18, 0.88, c);
  float hardEdge = pow(edge, 0.70);
  float meniscus = (pow(edge, 0.98) * 0.68 + hardEdge * 0.32) * MENISCUS_AMP;
  float sphereCap = pow(max(c, 0.0), 0.42) * dome;
  float bubble = sphereCap * DOME_AMP + meniscus;
  float phase = sin(uv.x * 19.0 + uv.y * 11.0) * 6.28318;
  bubble += sin(time * 0.62 + phase) * 0.009 * dome;
  bubble += cos(time * 0.48 + phase * 1.3) * 0.007 * dome;
  return bubble;
}

float surfH(vec2 uv, float time, vec2 pointer) {
  float c = textCov(uv);
  float textH = textSurfH(uv, time);
  float liquid = fbm(uv * 3.5 + vec2(time * 0.03, -time * 0.02)) * 0.012;
  float dp = distance(uv, pointer);
  float dent = -exp(-dp * 4.0) * 0.06 * u_energy;
  return textH + liquid * (1.0 - c * 0.5) + dent;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float t = u_time;
  vec2 pointer = vec2(u_pointer.x / u_resolution.x, 1.0 - u_pointer.y / u_resolution.y);
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float mobilePoster = smoothstep(0.82, 0.56, aspect);

  float lensStrength;
  vec2 lensOffset = cursorLens(uv, pointer, lensStrength);

  float flowA = fbm(p * 1.9 + vec2(t * 0.026, -t * 0.014));
  float flowB = fbm(p * 3.6 + vec2(-t * 0.038, t * 0.020));
  float flowC = fbm(p * 6.2 + vec2(t * 0.052, t * 0.030));
  vec3 ripple = rippleField(uv, pointer, t);

  p.x += (flowA - 0.5) * 0.028 + ripple.z;
  p.y += (flowB - 0.5) * 0.020 + ripple.z * 0.42;

  vec2 baseUV = uv + lensOffset;
  vec2 flowUV = clamp(baseUV + vec2((flowA - 0.5) * 0.018, (flowB - 0.5) * 0.014), vec2(0.0), vec2(1.0));

  vec3 pearlBlue = vec3(0.09, 0.55, 1.0);
  vec3 pearlWhite = vec3(0.969, 0.976, 0.988);
  vec3 softSilver = vec3(0.867, 0.890, 0.925);
  vec3 base = texture(u_texture, flowUV).rgb;
  base = mix(base, pearlWhite, 0.22);
  base += vec3(0.008, 0.008, 0.012);

  float caustic = caustics(p * 2.8, t * 0.25);
  caustic += caustics(p * 4.2 + vec2(t * 0.1), t * 0.35) * 0.5;
  float causticMask = smoothstep(0.3, 0.9, flowC) * 0.35;
  vec3 causticLight = vec3(1.0, 0.98, 0.95) * caustic * CAUSTIC_AMP * (0.7 + causticMask);
  float bottomZone = smoothstep(0.55, 0.0, uv.y) * 0.42;
    base += causticLight * (1.0 + bottomZone);

  float sampleWarp = ripple.z + lensOffset.x * 8.0;

  float cov = textCov(uv);
  float edge = 4.0 * cov * (1.0 - cov);
  float interior = smoothstep(0.55, 0.92, cov);
  float shoulder = smoothstep(0.04, 0.36, cov) * (1.0 - smoothstep(0.56, 0.96, cov));

  float belowCov = textCov(uv + vec2(0.0, 0.023));
  float contact = smoothstep(0.06, 0.5, belowCov) * (1.0 - smoothstep(0.0, 0.30, cov));
  base -= vec3(0.16, 0.17, 0.19) * contact * 0.88;
  base += pearlBlue * contact * 0.028;

  vec2 eps2 = vec2(2.0 / u_resolution.x, 2.0 / u_resolution.y);
  vec2 bevelPx = vec2(7.0 / u_resolution.x, 7.0 / u_resolution.y);
  float cXp = textCov(uv + vec2(bevelPx.x, 0.0));
  float cXm = textCov(uv - vec2(bevelPx.x, 0.0));
  float cYp = textCov(uv + vec2(0.0, bevelPx.y));
  float cYm = textCov(uv - vec2(0.0, bevelPx.y));
  float cDp = textCov(uv + bevelPx);
  float cDm = textCov(uv - bevelPx);
  float cDa = textCov(uv + vec2(bevelPx.x, -bevelPx.y));
  float cDb = textCov(uv + vec2(-bevelPx.x, bevelPx.y));
  float maxNear = max(max(max(cXp, cXm), max(cYp, cYm)), max(max(cDp, cDm), max(cDa, cDb)));
  float minNear = min(min(min(cXp, cXm), min(cYp, cYm)), min(min(cDp, cDm), min(cDa, cDb)));
  float wideBevel = smoothstep(0.05, 0.46, maxNear - minNear);
  float outsideRidge = wideBevel * (1.0 - smoothstep(0.28, 0.78, cov));
  float insideRidge = wideBevel * smoothstep(0.22, 0.82, cov);

  float hR = surfH(uv + vec2(eps2.x, 0.0), t, pointer);
  float hL = surfH(uv - vec2(eps2.x, 0.0), t, pointer);
  float hU = surfH(uv + vec2(0.0, eps2.y), t, pointer);
  float hD = surfH(uv - vec2(0.0, eps2.y), t, pointer);
  vec2 hgrad = vec2(hR - hL, hU - hD) / (2.0 * max(eps2.x, eps2.y));
  vec3 n = normalize(vec3(-hgrad.x * 0.5, -hgrad.y * 0.5, 1.0));

  float glassDepth = smoothstep(0.14, 0.96, cov);
  float chroma = edge * 0.0125 + shoulder * 0.0055 + glassDepth * 0.0028;
  vec2 refrBase = uv + n.xy * REFRACTION * (0.76 + edge * 3.4 + glassDepth * 0.66) + sampleWarp * 0.62;
  vec2 refrR = refrBase + lensOffset * 1.2 + vec2(chroma, -chroma * 0.32);
  vec2 refrG = refrBase + lensOffset * 1.0;
  vec2 refrB = refrBase + lensOffset * 0.8 - vec2(chroma * 1.15, -chroma * 0.24);
  float r = texture(u_texture, clamp(refrR, vec2(0.0), vec2(1.0))).r * 0.96 + 0.012;
  float g = texture(u_texture, clamp(refrG, vec2(0.0), vec2(1.0))).g * 0.98 + 0.014;
  float b = texture(u_texture, clamp(refrB, vec2(0.0), vec2(1.0))).b * 1.02 + 0.026;
  vec3 refrBg = vec3(r, g, b) * vec3(0.96, 0.98, 1.0) + vec3(0.010, 0.014, 0.026);

  vec3 frost = vec3(0.965, 0.985, 1.0);
  vec3 letterBody = mix(refrBg, frost, 0.055);

  float bodyGrad = smoothstep(0.13, 0.55, uv.y);
  letterBody += vec3(0.06, 0.065, 0.078) * (1.0 - bodyGrad) * interior;
  letterBody -= vec3(0.075, 0.09, 0.12) * bodyGrad * interior;

  float occ = smoothstep(0.72, 1.0, cov);
  vec2 innerDrift = vec2(
    fbm3(uv * 8.0 + vec2(t * 0.08, -t * 0.04)) - 0.5,
    fbm3(uv * 8.0 + vec2(-t * 0.06, t * 0.07)) - 0.5
  );
  float internalVein = fbm3((uv + innerDrift * 0.018) * vec2(14.0, 9.0) + t * 0.035);
  float depthPocket = smoothstep(0.36, 0.88, internalVein) * interior;
  letterBody -= vec3(0.08, 0.11, 0.17) * occ * 0.28;
  letterBody -= vec3(0.07, 0.10, 0.18) * depthPocket * 0.22;
  letterBody += vec3(0.98, 0.995, 1.0) * shoulder * 0.48;
  letterBody += vec3(0.96, 0.99, 1.0) * insideRidge * 0.68;

  vec3 lightDir = normalize(vec3(-0.48, -0.56, 0.68));
  float spec = pow(max(dot(n, lightDir), 0.0), SPEC_SHINE);
  letterBody += vec3(1.0) * spec * SPEC_AMP * (interior + shoulder * 0.7);

  vec3 topLight = normalize(vec3(-0.12, -0.86, 0.52));
  float gloss = pow(max(dot(n, topLight), 0.0), 6.8);
  letterBody += vec3(1.0, 0.99, 0.97) * gloss * GLOSS_AMP * interior;
  float blade = pow(max(dot(n, normalize(vec3(0.66, -0.38, 0.64))), 0.0), 34.0);
  letterBody += vec3(1.0, 0.98, 0.92) * blade * 0.26 * (interior + shoulder);

  float fill = pow(max(dot(n, vec3(0.0, -0.6, 0.8)), 0.0), 2.5);
  letterBody += vec3(0.85, 0.9, 1.0) * fill * 0.07 * interior;

  float shade = smoothstep(0.05, 0.5, n.y);
  letterBody -= vec3(0.10, 0.12, 0.16) * shade * interior * 0.60;

  float fres = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 5.0);
  letterBody += vec3(1.0) * fres * FRES_AMP;
  vec3 irid = mix(vec3(0.55, 0.78, 1.0), vec3(0.92, 0.86, 1.0),
                  0.5 + 0.5 * sin(n.x * 6.0 + n.y * 5.0 + t * 0.5));
  letterBody += irid * fres * 0.08 * interior;

  float blueZone = smoothstep(0.5, 0.95, uv.x) * (1.0 - smoothstep(0.45, 0.9, uv.y));
  float cursorBlue = exp(-distance(uv, pointer) * 5.0) * u_energy;
  letterBody += pearlBlue * (blueZone * 0.10 + cursorBlue * 0.06) * interior;

  float cAbove = textCov(uv + vec2(0.0, 3.5 / u_resolution.y));
  float cLeft = textCov(uv + vec2(-3.5 / u_resolution.x, 0.0));
  float bubbleCrown = smoothstep(0.35, 0.88, cov) * (1.0 - smoothstep(0.0, 0.42, cAbove));
  float bubbleGlare = pow(max(dot(n, normalize(vec3(-0.38, -0.72, 0.58))), 0.0), 18.0);
  letterBody += vec3(1.0, 0.99, 0.97) * bubbleGlare * bubbleCrown * 1.24;
  letterBody += vec3(0.92, 0.97, 1.0) * bubbleCrown * (0.18 + cLeft * 0.08);

  float innerRim = smoothstep(0.18, 0.82, edge) * (1.0 - smoothstep(0.82, 1.0, cov));
  float rim = smoothstep(0.14, 0.84, edge);
  float letterMask = smoothstep(0.06, 0.28, cov);
  vec3 color = base;
  color = mix(color, letterBody, letterMask * (0.62 + mobilePoster * 0.14));
  color += vec3(1.0) * rim * (RIM_AMP * (1.74 + mobilePoster * 0.30)) * (1.0 - letterMask * 0.20);
  color += vec3(1.0) * rim * BUBBLE_RIM * bubbleCrown * 0.42;
  color += vec3(0.98, 1.0, 1.0) * outsideRidge * (1.72 + mobilePoster * 0.28);
  color += pearlBlue * outsideRidge * (0.24 + mobilePoster * 0.08);
  color += pearlBlue * rim * (0.28 + mobilePoster * 0.10) * (1.0 - letterMask * 0.24);
  color += pearlWhite * outsideRidge * (0.58 + mobilePoster * 0.28);
  color += softSilver * rim * (0.48 + mobilePoster * 0.16) * (1.0 - letterMask * 0.18);
  color += vec3(0.94, 0.99, 1.0) * innerRim * (1.18 + mobilePoster * 0.18) * letterMask;
  color += vec3(1.0) * spec * (0.72 + mobilePoster * 0.18) * (rim + insideRidge);
  color += pearlBlue * shoulder * caustic * 0.20;
  float coolLetterMask = clamp(letterMask + outsideRidge * 0.72 + insideRidge * 0.38, 0.0, 1.0);
  float letterLum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 cooledLetter = vec3(letterLum * 0.82, letterLum * 0.92, min(1.0, letterLum * 1.06 + 0.06));
  cooledLetter += pearlBlue * (outsideRidge * 0.16 + shoulder * 0.03);
  color = mix(color, cooledLetter, coolLetterMask * 0.26);
  color -= vec3(0.10, 0.13, 0.17) * interior * (0.34 + mobilePoster * 0.10);
  color -= vec3(0.05, 0.07, 0.10) * shoulder * (0.42 + mobilePoster * 0.16);
  color += vec3(1.0, 1.0, 0.98) * outsideRidge * (0.60 + mobilePoster * 0.22);

  color += pearlBlue * ripple.x * 0.14 + vec3(1.0) * ripple.y * 0.42;
  float wake = exp(-distance(uv, pointer) * 5.5) * u_energy;
  color += pearlBlue * wake * 0.03 + pearlWhite * wake * 0.08;

  color += pearlWhite * lensStrength * 0.06 + pearlBlue * lensStrength * 0.03;

  float vignette = smoothstep(1.25, 0.12, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
  color = mix(color * pearlWhite, color, vignette);
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.97)), 1.0);
}
`;
