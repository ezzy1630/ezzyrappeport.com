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
  lens = exp(-distanceToPointer * 4.6) * (0.42 + u_energy * 0.72);
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
  float pulse = sin(distanceToPointer * 28.0 - time * 5.5);
  float envelope = exp(-distanceToPointer * 3.6) * u_energy;
  blue += max(pulse, 0.0) * envelope * 0.20;
  white += ridge(distanceToPointer - 0.078 - sin(time * 1.2) * 0.009, 0.026) * envelope * 0.20;
  warp += pulse * envelope * 0.030;

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
  vec3 ripple = rippleField(uv, pointer, time);
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

  plane.x += (flowA - 0.5) * 0.034 + ripple.z + simulationNormal.x * 0.042 + scrollImpulse * 0.004;
  plane.y += (flowB - 0.5) * 0.026 + ripple.z * 0.42 + simulationNormal.y * 0.036 - scrollImpulse * 0.006;

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
  base += vec3(0.90, 0.96, 1.0) * caustic * 0.09 * (0.65 + causticMask);
  base += vec3(0.92, 0.97, 1.0) * pow(caustic, 2.15) * (0.52 + liquidRidge) * 0.032;
  base += silver * liquidRidge * 0.05;

  // Each glyph is a clear, water-filled volume: a thick optical wall around a
  // transparent refractive core, with light and shadow derived from its SDF.
  vec2 titleUv = uv
    + simulationNormal.xy * (0.006 + abs(simulationHeight) * 0.018)
    + ripple.z * vec2(0.16, 0.07)
    + lensOffset * 0.18;
  vec4 titleField = texture(u_text, clamp(titleUv, vec2(0.0), vec2(1.0)));
  float signedDistance = (titleField.r * 2.0 - 1.0) * u_nameOpacity;
  float thickness = titleField.g * u_nameOpacity;
  float bevel = titleField.b * u_nameOpacity;
  float titleAA = max(fwidth(signedDistance) * 1.35, mix(0.016, 0.024, mobilePoster));
  float letterMask = smoothstep(-titleAA, titleAA, signedDistance) * u_nameOpacity;
  float interior = smoothstep(0.18, 0.72, thickness);
  float innerBevel = bevel * letterMask;
  float outerHalo = (smoothstep(-0.075, -0.012, signedDistance) - letterMask) * u_nameOpacity;
  float glassWall = (1.0 - smoothstep(0.015, 0.24, signedDistance)) * letterMask;
  float edgeRim = smoothstep(0.015, 0.14, thickness) * (1.0 - smoothstep(0.20, 0.48, thickness)) * letterMask;
  float outerMeniscus = exp(-abs(signedDistance) * 11.0) * u_nameOpacity;
  float innerMeniscus = exp(-abs(signedDistance - 0.18) * 14.0) * letterMask;
  vec2 textPixel = 1.6 / max(u_resolution, vec2(1.0));
  float sdRight = texture(u_text, titleUv + vec2(textPixel.x, 0.0)).r;
  float sdLeft = texture(u_text, titleUv - vec2(textPixel.x, 0.0)).r;
  float sdUp = texture(u_text, titleUv + vec2(0.0, textPixel.y)).r;
  float sdDown = texture(u_text, titleUv - vec2(0.0, textPixel.y)).r;
  vec2 coverageGradient = vec2(sdRight - sdLeft, sdUp - sdDown);
  float dome = pow(max(thickness, 0.0), 0.48);
  vec3 normal = normalize(vec3(-coverageGradient * (5.8 + dome * 2.8) + simulationNormal.xy * 0.14, 0.82));

  vec2 sampleWarp = ripple.z * vec2(0.72, 0.34) + simulationNormal.xy * 0.026 + lensOffset * 0.62;
  vec2 refraction = uv + sampleWarp + normal.xy * (0.017 + glassWall * 0.026) * letterMask;
  vec2 chroma = normal.xy * (0.0014 + glassWall * 0.0018);
  vec3 refracted = vec3(
    texture(u_texture, clamp(refraction + chroma, vec2(0.0), vec2(1.0))).r * 0.97,
    texture(u_texture, clamp(refraction, vec2(0.0), vec2(1.0))).g * 0.99,
    texture(u_texture, clamp(refraction - chroma, vec2(0.0), vec2(1.0))).b * 1.02
  );
  refracted += vec3(0.010, 0.014, 0.026);

  vec3 titleTint = mix(vec3(0.31, 0.55, 0.88), vec3(0.20, 0.40, 0.75), mobilePoster);
  vec3 letterBody = mix(refracted, titleTint, 0.025 + glassWall * 0.19 + mobilePoster * 0.055);
  letterBody += white * interior * 0.025;

  vec3 topLeftLight = normalize(vec3(-0.48, -0.66, 0.58));
  float lightFacing = max(dot(normal, topLeftLight), 0.0);
  float directionalHighlight = pow(lightFacing, 8.0);
  float oppositeShade = pow(max(dot(normal, -topLeftLight), 0.0), 3.0);
  float fresnel = pow(1.0 - clamp(normal.z, 0.0, 1.0), 2.1);
  letterBody += white * directionalHighlight * (0.26 + glassWall * 0.64);
  letterBody += white * fresnel * glassWall * 0.32;
  letterBody -= vec3(0.055, 0.095, 0.17) * oppositeShade * (0.22 + glassWall * 0.72);
  letterBody += blue * (simulationObstacle.g * 0.055 + caustic * 0.028) * interior;

  vec3 color = base;
  color -= vec3(0.028, 0.055, 0.105) * outerHalo * 0.42;
  color = mix(color, letterBody, letterMask * mix(0.92, 0.96, mobilePoster));
  color -= vec3(0.10, 0.12, 0.16) * letterMask * mobilePoster * 0.35;
  color += white * innerBevel * 0.25;
  color += white * edgeRim * 0.29;
  color += white * outerMeniscus * 0.38;
  color -= vec3(0.035, 0.075, 0.15) * innerMeniscus * 0.22;
  color += blue * outerMeniscus * max(coverageGradient.x - coverageGradient.y, 0.0) * 0.16;
  color += blue * glassWall * 0.032;
  float titleCaustic = pow(caustic, 2.0) * innerBevel * 0.52;
  color += white * titleCaustic * 0.18 + blue * titleCaustic * 0.075;
  color += white * ripple.y * 0.24 + blue * ripple.x * 0.18;
  color += white * simulationHeight * 0.08;
  color += white * lensStrength * 0.025 + blue * lensStrength * 0.008;

  float vignette = smoothstep(1.25, 0.12, distance((uv - 0.5) * vec2(aspect, 1.0), vec2(0.0)));
  color = mix(color * white, color, vignette);
  float peak = max(max(color.r, color.g), color.b);
  if (peak > 1.0) color /= peak;
  outColor = vec4(pow(max(color, vec3(0.0)), vec3(0.97)), 1.0);
}
`;
