import { Euler, Quaternion, Vector2, Vector3, type PerspectiveCamera } from "three";
import type { HeroGlyphRuntime } from "../renderer/underwater/underwaterHeroRenderer";
import { pointSegmentDistance, radialFalloff, softLimitForce } from "./waterCoordinates.ts";

export type GlyphInteraction = Readonly<{
  kind: "wake" | "press" | "feedback";
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
};

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
  if (!Number.isFinite(body.restScreenCenter.x) || !Number.isFinite(body.restScreenCenter.y)) {
    const projected = body.projectionScratch.copy(body.restPosition).project(camera);
    body.restScreenCenter.set(
      (projected.x * 0.5 + 0.5) * viewport[0],
      (1 - (projected.y * 0.5 + 0.5)) * viewport[1],
    );
  }
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
  return (1 - Math.abs(distance) / minimumDistance) * 0.018;
}

export function stepGlyphBodies(
  bodies: GlyphBody[],
  camera: PerspectiveCamera,
  viewport: readonly [number, number],
  interactions: readonly GlyphInteraction[],
  dt: number,
  now: number,
  reducedMotion: boolean,
) {
  const motionScale = reducedMotionScale(reducedMotion);
  for (const body of bodies) projectGlyph(body, camera, viewport);
  for (let index = 0; index < bodies.length; index += 1) {
    const body = bodies[index];
    const screen = body.projectedState;
    body.currentForce.set(0, 0, 0);
    body.currentTorque.set(0, 0, 0);
    body.nearestInteraction = Number.POSITIVE_INFINITY;

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
      const temporal = event.kind === "press" ? Math.exp(-(age - arrival) * 4.2) : Math.exp(-age * 6.5);
      const strength = event.strength * falloff * temporal * motionScale;
      if (strength < 0.0001) continue;
      const radialX = screen.center.x - event.end[0];
      const radialY = screen.center.y - event.end[1];
      const radialLength = Math.max(Math.hypot(radialX, radialY), 1);
      const inheritedWeight = event.kind === "press" ? 0.34 : 1;
      const directionX = event.direction[0] * inheritedWeight + radialX / radialLength * (1 - inheritedWeight);
      const directionY = event.direction[1] * inheritedWeight + radialY / radialLength * (1 - inheritedWeight);
      const directionLength = Math.max(Math.hypot(directionX, directionY), 0.001);
      const fx = directionX / directionLength * strength;
      const fy = directionY / directionLength * strength;
      body.currentForce.x += fx * 2.8;
      body.currentForce.z += fy * 2.8;
      body.currentForce.y += (event.kind === "press" ? -1 : 0.18) * strength * 0.75;
      const localHitX = Math.max(-1.15, Math.min(1.15, (event.end[0] - screen.center.x) / Math.max(screen.halfSize.x, 8)));
      const localHitY = Math.max(-1.15, Math.min(1.15, (event.end[1] - screen.center.y) / Math.max(screen.halfSize.y, 8)));
      const torque = (localHitX * screen.halfSize.x * fy - localHitY * screen.halfSize.y * fx)
        / Math.max(bodyRadius, 20);
      const torqueScale = event.kind === "wake" ? 2.8 : 1;
      body.currentTorque.x += -fy * localHitY * 0.92 * torqueScale;
      body.currentTorque.z += fx * localHitX * 0.92 * torqueScale;
      body.currentTorque.y += torque * 1.82 * torqueScale;
      body.lastActiveAt = now;
    }

    const spring = 16;
    const drag = 13.5;
    body.currentForce.x += -body.position.x * spring + softLimitForce(body.position.x, body.maxTravel, 44);
    body.currentForce.z += -body.position.z * spring + softLimitForce(body.position.z, body.maxTravel, 44);
    body.currentForce.y += -body.position.y * 20 - body.velocity.y * 14;
    body.velocity.x += (body.currentForce.x / body.mass - body.velocity.x * drag) * dt;
    body.velocity.z += (body.currentForce.z / body.mass - body.velocity.z * drag) * dt;
    body.velocity.y += body.currentForce.y / body.mass * dt;
    body.position.addScaledVector(body.velocity, dt);

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
