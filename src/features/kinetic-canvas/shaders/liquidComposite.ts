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
uniform vec4 u_ripples[8];
uniform sampler2D u_texture;
uniform sampler2D u_text;
uniform sampler2D u_heightField;
uniform sampler2D u_normalField;
uniform sampler2D u_obstacleField;
uniform float u_nameOpacity;
uniform float u_sceneIntensity;
uniform vec4 u_scroll;

in vec2 v_uv;
out vec4 outColor;

float ridge(float value, float width) {
  return 1.0 - smoothstep(0.0, width, abs(value));
}

float ellipseRing(vec2 uv, vec2 center, float radius, vec2 squash, float width) {
  float distanceToCenter = length((uv - center) * squash);
  return ridge(distanceToCenter - radius, width);
}

float bubbleDisc(vec2 uv, vec2 center, float radius, vec2 squash) {
  float distanceToCenter = length((uv - center) * squash);
  return 1.0 - smoothstep(radius * 0.58, radius, distanceToCenter);
}

float bubbleArc(vec2 uv, vec2 center, float radius, vec2 squash, vec2 lightDirection) {
  vec2 local = (uv - center) * squash;
  float ring = ellipseRing(uv, center, radius, squash, 0.006);
  float direction = 0.5 + 0.5 * dot(normalize(local + vec2(0.0001)), normalize(lightDirection));
  return ring * smoothstep(0.18, 0.76, direction);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float caustics(vec2 p, float time) {
  float value = 0.0;
  mat2 rotation = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 2; i++) {
    float scale = 1.0 + float(i) * 0.35;
    value += abs(
      sin(p.x * 12.0 * scale + time * 0.45) +
      sin(p.y * 10.0 * scale - time * 0.35)
    ) * (0.5 / scale);
    p = rotation * p * 1.35 + float(i) * 1.3;
  }
  return value / 1.45;
}

vec2 cursorLens(vec2 uv, vec2 pointer, out float lens) {
  float distanceToPointer = distance(uv, pointer);
  lens = exp(-distanceToPointer * 5.5) * (0.45 + u_energy * 0.85);
  vec2 direction = uv - pointer;
  float lengthDirection = length(direction);
  vec2 normal = lengthDirection > 0.0001 ? direction / lengthDirection : vec2(0.0);
  return normal * lens * 0.022;
}

vec3 rippleField(vec2 position, vec2 pointer, float time) {
  float blue = 0.0;
  float white = 0.0;
  float warp = 0.0;
  float distanceToPointer = distance(position, pointer);
  float pulse = sin(distanceToPointer * 32.0 - time * 5.5);
  float envelope = exp(-distanceToPointer * 3.6) * u_energy;
  blue += max(pulse, 0.0) * envelope * 0.18;
  white += ridge(distanceToPointer - 0.078 - sin(time * 1.2) * 0.009, 0.018) * envelope * 0.32;
  warp += pulse * envelope * 0.022;

  for (int i = 0; i < 8; i++) {
    vec4 ripple = u_ripples[i];
    float age = time - ripple.z;
    if (age > 0.0 && age < 3.2 && ripple.w > 0.001) {
      float distanceToRipple = distance(position * u_resolution, ripple.xy);
      float radius = 24.0 + age * 155.0;
      float ring = sin((distanceToRipple - radius) * 0.058);
      float rippleEnvelope = exp(-abs(distanceToRipple - radius) / 86.0) * (1.0 - age / 3.2) * ripple.w;
      blue += max(ring, 0.0) * rippleEnvelope * 0.30;
      white += max(-ring, 0.0) * rippleEnvelope * 0.34;
      warp += ring * rippleEnvelope * 0.028;
    }
  }
  return vec3(blue, white, warp);
}

