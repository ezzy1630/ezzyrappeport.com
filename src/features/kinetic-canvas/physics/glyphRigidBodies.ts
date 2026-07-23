import { Euler, Quaternion, Vector2, Vector3, type PerspectiveCamera } from "three";
import type { HeroGlyphRuntime } from "../renderer/underwater/underwaterHeroRenderer";
import { pointSegmentDistance, radialFalloff, softLimitForce } from "./waterCoordinates.ts";

export type GlyphInteraction = Readonly<{
  kind: "wake" | "press" | "release" | "feedback";
  start: readonly [number, number];
  end: readonly [number, number];
  direction: readonly [number, number];
  strength: number;
  radius: number;
  time: number;
}>;

export type GlyphBody = {
  glyph: HeroGlyphRuntime;
  position: Vector3;
  velocity: Vector3;
  orientation: Vector3;
  angularVelocity: Vector3;
  restPosition: Vector3;
  restQuaternion: Quaternion;
  mass: number;
  inertia: Vector3;
  halfSize: Vector2;
  projectedHalfSize: Vector2;
  projectedCenter: Vector2;
  restScreenCenter: Vector2;
  projectionScratch: Vector3;
  projectedState: ProjectedGlyph;
  rotationScratch: Quaternion;
  eulerScratch: Euler;
  maxTravel: number;
  maxTilt: number;
  currentForce: Vector3;
  currentTorque: Vector3;
  nearestInteraction: number;
  peakPixels: number;
  peakDegrees: number;
  lastActiveAt: number;
  ambientPhase: number;
  ambientFrequency: number;
  ambientAmplitude: number;
  ambientTiltAmplitude: number;
  maxDepth: number;
  maxLinearSpeed: number;
};

export type GlyphStepControl = {
  ambientScale: number;
  hoverGlyphIndex: number;
  hoverStrength: number;
  hoverPoint: readonly [number, number];
  holdGlyphIndex: number;
  holdPoint: readonly [number, number];
  holdAge: number;
  entranceStart: number;
  entranceDepth: number;
  entranceStagger: number;
};

