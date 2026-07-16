import { HERO_GLYPH_COUNT } from "../materials/heroTextMask";
import { GLYPH_STATE_CODEC_SOURCE } from "./glyphStateCodec";

/**
 * A 13x4 GPU state texture stores, per visible glyph:
 *   row 0: planar position, depth, buoyancy
 *   row 1: their linear velocities
 *   row 2: X tilt, Y tilt, screen rotation
 *   row 3: angular velocities
 *
 * The update samples the live solver around each glyph and also receives the
 * same pointer/ripple events as the water. No CPU readback or React work occurs
 * in the frame loop.
 */
export const GLYPH_PHYSICS_FRAGMENT_SOURCE = `#version 300 es
precision highp float;

const int GLYPH_COUNT = ${HERO_GLYPH_COUNT};
uniform float u_delta;
uniform float u_time;
uniform vec2 u_viewport;
uniform vec4 u_pointer;
uniform vec2 u_pointerVelocity;
uniform vec4 u_ripples[8];
uniform vec4 u_debugImpulse;
uniform vec4 u_debugImpulseMeta;
uniform vec4 u_glyphRest[GLYPH_COUNT];
uniform vec4 u_glyphPhysics[GLYPH_COUNT];
uniform vec4 u_glyphMaterial[GLYPH_COUNT];
uniform sampler2D u_state;
uniform sampler2D u_velocity;
uniform sampler2D u_normal;
uniform sampler2D u_pressure;

${GLYPH_STATE_CODEC_SOURCE}

out vec4 outColor;

vec2 decodeVelocity(vec4 value) { return (value.xy - 0.5) * 2.0; }
float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

void main() {
  int index = int(floor(gl_FragCoord.x));
  int physicalRow = int(floor(gl_FragCoord.y));
  int row = u_packedGlyphState ? physicalRow / 2 : physicalRow;
  if (index < 0 || index >= GLYPH_COUNT) {
    outColor = vec4(0.0);
    return;
  }

  vec4 transform = readGlyphState(u_state, index, 0);
  vec4 velocity = readGlyphState(u_state, index, 1);
  vec4 orientation = readGlyphState(u_state, index, 2);
  vec4 angularVelocity = readGlyphState(u_state, index, 3);
  vec4 rest = u_glyphRest[index];
  vec4 physical = u_glyphPhysics[index];
  vec4 material = u_glyphMaterial[index];
  vec2 centerTop = rest.xy + transform.xy + vec2(0.0, transform.w);
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
  vec2 surfaceNormal = normalCenter.xy * 2.0 - 1.0;
  float heightCenterRaw = (normalCenter.z - 0.5) * 0.25;
  float heightLeft = (texture(u_normal, left).z - 0.5) * 0.25;
  float heightRight = (texture(u_normal, right).z - 0.5) * 0.25;
  float heightUpper = (texture(u_normal, upper).z - 0.5) * 0.25;
  float heightLower = (texture(u_normal, lower).z - 0.5) * 0.25;
  float heightCenter = heightCenterRaw * 0.18
    + (heightLeft + heightRight + heightUpper + heightLower) * 0.205;
  vec2 flowAverage = flowCenter * 0.16
    + (flowLeft + flowRight + flowUpper + flowLower) * 0.21;
  float pressureLeft = texture(u_pressure, left).r - 0.5;
  float pressureRight = texture(u_pressure, right).r - 0.5;
  float pressureUpper = texture(u_pressure, upper).r - 0.5;
  float pressureLower = texture(u_pressure, lower).r - 0.5;

  // The pointer wake is continuous. Press ripples add an immediate local hit
  // followed by a ring that reaches neighboring letters later.
  float localRadius = max(rest.z, rest.w) * 2.2 + 0.035;
  vec2 fromPointer = centerTop - u_pointer.xy;
  float pointerDistance = length(fromPointer);
  float pointerWake = exp(-pointerDistance / localRadius) * u_pointer.z;
  vec2 directForce = u_pointerVelocity * pointerWake * 0.19;
  float depthImpulse = pointerWake * min(length(u_pointerVelocity) * 0.8, 0.012);
  vec3 directTorque = vec3(
    -fromPointer.y * directForce.x,
    fromPointer.x * directForce.y,
    cross2(fromPointer / max(rest.zw, vec2(0.001)), directForce)
  );

  // Development-only deterministic probe. Production uploads an expired
  // event, so this branch is inert and normal pointer coupling remains honest.
  float debugAge = u_debugImpulseMeta.x;
  if (debugAge >= 0.0 && debugAge < 0.24 && u_debugImpulseMeta.y > 0.001) {
    vec2 debugOffset = centerTop - u_debugImpulse.xy;
    float debugDistancePixels = length(debugOffset * u_viewport);
    float debugGlyphPixels = max(length(rest.zw * u_viewport), 24.0);
    float spatialWeight = exp(-pow(debugDistancePixels / (debugGlyphPixels * 0.72 + 18.0), 2.0));
    bool selectedMode = u_debugImpulseMeta.z > 0.5;
    bool selectedGlyph = index == int(floor(u_debugImpulseMeta.w + 0.5));
    float selectionWeight = selectedMode ? (selectedGlyph ? 1.0 : spatialWeight * 0.06) : spatialWeight;
    float debugAttack = exp(-debugAge * 13.5) * u_debugImpulseMeta.y * selectionWeight;
    vec2 debugDirection = normalize(u_debugImpulse.zw + vec2(0.000001));
    vec2 debugForce = debugDirection * debugAttack * 7.4;
    vec2 debugLocalHit = (u_debugImpulse.xy - centerTop) / max(rest.zw, vec2(0.001));
    directForce += debugForce;
    directTorque.x += -debugLocalHit.y * debugAttack * 3.4;
    directTorque.y += debugLocalHit.x * debugAttack * 3.4;
    directTorque.z += cross2(debugLocalHit, debugDirection) * debugAttack * 4.2;
    depthImpulse -= debugAttack * 0.055;
  }

  for (int rippleIndex = 0; rippleIndex < 8; rippleIndex++) {
    vec4 ripple = u_ripples[rippleIndex];
    float age = u_time - ripple.z;
    if (age < 0.0 || age > 3.2 || ripple.w <= 0.001) continue;
    vec2 hitOffset = centerTop - ripple.xy;
    float distancePixels = length(hitOffset * u_viewport);
    float glyphPixels = max(length(rest.zw * u_viewport), 28.0);
    float immediate = exp(-distancePixels / (glyphPixels * 0.48 + 18.0))
      * exp(-age * 11.0) * ripple.w;
    float ringRadius = 22.0 + age * 185.0;
    float ring = exp(-abs(distancePixels - ringRadius) / 54.0)
      * (1.0 - age / 3.2) * ripple.w;
    vec2 radial = length(hitOffset) > 0.0001 ? normalize(hitOffset) : vec2(0.0, -1.0);
    vec2 impulseDirection = normalize(radial + vec2(0.0, -0.34));
    vec2 impulse = impulseDirection * (immediate * 6.2 + ring * 0.52);
    directForce += impulse;
    vec2 localHit = (ripple.xy - centerTop) / max(rest.zw, vec2(0.001));
    directTorque.x += -localHit.y * (immediate * 3.0 + ring * 0.32);
    directTorque.y += localHit.x * (immediate * 3.0 + ring * 0.32);
    directTorque.z += cross2(localHit, impulseDirection) * (immediate * 2.65 + ring * 0.30)
      + localHit.x * (immediate * -1.16);
    depthImpulse -= immediate * 0.078;
    depthImpulse += ring * 0.010;
  }

  float dt = clamp(u_delta, 1.0 / 120.0, 1.0 / 30.0);
  float mass = max(physical.x, 0.45);
  vec2 flowTop = vec2(flowAverage.x, -flowAverage.y);
  vec2 displacementForce = -transform.xy * physical.y;
  vec2 dragForce = (flowTop * 0.13 - velocity.xy) * physical.z;
  vec2 acceleration = (
    displacementForce + dragForce + vec2(flowTop.x * 0.40, -heightCenter * material.x * 0.88) + directForce
  ) / mass;
  velocity.xy += acceleration * dt;
  velocity.xy *= exp(-physical.z * 0.10 * dt);
  transform.xy += velocity.xy * dt;
  float maxTranslation = physical.w;
  float travel = length(transform.xy);
  if (travel > maxTranslation) {
    transform.xy *= maxTranslation / travel;
    velocity.xy *= 0.42;
  }

  float quietLift = (sin(u_time * 0.31 + float(index) * 2.31)
    + sin(u_time * 0.17 + float(index) * 0.83) * 0.55) * 0.00008;
  float buoyancyTarget = clamp(
    -heightCenter * material.x * 0.34 + (heightLower - heightUpper) * 0.18 + quietLift,
    -maxTranslation * 0.45,
    maxTranslation * 0.45
  );
  float buoyancyAcceleration = (buoyancyTarget - transform.w) * 8.8 - velocity.w * 5.4;
  velocity.w += buoyancyAcceleration * dt;
  transform.w += velocity.w * dt;

  float depthTarget = clamp(
    heightCenter * material.w * 1.6 + length(flowAverage) * 0.018 + depthImpulse,
    -0.032,
    0.030
  );
  float depthAcceleration = (depthTarget - transform.z) * 12.4 - velocity.z * 5.7;
  velocity.z += depthAcceleration * dt;
  transform.z += velocity.z * dt;

  vec3 fluidTorque = vec3(
    (flowUpper.x - flowLower.x) * 0.34 + surfaceNormal.y * 0.12 + (pressureUpper - pressureLower) * 0.34,
    (flowRight.y - flowLeft.y) * -0.34 + surfaceNormal.x * 0.12 + (pressureRight - pressureLeft) * 0.34,
    (flowRight.y - flowLeft.y) * 0.42 + (pressureRight - pressureLeft) * 0.48
  );
  vec3 angularSpring = vec3(material.y * 0.88, material.y * 0.88, material.y) * orientation.xyz;
  vec3 angularAcceleration = (
    fluidTorque + directTorque - angularSpring - angularVelocity.xyz * vec3(5.4, 5.4, 5.9)
  ) / (mass * (0.68 + max(rest.z, rest.w) * 4.0));
  angularVelocity.xyz += angularAcceleration * dt;
  orientation.xyz += angularVelocity.xyz * dt;
  vec3 rotationLimit = vec3(material.z * 1.45, material.z * 1.45, material.z);
  orientation.xyz = clamp(orientation.xyz, -rotationLimit, rotationLimit);
  for (int axis = 0; axis < 3; axis++) {
    if (abs(orientation[axis]) >= rotationLimit[axis] * 0.999) angularVelocity[axis] *= 0.38;
  }

  vec4 nextState = row == 0 ? transform
    : row == 1 ? velocity
    : row == 2 ? orientation
    : angularVelocity;
  outColor = writeGlyphState(nextState, row, physicalRow);
}
`;