float roundedBox(vec2 p, vec2 bounds, float radius) {
  vec2 q = abs(p) - bounds + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float liquidMembrane(
  vec2 local,
  vec2 halfSize,
  float seed,
  float organicAmount,
  float causticSpeed,
  float hover,
  float pressed,
  float time,
  float membraneScale
) {
  vec2 pressureSize = halfSize * vec2(1.0 + pressed * 0.010, 1.0 - pressed * 0.018);
  vec2 normalized = local / max(pressureSize, vec2(1.0));
  float angle = atan(normalized.y, normalized.x);
  float radius = pressureSize.y * mix(0.42, 0.55, organicAmount);
  float base = roundedBox(
    local,
    pressureSize - vec2(4.0, 5.0) * membraneScale,
    radius
  );

  // The reference keeps a calm rectangular content plateau and lets the
  // side/lower membrane carry the deformation. Low harmonics create broad
  // lobes; no pixel-scale noise is used, so the shell stays sculptural.
  float sideWeight = smoothstep(0.40, 0.94, abs(normalized.x));
  float lowerWeight = smoothstep(-0.20, 0.96, normalized.y);
  float topWeight = smoothstep(0.18, 0.96, -normalized.y);
  float contourWeight = mix(0.40, 1.0, max(sideWeight * 0.84, lowerWeight));
  float phase = time * (0.08 + causticSpeed * 0.035);
  float lobes =
    sin(angle * 2.0 + seed * 0.31 + phase) * 0.48 +
    sin(angle * 3.0 - seed * 0.17 - phase * 0.72) * 0.34 +
    sin(angle * 5.0 + seed * 0.09 + phase * 0.38) * 0.18;
  float lowerUndulation =
    (
      sin(normalized.x * 5.2 + seed * 0.23 - phase * 0.65) * 0.48 +
      sin(normalized.x * 2.7 - seed * 0.11 + phase * 0.42) * 0.20
    ) * lowerWeight;
  float topUndulation =
    (
      sin(normalized.x * 4.1 - seed * 0.19 + phase * 0.36) * 0.30 +
      sin(normalized.x * 2.2 + seed * 0.13 - phase * 0.24) * 0.14
    ) * topWeight;
  float viewportAspect = u_resolution.x / max(u_resolution.y, 1.0);
  float mobileAttenuation = mix(0.72, 1.0, smoothstep(0.72, 1.16, viewportAspect));
  float amplitude = mix(9.0, 20.0, organicAmount) *
    membraneScale * mobileAttenuation * (1.0 - hover * 0.28);
  return base - (lobes + lowerUndulation + topUndulation) * amplitude * contourWeight;
}

vec2 membraneNormal(vec2 local, vec2 halfSize, float radius) {
  vec2 corner = abs(local) - (halfSize - radius);
  vec2 rounded = max(corner, vec2(0.0));
  if (length(rounded) > 0.001) return normalize(sign(local) * rounded);
  if (corner.x > corner.y) return vec2(sign(local.x), 0.0);
  if (corner.y > corner.x) return vec2(0.0, sign(local.y));
  return vec2(0.0);
}

vec4 targetField(
  vec2 uv,
  float time,
  out float bodyMask,
  out float edgeGlow,
  out float contactShadow,
  out float innerCavity,
  out vec2 surfaceNormal,
  out float surfaceScale
) {
  bodyMask = 0.0;
  edgeGlow = 0.0;
  contactShadow = 0.0;
  innerCavity = 0.0;
  surfaceNormal = vec2(0.0);
  surfaceScale = 1.0;
  return vec4(0.0);
}

float textCov(vec2 uv) {
  return texture(u_text, uv).a * u_nameOpacity;
}

float titleBasin(vec2 uv, float time) {
  vec2 px = 22.0 / max(u_resolution, vec2(1.0));
  float field = texture(u_text, uv).r;
  field = max(field, texture(u_text, uv + vec2(px.x, 0.0)).r);
  field = max(field, texture(u_text, uv - vec2(px.x, 0.0)).r);
  field = max(field, texture(u_text, uv + vec2(0.0, px.y)).r);
  field = max(field, texture(u_text, uv - vec2(0.0, px.y)).r);
  field = max(field, texture(u_text, uv + px).r);
  field = max(field, texture(u_text, uv - px).r);
  float breathing = sin(uv.x * 17.0 + uv.y * 11.0 + time * 0.16) * 0.018;
  return smoothstep(0.025 + breathing, 0.38, field) * u_nameOpacity;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float time = u_time * mix(0.28, 1.0, u_sceneIntensity);
  vec2 pointer = vec2(u_pointer.x / u_resolution.x, 1.0 - u_pointer.y / u_resolution.y);
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 plane = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  float mobilePoster = smoothstep(0.82, 0.56, aspect);

  float lensStrength;
  vec2 lensOffset = cursorLens(uv, pointer, lensStrength);
  vec3 simulationNormal = vec3(texture(u_normalField, uv).xy * 2.0 - 1.0, 1.0);
  float simulationHeight = texture(u_heightField, uv).r;
  vec4 simulationObstacle = texture(u_obstacleField, uv);
  float targetEdge = 0.0;
  float targetBody = 0.0;
  float targetContact = 0.0;
  float targetCavity = 0.0;
  vec2 targetNormal = vec2(0.0);
  float targetScale = 1.0;
  vec4 targetLayer = targetField(
    uv,
    time,
    targetBody,
    targetEdge,
    targetContact,
    targetCavity,
    targetNormal,
    targetScale
  );
  vec3 ripple = rippleField(uv, pointer, time);
  float basin = titleBasin(uv, time);
  float basinRim = ridge(basin - 0.5, 0.32);
  float scrollImpulse = clamp(u_scroll.y, -0.22, 0.22);

  float flowA = 0.5 + 0.25 * (
    sin(dot(plane, vec2(3.8, 2.4)) + time * 0.42) +
    sin(dot(plane, vec2(-2.1, 5.2)) - time * 0.31)
  );
  float flowB = 0.5 + 0.25 * (
    sin(dot(plane, vec2(7.2, -3.1)) - time * 0.54) +
    cos(dot(plane, vec2(4.1, 6.6)) + time * 0.37)
  );
  float flowC = 0.5 + 0.5 * sin(dot(plane, vec2(6.2, -4.7)) + time * 0.72);

  float basinCalm = 1.0 - basin * 0.54;
  plane.x += ((flowA - 0.5) * 0.034 + ripple.z + simulationNormal.x * 0.042) * basinCalm + scrollImpulse * 0.004;
  plane.y += ((flowB - 0.5) * 0.026 + ripple.z * 0.42 + simulationNormal.y * 0.036) * basinCalm - scrollImpulse * 0.006;

  vec2 baseUv = uv + lensOffset + simulationNormal.xy * 0.036 + vec2(0.0, -scrollImpulse * 0.003);
  vec2 flowUv = clamp(
    baseUv + vec2((flowA - 0.5) * 0.018, (flowB - 0.5) * 0.014),
    vec2(0.0),
    vec2(1.0)
  );

  vec3 blue = vec3(0.14, 0.40, 0.78);
  vec3 white = vec3(0.969, 0.976, 0.988);
  vec3 silver = vec3(0.867, 0.890, 0.925);
  vec3 base = texture(u_texture, flowUv).rgb;
  base = mix(base, white, 0.08);
  base += vec3(0.004, 0.006, 0.012);

  float caustic = caustics(plane * 3.1 + vec2(time * 0.035, -time * 0.026), time * 0.42);
  float causticMask = smoothstep(0.3, 0.9, flowC) * 0.35;
  float liquidRidge = ridge(flowA - 0.52, 0.20) * 0.34 + ridge(flowB - 0.48, 0.18) * 0.22;
  base += vec3(0.90, 0.96, 1.0) * caustic * 0.11 * (0.65 + causticMask) * (1.0 - basin * 0.34);
  base += vec3(0.92, 0.97, 1.0) * pow(caustic, 2.15) * (0.52 + liquidRidge) * 0.032;
  base += silver * liquidRidge * 0.05;
  base *= 1.0 - basin * 0.078;
  base -= vec3(0.035, 0.065, 0.13) * basin * 0.34;
  base -= vec3(0.055, 0.085, 0.16) * basinRim * 0.48;
  base += white * basinRim * 0.29 + blue * basinRim * 0.10;
  vec2 membraneWarp = targetNormal * targetScale *
    (4.0 + targetLayer.a * 4.5) / max(u_resolution, vec2(1.0));
  vec3 membraneRefraction = texture(
    u_texture,
    clamp(flowUv + membraneWarp + simulationNormal.xy * 0.004 * targetBody, vec2(0.0), vec2(1.0))
  ).rgb;
  base = mix(base, membraneRefraction, targetBody * (0.58 + targetLayer.a * 0.12));
  base = mix(base, vec3(0.94, 0.97, 1.0), targetBody * 0.045);
  base += targetLayer.rgb;
  base += white * targetEdge * 0.035;
  base -= vec3(0.075, 0.070, 0.055) * targetCavity * 1.05;
  base -= vec3(0.055, 0.085, 0.15) * targetContact * 0.82;
  base -= vec3(0.025, 0.045, 0.09) * targetBody * 0.018;

  // One title material: a low-depth refraction, a soft body, one directional
  // bevel, and a few broad air pockets. This keeps the name watery without
  // stacking unrelated outline, ice, and color-treatment passes.
  vec4 titleField = texture(u_text, uv);
  float coverage = titleField.a * u_nameOpacity;
  float signedDistance = (titleField.r * 2.0 - 1.0) * u_nameOpacity;
  float thickness = titleField.g * u_nameOpacity;
  float bevel = titleField.b * u_nameOpacity;
  float letterMask = smoothstep(-0.025, 0.035, signedDistance) * u_nameOpacity;
  float interior = smoothstep(0.08, 0.68, thickness);
  vec2 textPixel = 1.6 / max(u_resolution, vec2(1.0));
  float sdRight = texture(u_text, uv + vec2(textPixel.x, 0.0)).r;
  float sdLeft = texture(u_text, uv - vec2(textPixel.x, 0.0)).r;
  float sdUp = texture(u_text, uv + vec2(0.0, textPixel.y)).r;
  float sdDown = texture(u_text, uv - vec2(0.0, textPixel.y)).r;
  vec2 coverageGradient = vec2(sdRight - sdLeft, sdUp - sdDown);
  float edge = smoothstep(0.015, 0.10, length(coverageGradient)) + bevel * 0.34;
  float outerRim = ridge(signedDistance + 0.02, 0.065) * (1.0 - letterMask * 0.42);
  float innerRim = bevel * letterMask;
  float dome = pow(max(thickness, 0.0), 0.62);
  vec3 normal = normalize(vec3(-coverageGradient * (3.4 + dome * 2.1) + simulationNormal.xy * 0.11, 1.0));

  vec2 sampleWarp = ripple.z * vec2(0.55, 0.24) + simulationNormal.xy * 0.012 + lensOffset * 0.38;
  vec2 refraction = uv + sampleWarp + normal.xy * 0.016 * letterMask;
  vec2 chroma = normal.xy * 0.0015;
  vec3 refracted = vec3(
    texture(u_texture, clamp(refraction + chroma, vec2(0.0), vec2(1.0))).r * 0.97,
    texture(u_texture, clamp(refraction, vec2(0.0), vec2(1.0))).g * 0.99,
    texture(u_texture, clamp(refraction - chroma, vec2(0.0), vec2(1.0))).b * 1.02
  );
  refracted += vec3(0.010, 0.014, 0.026);

  vec3 letterBody = mix(refracted, vec3(0.50, 0.68, 0.91), 0.28);
  letterBody += vec3(0.016, 0.038, 0.10) * dome;
  letterBody -= vec3(0.075, 0.105, 0.19) * interior * smoothstep(0.30, 1.0, uv.y);
  letterBody -= vec3(0.085, 0.105, 0.145) * mobilePoster * 0.42;

  vec3 topLeftLight = normalize(vec3(-0.48, -0.66, 0.58));
  vec3 lowerRightLight = normalize(vec3(0.56, 0.50, 0.62));
  float topLeftHighlight = pow(max(dot(normal, topLeftLight), 0.0), 9.0);
  float lowerRightBlue = pow(max(dot(normal, lowerRightLight), 0.0), 2.5);
  vec2 edgeDirection = normalize(coverageGradient + vec2(0.0001));
  float edgeLight = clamp(
    0.5 + dot(edgeDirection, normalize(vec2(-0.62, -0.78))) * 0.5,
    0.0,
    1.0
  );
  vec3 bevelColor = mix(vec3(0.24, 0.40, 0.70), vec3(0.98, 0.995, 1.0), edgeLight);
  letterBody += vec3(1.0, 0.995, 0.99) * topLeftHighlight * 0.72;
  letterBody += blue * lowerRightBlue * 0.32;
  letterBody -= vec3(0.075, 0.115, 0.22) * innerRim * (1.0 - edgeLight) * 0.92;

  float cavity = dome * (0.25 + innerRim * 0.75);
  letterBody -= vec3(0.085, 0.125, 0.23) * cavity;

  vec2 bubbleWarp = simulationNormal.xy * 0.009 + vec2(
    sin(time * 0.32 + uv.y * 9.0),
    cos(time * 0.27 + uv.x * 8.0)
  ) * 0.0025 + lensOffset * 0.45;
  vec2 bubbleUv = uv + bubbleWarp;
  vec2 pocketScale = vec2(18.0, 8.0);
  vec2 pocketCell = floor(bubbleUv * pocketScale);
  float pocketSeed = hash21(pocketCell);
  vec2 pocketCenter = (pocketCell + vec2(0.34 + pocketSeed * 0.34, 0.38 + hash21(pocketCell + 4.2) * 0.28)) / pocketScale;
  float pocketRadius = mix(0.012, 0.027, pocketSeed);
  float pocketDistance = distance((bubbleUv - pocketCenter) * vec2(aspect, 1.0), vec2(0.0));
  float pocketEnabled = smoothstep(0.72, 0.92, pocketSeed) * interior;
  float bubbleBody = (1.0 - smoothstep(pocketRadius * 0.42, pocketRadius, pocketDistance)) * pocketEnabled * 0.34;
  float bubbleRim = ridge(pocketDistance - pocketRadius, 0.0035) * pocketEnabled *
    smoothstep(0.0, 0.85, 0.5 + 0.5 * dot(normalize(bubbleUv - pocketCenter + vec2(0.0001)), normalize(vec2(-0.7, -0.7))));
  letterBody -= vec3(0.050, 0.075, 0.15) * bubbleBody;
  letterBody += vec3(1.0, 0.995, 0.98) * bubbleRim * 0.74;

  float fresnel = pow(1.0 - max(normal.z, 0.0), 3.0);
  letterBody += vec3(0.86, 0.94, 1.0) * fresnel * 0.10;
  letterBody += blue * simulationObstacle.g * 0.06 * interior;

  vec3 color = base;
  color = mix(color, letterBody, letterMask * 0.94);
  color -= vec3(0.10, 0.12, 0.16) * letterMask * mobilePoster * 0.35;
  color = mix(color, bevelColor, clamp(outerRim * 0.92 + innerRim * 0.72, 0.0, 0.96));
  color += vec3(1.0, 0.995, 0.99) * outerRim * (0.36 + mobilePoster * 0.05);
  color += vec3(0.88, 0.95, 1.0) * innerRim * 0.40;
  color -= vec3(0.06, 0.09, 0.17) * innerRim * (1.0 - edgeLight) * 0.55;
  color += blue * innerRim * lowerRightBlue * 0.14;
  float titleCaustic = pow(caustic, 2.35) * (innerRim * 0.9 + outerRim * 0.65);
  color += white * titleCaustic * 0.14 + blue * titleCaustic * 0.08;
  color += white * ripple.y * 0.24 + blue * ripple.x * 0.18;
  color += white * simulationHeight * 0.08;
  color += white * lensStrength * 0.025 + blue * lensStrength * 0.008;
  color += blue * targetBody * 0.04;

  float vignette = smoothstep(1.25, 0.12, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
  color = mix(color * white, color, vignette);
  float peak = max(max(color.r, color.g), color.b);
  if (peak > 1.0) color /= peak;
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.97)), 1.0);
}
`;