export const DEFAULT_GLYPH_STEP_CONTROL: GlyphStepControl = {
  ambientScale: 1,
  hoverGlyphIndex: -1,
  hoverStrength: 0,
  hoverPoint: [0, 0],
  holdGlyphIndex: -1,
  holdPoint: [0, 0],
  holdAge: 0,
  entranceStart: Number.POSITIVE_INFINITY,
  entranceDepth: -0.045,
  entranceStagger: 0.04,
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function glyphPhaseForIdentity(index: number, identity: string) {
  let hash = 2166136261;
  for (let characterIndex = 0; characterIndex < identity.length; characterIndex += 1) {
    hash ^= identity.charCodeAt(characterIndex);
    hash = Math.imul(hash, 16777619);
  }
  return (index * GOLDEN_ANGLE + (hash >>> 0) / 0xffffffff * Math.PI * 2) % (Math.PI * 2);
}

export type ProjectedGlyph = {
  center: Vector2;
  halfSize: Vector2;
  depth: number;
};

export function deriveMassAndInertia(glyph: HeroGlyphRuntime, variation = 1) {
  glyph.object.geometry.computeBoundingBox();
  const geometryBounds = glyph.object.geometry.boundingBox;
  const bounds = geometryBounds
    ? {
        min: [geometryBounds.min.x, geometryBounds.min.y, geometryBounds.min.z],
        max: [geometryBounds.max.x, geometryBounds.max.y, geometryBounds.max.z],
      }
    : glyph.manifest.local_bounding_box;
  const scale = glyph.manifest.rest_transform.scale;
  const width = (bounds.max[0] - bounds.min[0]) * scale[0];
  const depth = (bounds.max[1] - bounds.min[1]) * scale[1];
  const height = (bounds.max[2] - bounds.min[2]) * scale[2];
  const volume = Math.max(width * height * depth, 0.002);
  const mass = Math.max(0.62, Math.min(1.55, 0.72 + volume * 4.2)) * variation;
  return {
    mass,
    inertia: new Vector3(
      mass * (height * height + depth * depth) / 12,
      mass * (width * width + height * height) / 12,
      mass * (width * width + depth * depth) / 12,
    ),
    halfSize: new Vector2(width * 0.5, height * 0.5),
  };
}

export function createGlyphBodies(glyphs: HeroGlyphRuntime[]) {
  return glyphs.map((glyph, index): GlyphBody => {
    const derived = deriveMassAndInertia(glyph, 0.96 + ((index * 37) % 9) * 0.011);
    const projectedHalfSize = new Vector2();
    const projectedCenter = new Vector2();
    return {
      glyph,
      position: new Vector3(),
      velocity: new Vector3(),
      orientation: new Vector3(),
      angularVelocity: new Vector3(),
      restPosition: glyph.object.position.clone(),
      restQuaternion: glyph.object.quaternion.clone(),
      mass: derived.mass,
      inertia: derived.inertia,
      halfSize: derived.halfSize,
      projectedHalfSize,
      projectedCenter,
      restScreenCenter: new Vector2(Number.NaN, Number.NaN),
      projectionScratch: new Vector3(),
      projectedState: { center: projectedCenter, halfSize: projectedHalfSize, depth: 0 },
      rotationScratch: new Quaternion(),
      eulerScratch: new Euler(0, 0, 0, "XYZ"),
      maxTravel: 0.068 + (index % 3) * 0.005,
      maxTilt: (4.0 + (index % 4) * 0.45) * Math.PI / 180,
      currentForce: new Vector3(),
      currentTorque: new Vector3(),
      nearestInteraction: Number.POSITIVE_INFINITY,
      peakPixels: 0,
      peakDegrees: 0,
      lastActiveAt: 0,
      ambientPhase: glyphPhaseForIdentity(index, glyph.manifest.object_node_name),
      ambientFrequency: index % 2 === 0 ? 0.46 : 0.71,
      ambientAmplitude: 0.013 + (index % 3) * 0.0018,
      ambientTiltAmplitude: (0.6 + (index % 4) * 0.18) * Math.PI / 180,
      maxDepth: 0.078,
      maxLinearSpeed: 0.58,
    };
  });
}

export function projectGlyph(body: GlyphBody, camera: PerspectiveCamera, viewport: readonly [number, number]): ProjectedGlyph {
  const object = body.glyph.object;
  object.updateMatrixWorld(true);
  const pivot = body.projectionScratch.fromArray(body.glyph.manifest.pivot.local).applyMatrix4(object.matrixWorld).project(camera);
  body.projectedCenter.set((pivot.x * 0.5 + 0.5) * viewport[0], (1 - (pivot.y * 0.5 + 0.5)) * viewport[1]);
  if (body.projectedHalfSize.x <= 0 || body.projectedHalfSize.y <= 0) {
    body.glyph.object.geometry.computeBoundingBox();
    const geometryBounds = body.glyph.object.geometry.boundingBox;
    const bounds = geometryBounds
      ? {
          min: [geometryBounds.min.x, geometryBounds.min.y, geometryBounds.min.z],
          max: [geometryBounds.max.x, geometryBounds.max.y, geometryBounds.max.z],
        }
      : body.glyph.manifest.local_bounding_box;
    let minimumX = Number.POSITIVE_INFINITY;
    let maximumX = Number.NEGATIVE_INFINITY;
    let minimumY = Number.POSITIVE_INFINITY;
    let maximumY = Number.NEGATIVE_INFINITY;
    const corner = new Vector3();
    for (const x of [bounds.min[0], bounds.max[0]]) {
      for (const y of [bounds.min[1], bounds.max[1]]) {
        for (const z of [bounds.min[2], bounds.max[2]]) {
          corner.set(x, y, z).applyMatrix4(object.matrixWorld).project(camera);
          const screenX = (corner.x * 0.5 + 0.5) * viewport[0];
          const screenY = (1 - (corner.y * 0.5 + 0.5)) * viewport[1];
          minimumX = Math.min(minimumX, screenX);
          maximumX = Math.max(maximumX, screenX);
          minimumY = Math.min(minimumY, screenY);
          maximumY = Math.max(maximumY, screenY);
        }
      }
    }
    body.projectedHalfSize.set(Math.max(8, (maximumX - minimumX) * 0.5), Math.max(8, (maximumY - minimumY) * 0.5));
  }
  body.projectedState.depth = pivot.z;
  return body.projectedState;
}

export function projectGlyphRestCenter(body: GlyphBody, camera: PerspectiveCamera, viewport: readonly [number, number]) {
  // The camera moves with the shared world depth. Reproject the mooring every
  // call so cached screen coordinates cannot turn scroll into fake glyph drift.
  const projected = body.projectionScratch.copy(body.restPosition).project(camera);
  body.restScreenCenter.set(
    (projected.x * 0.5 + 0.5) * viewport[0],
    (1 - (projected.y * 0.5 + 0.5)) * viewport[1],
  );
  return body.restScreenCenter;
}

export function offCenterTorque(
  center: readonly [number, number],
  point: readonly [number, number],
  force: readonly [number, number],
) {
  const leverX = point[0] - center[0];
  const leverY = point[1] - center[1];
  return leverX * force[1] - leverY * force[0];
}

export function wakeFalloff(distance: number, radius: number) {
  return radialFalloff(distance, radius, 1.7);
}

export function hoverFalloff(distance: number, radius: number) {
  return radialFalloff(distance, radius, 2.2);
}

export function clickPressureFalloff(distance: number, radius: number) {
  return radialFalloff(distance, radius, 2);
}

export function neighborArrivalDelay(distancePixels: number, propagationSpeed = 220) {
  return Math.max(0, distancePixels) / Math.max(propagationSpeed, 1);
}

export function reducedMotionScale(reducedMotion: boolean) {
  return reducedMotion ? 0.08 : 1;
}

export function pairwiseSeparationImpulse(distance: number, minimumDistance: number) {
  if (distance >= minimumDistance || minimumDistance <= 0) return 0;
  return (1 - Math.abs(distance) / minimumDistance) * 0.022;
}

export function projectedGlyphRadius(body: GlyphBody) {
  return Math.hypot(body.projectedState.halfSize.x, body.projectedState.halfSize.y) * 1.4;
}

export function nearestGlyphIndex(
  bodies: readonly GlyphBody[],
  point: readonly [number, number],
) {
  let nearest = -1;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const body of bodies) {
    const dx = point[0] - body.projectedState.center.x;
    const dy = point[1] - body.projectedState.center.y;
    const distance = Math.hypot(dx, dy);
    if (distance > projectedGlyphRadius(body) || distance >= nearestDistance) continue;
    nearest = body.glyph.manifest.glyph_index;
    nearestDistance = distance;
  }
  return nearest;
}

