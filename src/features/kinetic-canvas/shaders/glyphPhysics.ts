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
uniform float u_glyphScrollOffset;
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
  rest.y -= u_glyphScrollOffset;
  vec4 physical = u_glyphPhysics[index];
  vec4 material = u_glyphMaterial[index];
  vec2 centerTop = rest.xy + transform.xy + vec2(0.0, transform.w);
  vec2 center = vec2(centerTop.x, 1.0 - centerTop.y);
  vec2 halfExtent = max(rest.zw * 1.04, vec2(0.004));
  vec2 left = center - vec2(halfExtent.x, 0.0);
  vec2 right = center + vec2(halfExtent.x, 0.0);
  vec2 upper = center + vec2(0.0, halfExtent.y);
  vec2 lower = center - vec2(0.0, halfExtent.y);
  vec2 cornerExtent = halfExtent * 0.72;
  vec2 upperLeft = center + vec2(-cornerExtent.x, cornerExtent.y);
  vec2 upperRight = center + cornerExtent;
  vec2 lowerLeft = center - cornerExtent;
  vec2 lowerRight = center + vec2(cornerExtent.x, -cornerExtent.y);

  vec2 flowCenter = decodeVelocity(texture(u_velocity, center));
  vec2 flowLeft = decodeVelocity(texture(u_velocity, left));
  vec2 flowRight = decodeVelocity(texture(u_velocity, right));
  vec2 flowUpper = decodeVelocity(texture(u_velocity, upper));
  vec2 flowLower = decodeVelocity(texture(u_velocity, lower));
  vec2 farExtent = halfExtent * 2.6 + vec2(0.012);
  vec2 flowFarLeft = decodeVelocity(texture(u_velocity, center - vec2(farExtent.x, 0.0)));
  vec2 flowFarRight = decodeVelocity(texture(u_velocity, center + vec2(farExtent.x, 0.0)));
  vec2 flowFarUpper = decodeVelocity(texture(u_velocity, center + vec2(0.0, farExtent.y)));
  vec2 flowFarLower = decodeVelocity(texture(u_velocity, center - vec2(0.0, farExtent.y)));
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
  // Remove the broad carrier current used to keep the hero water alive. Glyphs
  // respond to a local wake/pressure change, not the ambient sheet drifting as
  // one body across the viewport.
  vec2 carrierFlow = (flowFarLeft + flowFarRight + flowFarUpper + flowFarLower) * 0.25;
  vec2 localFlow = clamp(flowAverage - carrierFlow, vec2(-0.095), vec2(0.095));
  float pressureLeft = texture(u_pressure, left).r - 0.5;
  float pressureRight = texture(u_pressure, right).r - 0.5;
  float pressureUpper = texture(u_pressure, upper).r - 0.5;
  float pressureLower = texture(u_pressure, lower).r - 0.5;
  float pressureUpperLeft = texture(u_pressure, upperLeft).r - 0.5;
  float pressureUpperRight = texture(u_pressure, upperRight).r - 0.5;
  float pressureLowerLeft = texture(u_pressure, lowerLeft).r - 0.5;
  float pressureLowerRight = texture(u_pressure, lowerRight).r - 0.5;

  // Pointer sweeps retain a restrained direct wake. Press events only gate the
  // locally integrated solver pressure; they no longer kick a second,
  // unrelated rigid-body animation on top of the water.
  float localRadius = max(rest.z, rest.w) * 1.25 + 0.018;
  vec2 fromPointer = centerTop - u_pointer.xy;
  float pointerDistance = length(fromPointer);
  float pointerWake = exp(-pow(pointerDistance / localRadius, 1.35)) * u_pointer.z;
  float pointerDisturbance = clamp(pointerWake * 1.4, 0.0, 1.0);
  float rippleDisturbance = 0.0;
  float pressDisturbance = 0.0;
  float pointerSpeed = length(u_pointerVelocity);
  float sweepAttack = pointerWake * smoothstep(0.025, 0.34, pointerSpeed);
  vec2 directForce = u_pointerVelocity * pointerWake * 2.7;
  float depthImpulse = pointerWake * min(length(u_pointerVelocity) * 0.8, 0.012);
  vec2 pointerLocalHit = (u_pointer.xy - centerTop) / max(rest.zw, vec2(0.001));
  vec2 sweepDirection = normalize(u_pointerVelocity + vec2(0.000001));
  vec3 directTorque = vec3(
    -fromPointer.y * directForce.x,
    fromPointer.x * directForce.y,
    cross2(fromPointer / max(rest.zw, vec2(0.001)), directForce)
  );
  directTorque.x += -pointerLocalHit.y * sweepAttack * 12.0;
  directTorque.y += pointerLocalHit.x * sweepAttack * 12.0;
  directTorque.z += cross2(pointerLocalHit, sweepDirection) * sweepAttack * 14.0;
  float debugDisturbance = 0.0;

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
    debugDisturbance = debugAttack;
    vec2 debugDirection = normalize(u_debugImpulse.zw + vec2(0.000001));
    vec2 debugForce = debugDirection * debugAttack * 7.4;
    vec2 debugLocalHit = (u_debugImpulse.xy - centerTop) / max(rest.zw, vec2(0.001));
    directForce += debugForce;
    directTorque.x += -debugLocalHit.y * debugAttack * 18.0;
    directTorque.y += debugLocalHit.x * debugAttack * 18.0;
    directTorque.z += cross2(debugLocalHit, debugDirection) * debugAttack * 24.0;
    depthImpulse -= debugAttack * 0.055;
  }

  for (int rippleIndex = 0; rippleIndex < 8; rippleIndex++) {
    vec4 ripple = u_ripples[rippleIndex];
    float age = u_time - ripple.z;
    if (age < 0.0 || age > 3.2 || ripple.w <= 0.001) continue;
    vec2 hitOffset = centerTop - ripple.xy;
    float distancePixels = length(hitOffset * u_viewport);
    float glyphPixels = max(length(rest.zw * u_viewport), 28.0);
    vec2 localPress = (ripple.xy - centerTop) / max(rest.zw, vec2(0.001));
    float boundsDistancePixels = length(max(abs(localPress) - 1.0, vec2(0.0)) * rest.zw * u_viewport);
    float nearestBoundsDistance = 99999.0;
    for (int candidateIndex = 0; candidateIndex < GLYPH_COUNT; candidateIndex++) {
      vec4 candidate = u_glyphRest[candidateIndex];
      candidate.y -= u_glyphScrollOffset;
      vec2 candidateLocal = (ripple.xy - candidate.xy) / max(candidate.zw, vec2(0.001));
      float candidateDistance = length(
        max(abs(candidateLocal) - 1.0, vec2(0.0)) * candidate.zw * u_viewport
      );
      nearestBoundsDistance = min(nearestBoundsDistance, candidateDistance);
    }
    float immediatePriority = 1.0 - smoothstep(
      nearestBoundsDistance + 1.0,
      nearestBoundsDistance + 7.0,
      boundsDistancePixels
    );
    float immediate = exp(-pow(distancePixels / (glyphPixels * 0.38 + 16.0), 2.0))
      * exp(-age * 11.0) * ripple.w * mix(0.18, 1.0, immediatePriority);
    float ringRadius = 22.0 + age * 185.0;
    float surfaceDistance = boundsDistancePixels + (1.0 - immediatePriority) * 44.0;
    float arrivalTime = surfaceDistance / 185.0;
    float arrived = smoothstep(arrivalTime, arrivalTime + 0.12, age);
    float ring = exp(-abs(distancePixels - ringRadius) / 54.0)
      * (1.0 - age / 3.2) * ripple.w * arrived;
    float rippleActivity = clamp(immediate * 2.2 + ring * 1.35, 0.0, 1.0);
    rippleDisturbance = max(rippleDisturbance, rippleActivity);
    pressDisturbance = max(pressDisturbance, rippleActivity * smoothstep(0.52, 0.80, ripple.w));
    vec2 radial = length(hitOffset) > 0.0001 ? normalize(hitOffset) : vec2(0.0, -1.0);
    depthImpulse -= immediate * 0.018;
    depthImpulse += ring * 0.006;
  }

  float dt = clamp(u_delta, 1.0 / 120.0, 1.0 / 30.0);
  float mass = max(physical.x, 0.45);
  float localDisturbance = max(pointerDisturbance * 0.72, rippleDisturbance);
  vec2 flowTop = vec2(localFlow.x, -localFlow.y) * (0.10 + localDisturbance * 0.90);
  vec2 pressureForce = vec2(
    pressureLeft - pressureRight,
    pressureUpper - pressureLower
  ) * (160.0 + localDisturbance * 820.0);
  pressureForce += vec2(-surfaceNormal.x, surfaceNormal.y)
    * (0.12 + localDisturbance * 0.65);
  vec2 displacementForce = -transform.xy * physical.y;
  vec2 dragForce = (flowTop * 0.36 - velocity.xy) * physical.z;
  float maxTranslation = physical.w;
  float travelPixels = length(transform.xy * u_viewport);
  float maxTranslationPixels = max(maxTranslation * max(u_viewport.x, u_viewport.y), 1.0);
  float limitRatio = travelPixels / maxTranslationPixels;
  vec2 softLimitForce = vec2(0.0);
  if (limitRatio > 0.68) {
    softLimitForce = -normalize(transform.xy + vec2(0.000001))
      * physical.y * pow((limitRatio - 0.68) / 0.32, 2.0) * 1.8;
  }
  vec2 acceleration = (
    displacementForce + softLimitForce + dragForce
      + vec2(flowTop.x * 1.15, -heightCenter * material.x * 1.05)
      + pressureForce + directForce
  ) / mass;
  velocity.xy += acceleration * dt;
  velocity.xy *= exp(-physical.z * 0.10 * dt);
  float planarSpeedPixels = length(velocity.xy * u_viewport);
  if (planarSpeedPixels > 110.0) velocity.xy *= 110.0 / planarSpeedPixels;
  transform.xy += velocity.xy * dt;
  // An unreachable safety guard prevents numerical escape without becoming the
  // visible settling behavior. Normal motion is governed by the soft potential.
  travelPixels = length(transform.xy * u_viewport);
  if (travelPixels > maxTranslationPixels * 1.18) {
    transform.xy *= (maxTranslationPixels * 1.18) / travelPixels;
    velocity.xy *= 0.82;
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
    heightCenter * material.w * 1.6 + length(localFlow) * 0.018 + depthImpulse,
    -0.032,
    0.030
  );
  float depthAcceleration = (depthTarget - transform.z) * 12.4 - velocity.z * 5.7;
  velocity.z += depthAcceleration * dt;
  transform.z += velocity.z * dt;

  float diagonalPressureTorque = (pressureUpperRight + pressureLowerLeft)
    - (pressureUpperLeft + pressureLowerRight);
  vec3 fluidTorque = vec3(
    (flowUpper.x - flowLower.x) * 0.34 + surfaceNormal.y * 0.12
      + (pressureUpper - pressureLower) * 1800.0,
    (flowRight.y - flowLeft.y) * -0.34 + surfaceNormal.x * 0.12
      + (pressureRight - pressureLeft) * 1800.0,
    (flowRight.y - flowLeft.y) * 0.42 + diagonalPressureTorque * 2800.0
  ) * (0.18 + localDisturbance * 0.82);
  vec3 angularSpring = vec3(material.y * 0.88, material.y * 0.88, material.y) * orientation.xyz;
  vec3 angularAcceleration = (
    fluidTorque + directTorque - angularSpring - angularVelocity.xyz * vec3(5.4, 5.4, 5.9)
  ) / (mass * (0.68 + max(rest.z, rest.w) * 4.0));
  angularVelocity.xyz += angularAcceleration * dt;
  angularVelocity.xyz = clamp(angularVelocity.xyz, vec3(-0.62), vec3(0.62));
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
