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
uniform sampler2D u_texture;
uniform sampler2D u_normalField;
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

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  float time = u_time * mix(0.28, 1.0, u_sceneIntensity);
  vec2 pointer = vec2(u_pointer.x / u_resolution.x, 1.0 - u_pointer.y / u_resolution.y);
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 plane = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  float lensStrength;
  vec2 lensOffset = cursorLens(uv, pointer, lensStrength);
  vec3 surfaceSample = texture(u_normalField, uv).rgb;
  vec3 simulationNormal = normalize(vec3(surfaceSample.xy * 2.0 - 1.0, 1.0));
  float simulationHeight = (surfaceSample.z - 0.5) * 0.25;
  // The height field is the single source of truth for ripples. This removes
  // the second full-resolution eight-ripple loop and keeps refraction, light,
  // and wave propagation on the same physical surface.
  vec3 ripple = vec3(
    max(-simulationHeight, 0.0) * 0.70,
    max(simulationHeight, 0.0) * 0.85,
    simulationHeight * 0.55
  );
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
  vec2 surfaceChroma = simulationNormal.xy * 0.0011;
  vec3 base = vec3(
    texture(u_texture, clamp(flowUv + surfaceChroma, vec2(0.0), vec2(1.0))).r,
    texture(u_texture, flowUv).g,
    texture(u_texture, clamp(flowUv - surfaceChroma, vec2(0.0), vec2(1.0))).b
  );
  base = mix(base, white, 0.04);
  base += vec3(0.002, 0.003, 0.006);

  float caustic = caustics(plane * 3.1 + vec2(time * 0.035, -time * 0.026), time * 0.42);
  float causticMask = smoothstep(0.3, 0.9, flowC) * 0.35;
  float liquidRidge = ridge(flowA - 0.52, 0.20) * 0.34 + ridge(flowB - 0.48, 0.18) * 0.22;
  base += vec3(0.90, 0.96, 1.0) * caustic * 0.028 * (0.65 + causticMask);
  base += vec3(0.92, 0.97, 1.0) * pow(caustic, 2.15) * (0.52 + liquidRidge) * 0.012;
  base += silver * liquidRidge * 0.02;

  // Studio-lit water: the simulated height field controls the optical response
  // instead of acting as a decorative warp layered over unrelated highlights.
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  vec3 surfaceLight = normalize(vec3(-0.42, -0.58, 0.70));
  vec3 halfVector = normalize(surfaceLight + viewDirection);
  float surfaceFresnel = 0.02 + 0.98 * pow(1.0 - max(dot(simulationNormal, viewDirection), 0.0), 5.0);
  float surfaceSpecular = pow(max(dot(simulationNormal, halfVector), 0.0), 72.0);
  float focusedCaustic = pow(clamp(1.0 - length(simulationNormal.xy) * 1.7, 0.0, 1.0), 9.0);
  base = mix(base, white, surfaceFresnel * 0.12);
  base += white * surfaceSpecular * (0.045 + u_energy * 0.035);
  base += vec3(0.70, 0.87, 1.0) * focusedCaustic * abs(simulationHeight) * 0.16;
  base += white * ripple.y * 0.10 + blue * ripple.x * 0.075;
  base += white * lensStrength * 0.012 + blue * lensStrength * 0.004;

  // The hero type is intentionally CSS-only. It stays crisp and accessible;
  // this shader owns the continuous ambient water surface beneath it.
  outColor = vec4(pow(clamp(base, 0.0, 1.0), vec3(1.02)), 1.0);
}
`;