export function glyphHoverStrength(body: GlyphBody, point: readonly [number, number]) {
  const radius = projectedGlyphRadius(body);
  const distance = Math.hypot(
    point[0] - body.projectedState.center.x,
    point[1] - body.projectedState.center.y,
  );
  return distance > radius ? 0 : hoverFalloff(distance, radius);
}

function isFiniteBody(body: GlyphBody) {
  return [
    body.position.x, body.position.y, body.position.z,
    body.velocity.x, body.velocity.y, body.velocity.z,
    body.orientation.x, body.orientation.y, body.orientation.z,
    body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z,
  ].every(Number.isFinite);
}

export function hasFiniteGlyphBodyState(body: GlyphBody) {
  return isFiniteBody(body);
}

function recoverInvalidBody(body: GlyphBody) {
  if (process.env.NODE_ENV !== "production") {
    throw new Error(`Glyph physics invalid numeric state: ${body.glyph.manifest.object_node_name}`);
  }
  body.position.set(0, 0, 0);
  body.velocity.set(0, 0, 0);
  body.orientation.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export function stepGlyphBodies(
  bodies: GlyphBody[],
  camera: PerspectiveCamera,
  viewport: readonly [number, number],
  interactions: readonly GlyphInteraction[],
  dt: number,
  now: number,
  reducedMotion: boolean,
  control: GlyphStepControl = DEFAULT_GLYPH_STEP_CONTROL,
) {
  const motionScale = reducedMotionScale(reducedMotion);
  const ambientScale = reducedMotion ? 0 : clamp(control.ambientScale, 0, 1);
  for (const body of bodies) projectGlyph(body, camera, viewport);
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    const screen = body.projectedState;
    body.currentForce.set(0, 0, 0);
    body.currentTorque.set(0, 0, 0);
    body.nearestInteraction = Number.POSITIVE_INFINITY;

    const glyphIndex = body.glyph.manifest.glyph_index;
    const ambientBob = Math.sin(now * body.ambientFrequency * Math.PI * 2 + body.ambientPhase)
      * body.ambientAmplitude * ambientScale;
    const ambientRoll = Math.sin(now * body.ambientFrequency * 1.31 * Math.PI * 2 + body.ambientPhase * 0.71)
      * body.ambientTiltAmplitude * ambientScale;
    const entranceAge = now - (control.entranceStart + glyphIndex * control.entranceStagger);
    const entranceHolding = control.entranceStart < Number.POSITIVE_INFINITY && entranceAge < 0;
    let targetZ = ambientBob;
    if (glyphIndex === control.hoverGlyphIndex && control.hoverStrength > 0) {
      const hoverStrength = clamp(control.hoverStrength, 0, 1);
      targetZ -= 0.028 * hoverStrength;
      const localX = clamp(
        (control.hoverPoint[0] - screen.center.x) / Math.max(screen.halfSize.x, 8),
        -1.15,
        1.15,
      );
      const localY = clamp(
        (control.hoverPoint[1] - screen.center.y) / Math.max(screen.halfSize.y, 8),
        -1.15,
        1.15,
      );
      // The target is an equilibrium offset, so hover cannot accumulate.
      body.currentForce.x += localX * hoverStrength * 0.08;
      body.currentTorque.x += -localY * hoverStrength * 0.44;
      body.currentTorque.z += localX * hoverStrength * 0.44;
    }
    body.currentTorque.x += ambientRoll * 30;
    body.currentTorque.z += Math.sin(now * body.ambientFrequency * 0.87 * Math.PI * 2 + body.ambientPhase * 1.37)
      * body.ambientTiltAmplitude * 0.72 * ambientScale * 25;

    for (const event of interactions) {
      const age = Math.max(0, now - event.time);
      const distance = pointSegmentDistance(
        screen.center,
        { x: event.start[0], y: event.start[1] },
        { x: event.end[0], y: event.end[1] },
      );
      const bodyRadius = Math.hypot(screen.halfSize.x, screen.halfSize.y);
      const arrival = event.kind === "press"
        ? neighborArrivalDelay(Math.max(0, distance - bodyRadius * 0.72))
        : 0;
      if (age + 0.001 < arrival) continue;
      body.nearestInteraction = Math.min(body.nearestInteraction, distance);
      const falloffDistance = Math.max(0, distance - bodyRadius * 0.55);
      const falloffRadius = event.radius + bodyRadius * 0.35;
      const falloff = event.kind === "press"
        ? clickPressureFalloff(falloffDistance, falloffRadius)
        : wakeFalloff(falloffDistance, falloffRadius);
      const temporal = event.kind === "press"
        ? Math.exp(-(age - arrival) * 4.2)
        : event.kind === "release"
          ? Math.exp(-age * 5.2)
          : Math.exp(-age * 6.5);
      const strength = event.strength * falloff * temporal * motionScale;
      if (strength < 0.0001) continue;
      const radialX = screen.center.x - event.end[0];
      const radialY = screen.center.y - event.end[1];
      const radialLength = Math.max(Math.hypot(radialX, radialY), 1);
      const inheritedWeight = event.kind === "press" ? 0.34 : event.kind === "release" ? 0.52 : 1;
      const directionX = event.direction[0] * inheritedWeight + radialX / radialLength * (1 - inheritedWeight);
      const directionY = event.direction[1] * inheritedWeight + radialY / radialLength * (1 - inheritedWeight);
      const directionLength = Math.max(Math.hypot(directionX, directionY), 0.001);
      const fx = directionX / directionLength * strength;
      const fy = directionY / directionLength * strength;
      body.currentForce.x += fx * 2.8;
      body.currentForce.z += fy * 2.8;
      body.currentForce.y += (
        event.kind === "press" ? -1 : event.kind === "release" ? 1.15 : 0.18
      ) * strength * 0.75;
      const localHitX = Math.max(-1.15, Math.min(1.15, (event.end[0] - screen.center.x) / Math.max(screen.halfSize.x, 8)));
      const localHitY = Math.max(-1.15, Math.min(1.15, (event.end[1] - screen.center.y) / Math.max(screen.halfSize.y, 8)));
      const torque = (localHitX * screen.halfSize.x * fy - localHitY * screen.halfSize.y * fx)
        / Math.max(bodyRadius, 20);
      const torqueScale = event.kind === "wake" ? 2.8 : event.kind === "release" ? 1.45 : 1;
      body.currentTorque.x += -fy * localHitY * 0.92 * torqueScale;
      body.currentTorque.z += fx * localHitX * 0.92 * torqueScale;
      body.currentTorque.y += torque * 1.82 * torqueScale;
      body.lastActiveAt = now;
    }

    const spring = 16;
    const drag = 13.5;
    body.currentForce.x += -body.position.x * spring + softLimitForce(body.position.x, body.maxTravel, 44);
    body.currentForce.z += -(body.position.z - targetZ) * spring
      + softLimitForce(body.position.z, body.maxTravel, 44);
    const holding = glyphIndex === control.holdGlyphIndex;
    if (holding) {
      const holdDepth = -Math.min(0.062, 0.05 + Math.max(0, control.holdAge) * 0.004);
      body.currentForce.y += -(body.position.y - holdDepth) * 32 - body.velocity.y * 18;
      const localX = clamp(
        (control.holdPoint[0] - screen.center.x) / Math.max(screen.halfSize.x, 8),
        -1.15,
        1.15,
      );
      const localY = clamp(
        (control.holdPoint[1] - screen.center.y) / Math.max(screen.halfSize.y, 8),
        -1.15,
        1.15,
      );
      const strain = Math.min(1, Math.max(0, control.holdAge * 2));
      body.currentTorque.x += -localY * 0.34 + Math.sin(now * Math.PI * 2 * 6 + body.ambientPhase) * 0.06 * strain;
      body.currentTorque.z += localX * 0.34;
    } else if (entranceHolding) {
      body.currentForce.y += -(body.position.y - control.entranceDepth) * 30 - body.velocity.y * 18;
    } else {
      body.currentForce.y += -body.position.y * 20 - body.velocity.y * 14;
    }
    body.velocity.x += (body.currentForce.x / body.mass - body.velocity.x * drag) * dt;
    body.velocity.z += (body.currentForce.z / body.mass - body.velocity.z * drag) * dt;
    body.velocity.y += body.currentForce.y / body.mass * dt;
    body.velocity.clampLength(0, body.maxLinearSpeed);
    body.position.addScaledVector(body.velocity, dt);
    body.position.x = clamp(body.position.x, -body.maxTravel, body.maxTravel);
    body.position.z = clamp(body.position.z, -body.maxTravel, body.maxTravel);
    body.position.y = clamp(body.position.y, -body.maxDepth, body.maxDepth * 0.55);

    const angularSpring = 13;
    const angularDrag = 13.5;
    for (const axis of ["x", "y", "z"] as const) {
      const limitForce = softLimitForce(body.orientation[axis], body.maxTilt, 38);
      const acceleration = (body.currentTorque[axis] - body.orientation[axis] * angularSpring + limitForce)
        / Math.max(body.inertia[axis] * 8, 0.08) - body.angularVelocity[axis] * angularDrag;
      body.angularVelocity[axis] += acceleration * dt;
      // Bounded rocking: torque spikes from fast circular pointer work can
      // never wind the letter into a jitter.
      body.angularVelocity[axis] = Math.max(-1.35, Math.min(1.35, body.angularVelocity[axis]));
      body.orientation[axis] += body.angularVelocity[axis] * dt;
      body.orientation[axis] = clamp(body.orientation[axis], -body.maxTilt, body.maxTilt);
    }

    // Idle deadzone: far from any disturbance, microscopic residual motion
    // decays hard to exact rest instead of shimmering indefinitely.
    if (body.nearestInteraction > 140) {
      const planarSpeed = Math.hypot(body.velocity.x, body.velocity.z);
      if (planarSpeed < 0.012 && Math.abs(body.position.x) + Math.abs(body.position.z) < 0.004) {
        body.velocity.x *= 0.6;
        body.velocity.z *= 0.6;
        if (planarSpeed < 0.003) {
          body.velocity.x = 0;
          body.velocity.z = 0;
          body.position.x *= 0.9;
          body.position.z *= 0.9;
        }
      }
      const spin = body.angularVelocity.length();
      if (spin < 0.05) {
        body.angularVelocity.multiplyScalar(0.6);
        if (spin < 0.012) {
          body.angularVelocity.set(0, 0, 0);
          body.orientation.multiplyScalar(0.94);
        }
      }
    }
    if (!isFiniteBody(body)) recoverInvalidBody(body);
  }

  // Soft screen-plane separation. It only activates near overlap and keeps line identity intact.
  for (let first = 0; first < bodies.length; first += 1) {
    for (let second = first + 1; second < bodies.length; second += 1) {
      if (bodies[first].glyph.manifest.line_index !== bodies[second].glyph.manifest.line_index) continue;
      const a = bodies[first].projectedState;
      const b = bodies[second].projectedState;
      const restA = projectGlyphRestCenter(bodies[first], camera, viewport);
      const restB = projectGlyphRestCenter(bodies[second], camera, viewport);
      const authoredGap = Math.abs(restB.x - restA.x);
      const minX = Math.min((a.halfSize.x + b.halfSize.x) * 0.82, authoredGap * 0.84);
      const minY = (a.halfSize.y + b.halfSize.y) * 0.72;
      const dx = b.center.x - a.center.x;
      const dy = Math.abs(b.center.y - a.center.y);
      if (Math.abs(dx) >= minX || dy >= minY) continue;
      const push = pairwiseSeparationImpulse(dx, Math.max(minX, 1));
      const sign = dx >= 0 ? 1 : -1;
      bodies[first].velocity.x -= sign * push / bodies[first].mass;
      bodies[second].velocity.x += sign * push / bodies[second].mass;
    }
  }

  for (const body of bodies) {
    body.velocity.clampLength(0, body.maxLinearSpeed);
    if (!isFiniteBody(body)) recoverInvalidBody(body);
  }

  for (const body of bodies) {
    body.glyph.object.position.copy(body.restPosition).add(body.position);
    body.eulerScratch.set(body.orientation.x, body.orientation.y, body.orientation.z, "XYZ");
    body.rotationScratch.setFromEuler(body.eulerScratch);
    body.glyph.object.quaternion.copy(body.restQuaternion).multiply(body.rotationScratch);
    body.glyph.object.updateMatrixWorld(true);
    const screen = projectGlyph(body, camera, viewport);
    body.peakPixels = Math.max(body.peakPixels, screen.center.distanceTo(projectGlyphRestCenter(body, camera, viewport)));
    body.peakDegrees = Math.max(body.peakDegrees, Math.max(Math.abs(body.orientation.x), Math.abs(body.orientation.y), Math.abs(body.orientation.z)) * 180 / Math.PI);
  }
}
