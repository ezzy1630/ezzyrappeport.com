import { HERO_GLYPH_COUNT } from "../materials/heroTextMask";

/**
 * A 13x2 GPU state texture stores transform/depth (row 0) and velocity (row 1).
 * The pass samples the live solver at five points around each glyph, so the
 * title never needs a synchronous readback or a React update in the frame loop.
 */
export const GLYPH_PHYSICS_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

const int GLYPH_COUNT = ${HERO_GLYPH_COUNT};
uniform float u_delta;
uniform float u_time;
uniform vec4 u_glyphRest[GLYPH_COUNT];
uniform vec4 u_glyphPhysics[GLYPH_COUNT];
uniform vec4 u_glyphMaterial[GLYPH_COUNT];
uniform sampler2D u_state;
uniform sampler2D u_velocity;
uniform sampler2D u_normal;
uniform sampler2D u_pressure;

out vec4 outColor;

vec2 decodeVelocity(vec4 value) { return (value.xy - 0.5) * 2.0; }

void main() {
  int index = int(floor(gl_FragCoord.x));
  int row = int(floor(gl_FragCoord.y));
  if (index < 0 || index >= GLYPH_COUNT) {
    outColor = vec4(0.0);
    return;
  }

  vec4 transform = texelFetch(u_state, ivec2(index, 0), 0);
  vec4 velocity = texelFetch(u_state, ivec2(index, 1), 0);
  vec4 rest = u_glyphRest[index];
  vec4 physical = u_glyphPhysics[index];
  vec4 material = u_glyphMaterial[index];
  vec2 centerTop = rest.xy + transform.xy;
  vec2 center = vec2(centerTop.x, 1.0 - centerTop.y);
  vec2 halfExtent = max(rest.zw * 1.04, vec2(0.004));
  vec2 left = center - vec2(halfExtent.x, 0.0);
  vec2 right = center + vec2(halfExtent.x, 0.0);
  vec2 upper = center + vec2(0.0, halfExtent.y);
  vec2 lower = center - vec2(0.0, halfExtent.y);

  vec2 flowCenter = decodeVelocity(texture(u_velocity, center));
  vec2 flowLeft = decodeVelocity(texture(u_velocity, left));
  vec2 flowRight = decodeVelocity(texture(u_velocity, right));
  vec2 flowUpper = decodeVelocity(texture(u_velocity, upper));
  vec2 flowLower = decodeVelocity(texture(u_velocity, lower));
  vec3 normalCenter = texture(u_normal, center).rgb;
  float heightCenterRaw = (normalCenter.z - 0.5) * 0.25;
  float heightLeft = (texture(u_normal, left).z - 0.5) * 0.25;
  float heightRight = (texture(u_normal, right).z - 0.5) * 0.25;
  float heightUpper = (texture(u_normal, upper).z - 0.5) * 0.25;
  float heightLower = (texture(u_normal, lower).z - 0.5) * 0.25;
  float heightCenter = heightCenterRaw * 0.18
    + (heightLeft + heightRight + heightUpper + heightLower) * 0.205;
  vec2 flowCenterSample = flowCenter * 0.16
    + (flowLeft + flowRight + flowUpper + flowLower) * 0.21;
  float pressureLeft = texture(u_pressure, left).r - 0.5;
  float pressureRight = texture(u_pressure, right).r - 0.5;

  float dt = clamp(u_delta, 1.0 / 120.0, 1.0 / 30.0);
  float mass = max(physical.x, 0.45);
  vec2 flowTop = vec2(flowCenterSample.x, -flowCenterSample.y);
  vec2 displacementForce = -transform.xy * physical.y;
  vec2 dragForce = (flowTop * 0.10 - velocity.xy) * physical.z;
  float quietLift = (sin(u_time * 0.37 + float(index) * 2.31)
    + sin(u_time * 0.19 + float(index) * 0.83) * 0.55) * 0.00011;
  float buoyantForce = (-heightCenter * material.x * 0.82)
    + (heightLower - heightUpper) * 0.28 + quietLift;
  vec2 acceleration = (displacementForce + dragForce + vec2(flowTop.x * 0.34, buoyantForce)) / mass;
  velocity.xy += acceleration * dt;
  velocity.xy *= exp(-physical.z * 0.12 * dt);
  transform.xy += velocity.xy * dt;
  float maxTranslation = physical.w;
  float travel = length(transform.xy);
  if (travel > maxTranslation) {
    transform.xy *= maxTranslation / travel;
    velocity.xy *= 0.48;
  }

  float flowTorque = (flowRight.y - flowLeft.y) * 0.38;
  float pressureTorque = (pressureRight - pressureLeft) * 0.46;
  float normalTorque = (normalCenter.r - 0.5) * 0.16;
  float angularAcceleration = (
    flowTorque + pressureTorque + normalTorque - transform.z * material.y - velocity.z * 5.8
  ) / (mass * (0.72 + rest.z * 4.0));
  velocity.z += angularAcceleration * dt;
  transform.z += velocity.z * dt;
  transform.z = clamp(transform.z, -material.z, material.z);
  if (abs(transform.z) >= material.z * 0.999) velocity.z *= 0.42;

  float depthTarget = clamp(
    heightCenter * material.w * 1.8 + length(flowCenterSample) * 0.018,
    -0.018,
    0.026
  );
  float depthAcceleration = (depthTarget - transform.w) * 11.5 - velocity.w * 5.9;
  velocity.w += depthAcceleration * dt;
  transform.w += velocity.w * dt;

  outColor = row == 0 ? transform : velocity;
}
`;
