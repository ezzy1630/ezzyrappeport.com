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
uniform vec4 u_scroll;
uniform vec4 u_targets[8];

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

float targetField(vec2 uv, out float edgeGlow) {
  float field = 0.0;
  edgeGlow = 0.0;
  vec2 pixel = vec2(uv.x * u_resolution.x, (1.0 - uv.y) * u_resolution.y);
  for (int i = 0; i < 8; i++) {
    vec4 target = u_targets[i];
    if (target.z <= 1.0 || target.w <= 1.0) continue;
    vec2 halfSize = target.zw * 0.5;
    float distanceToTarget = roundedBox(
      pixel - target.xy,
      halfSize,
      min(54.0, min(halfSize.x, halfSize.y) * 0.45)
    );
    field = max(field, 1.0 - smoothstep(-10.0, 22.0, distanceToTarget));
    edgeGlow = max(edgeGlow, 1.0 - smoothstep(0.0, 44.0, abs(distanceToTarget)));
  }
  return field;
}

float textCov(vec2 uv) {
  return texture(u_text, uv).a * u_nameOpacity;
}

float textSurface(vec2 uv, float time) {
  float coverage = textCov(uv);
  float edge = 4.0 * coverage * (1.0 - coverage);
  float dome = smoothstep(0.14, 0.88, coverage);
  float meniscus = pow(max(edge, 0.0), 0.82) * 0.32;
  float cap = pow(max(coverage, 0.0), 0.48) * dome * 0.12;
  float motion = sin(uv.x * 17.0 + uv.y * 13.0 + time * 0.55) * dome;
  return meniscus + cap + motion * 0.004;
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float time = u_time;
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
  float targetBody = targetField(uv, targetEdge);
  vec3 ripple = rippleField(uv, pointer, time);

  float flowA = 0.5 + 0.25 * (
    sin(dot(plane, vec2(3.8, 2.4)) + time * 0.42) +
    sin(dot(plane, vec2(-2.1, 5.2)) - time * 0.31)
  );
  float flowB = 0.5 + 0.25 * (
    sin(dot(plane, vec2(7.2, -3.1)) - time * 0.54) +
    cos(dot(plane, vec2(4.1, 6.6)) + time * 0.37)
  );
  float flowC = 0.5 + 0.5 * sin(dot(plane, vec2(6.2, -4.7)) + time * 0.72);

  plane.x += (flowA - 0.5) * 0.034 + ripple.z + simulationNormal.x * 0.042 + u_scroll.y * 0.035;
  plane.y += (flowB - 0.5) * 0.026 + ripple.z * 0.42 + simulationNormal.y * 0.036 - u_scroll.y * 0.055;

  vec2 baseUv = uv + lensOffset + simulationNormal.xy * 0.036 + vec2(0.0, -u_scroll.y * 0.018);
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
  base += vec3(0.90, 0.96, 1.0) * caustic * 0.11 * (0.65 + causticMask);
  base += vec3(0.92, 0.97, 1.0) * pow(caustic, 2.15) * (0.52 + liquidRidge) * 0.032;
  base += silver * liquidRidge * 0.05;
  base += blue * targetEdge * 0.08 + white * targetEdge * 0.04;
  base += blue * abs(u_scroll.y) * smoothstep(0.18, 0.92, uv.y) * 0.016;

  // One title material: a low-depth refraction, a soft body, one directional
  // bevel, and a few broad air pockets. This keeps the name watery without
  // stacking unrelated outline, ice, and color-treatment passes.
  float coverage = textCov(uv);
  float letterMask = smoothstep(0.035, 0.24, coverage);
  float interior = smoothstep(0.18, 0.86, coverage);
  vec2 textPixel = 4.8 / max(u_resolution, vec2(1.0));
  float covRight = textCov(uv + vec2(textPixel.x, 0.0));
  float covLeft = textCov(uv - vec2(textPixel.x, 0.0));
  float covUp = textCov(uv + vec2(0.0, textPixel.y));
  float covDown = textCov(uv - vec2(0.0, textPixel.y));
  vec2 coverageGradient = vec2(covRight - covLeft, covUp - covDown);
  float edge = smoothstep(0.08, 0.48, length(coverageGradient));
  float outerRim = edge * (1.0 - letterMask);
  float innerRim = edge * letterMask;

  float surfaceRight = textSurface(uv + vec2(textPixel.x, 0.0), time);
  float surfaceLeft = textSurface(uv - vec2(textPixel.x, 0.0), time);
  float surfaceUp = textSurface(uv + vec2(0.0, textPixel.y), time);
  float surfaceDown = textSurface(uv - vec2(0.0, textPixel.y), time);
  vec2 surfaceGradient = vec2(surfaceRight - surfaceLeft, surfaceUp - surfaceDown);
  vec3 normal = normalize(vec3(-surfaceGradient * 0.24 + simulationNormal.xy * 0.16, 1.0));

  vec2 sampleWarp = ripple.z * vec2(0.55, 0.24) + simulationNormal.xy * 0.012 + lensOffset * 0.38;
  vec2 refraction = uv + sampleWarp + normal.xy * 0.016 * letterMask;
  vec2 chroma = normal.xy * 0.0015;
  vec3 refracted = vec3(
    texture(u_texture, clamp(refraction + chroma, vec2(0.0), vec2(1.0))).r * 0.97,
    texture(u_texture, clamp(refraction, vec2(0.0), vec2(1.0))).g * 0.99,
    texture(u_texture, clamp(refraction - chroma, vec2(0.0), vec2(1.0))).b * 1.02
  );
  refracted += vec3(0.010, 0.014, 0.026);

  vec3 letterBody = mix(refracted, vec3(0.75, 0.81, 0.92), 0.50);
  letterBody += vec3(0.038, 0.058, 0.112) * interior;
  letterBody -= vec3(0.055, 0.075, 0.135) * smoothstep(0.42, 0.96, coverage);
  float bodyLight = smoothstep(0.08, 0.52, uv.y);
  letterBody += vec3(0.036, 0.044, 0.070) * (1.0 - bodyLight) * interior;
  letterBody -= vec3(0.032, 0.048, 0.090) * bodyLight * interior;

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
  letterBody += vec3(1.0, 0.995, 0.99) * topLeftHighlight * 0.52;
  letterBody += blue * lowerRightBlue * 0.20;
  letterBody -= vec3(0.060, 0.090, 0.16) * innerRim * (1.0 - edgeLight) * 0.70;

  float cavity = smoothstep(0.24, 0.90, coverage) * (0.42 + edge * 0.58);
  letterBody -= vec3(0.035, 0.055, 0.11) * cavity;

  vec2 bubbleWarp = simulationNormal.xy * 0.009 + vec2(
    sin(time * 0.32 + uv.y * 9.0),
    cos(time * 0.27 + uv.x * 8.0)
  ) * 0.0025 + lensOffset * 0.45;
  vec2 bubbleUv = uv + bubbleWarp;
  float bubbleOne = bubbleDisc(bubbleUv, vec2(0.31, 0.24), 0.094, vec2(1.0, 1.15));
  float bubbleTwo = bubbleDisc(bubbleUv, vec2(0.68, 0.34), 0.122, vec2(1.12, 0.86));
  float bubbleThree = bubbleDisc(bubbleUv, vec2(0.83, 0.48), 0.072, vec2(0.86, 1.2));
  float bubbleBody = (bubbleOne * 0.28 + bubbleTwo * 0.22 + bubbleThree * 0.24) * interior;
  float bubbleRim = (
    ellipseRing(bubbleUv, vec2(0.31, 0.24), 0.094, vec2(1.0, 1.15), 0.006) * 0.55 +
    ellipseRing(bubbleUv, vec2(0.68, 0.34), 0.122, vec2(1.12, 0.86), 0.007) * 0.45 +
    ellipseRing(bubbleUv, vec2(0.83, 0.48), 0.072, vec2(0.86, 1.2), 0.005) * 0.50
  ) * interior;
  letterBody -= vec3(0.050, 0.075, 0.15) * bubbleBody;
  letterBody += vec3(1.0, 0.995, 0.98) * bubbleRim * 0.74;

  float fresnel = pow(1.0 - max(normal.z, 0.0), 3.0);
  letterBody += vec3(0.86, 0.94, 1.0) * fresnel * 0.10;
  letterBody += blue * simulationObstacle.g * 0.06 * interior;

  vec3 color = base;
  color = mix(color, letterBody, letterMask * 0.94);
  color = mix(color, bevelColor, clamp(outerRim * 0.76 + innerRim * 0.58, 0.0, 0.92));
  color += vec3(1.0, 0.995, 0.99) * outerRim * (0.22 + mobilePoster * 0.05);
  color += vec3(0.88, 0.95, 1.0) * innerRim * 0.28;
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
