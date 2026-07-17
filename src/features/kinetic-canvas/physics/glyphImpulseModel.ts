export type GlyphImpulseBody = {
  index: number;
  center: readonly [number, number];
  halfSize: readonly [number, number];
  mass: number;
};

export type GlyphImpulseEvent = {
  point: readonly [number, number];
  direction: readonly [number, number];
  strength: number;
};

export type ResolvedGlyphImpulse = {
  force: [number, number];
  torque: number;
  weight: number;
  distancePixels: number;
  arrivalDelayMs: number;
};

export type GlyphPlanarState = {
  displacement: [number, number];
  velocity: [number, number];
  angle: number;
  angularVelocity: number;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * CPU mirror of the spatial impulse envelope used by the GPU glyph solver.
 * Coordinates are top-left-origin viewport UVs; distances are measured in CSS
 * pixels so DPR never changes which glyph receives the strongest hit.
 */
export function resolveGlyphImpulse(
  body: GlyphImpulseBody,
  event: GlyphImpulseEvent,
  viewport: readonly [number, number],
): ResolvedGlyphImpulse {
  const offsetX = body.center[0] - event.point[0];
  const offsetY = body.center[1] - event.point[1];
  const pixelX = offsetX * viewport[0];
  const pixelY = offsetY * viewport[1];
  const distancePixels = Math.hypot(pixelX, pixelY);
  const bodyRadius = Math.max(
    24,
    Math.hypot(body.halfSize[0] * viewport[0], body.halfSize[1] * viewport[1]),
  );
  const localX = (event.point[0] - body.center[0]) / Math.max(body.halfSize[0], 0.001);
  const localY = (event.point[1] - body.center[1]) / Math.max(body.halfSize[1], 0.001);
  const boundsDistancePixels = Math.hypot(
    Math.max(Math.abs(localX) - 1, 0) * body.halfSize[0] * viewport[0],
    Math.max(Math.abs(localY) - 1, 0) * body.halfSize[1] * viewport[1],
  );
  // A press on either side of the gap between adjacent glyphs is a surface
  // hit for both bodies. Center distance made that same physical event appear
  // artificially weak for wide letters and diverged from the GPU solver.
  const weight = Math.exp(-Math.pow(boundsDistancePixels / (bodyRadius * 0.72 + 18), 2));
  const directionLength = Math.max(Math.hypot(...event.direction), 1e-6);
  const directionX = event.direction[0] / directionLength;
  const directionY = event.direction[1] / directionLength;
  const forceScale = event.strength * weight / Math.max(body.mass, 0.45);
  const torque = clamp(
    (localX * directionY - localY * directionX) * forceScale,
    -event.strength * 1.5,
    event.strength * 1.5,
  );

  return {
    force: [directionX * forceScale, directionY * forceScale],
    torque,
    weight,
    distancePixels,
    arrivalDelayMs: boundsDistancePixels / 185 * 1000,
  };
}

export function stepGlyphPlanarState(
  state: GlyphPlanarState,
  impulse: Pick<ResolvedGlyphImpulse, "force" | "torque">,
  delta: number,
  spring = 15,
  damping = 7,
): GlyphPlanarState {
  const dt = clamp(delta, 1 / 240, 1 / 30);
  const accelerationX = impulse.force[0] - state.displacement[0] * spring - state.velocity[0] * damping;
  const accelerationY = impulse.force[1] - state.displacement[1] * spring - state.velocity[1] * damping;
  const angularAcceleration = impulse.torque - state.angle * spring * 0.72 - state.angularVelocity * damping * 0.84;
  const velocity: [number, number] = [
    state.velocity[0] + accelerationX * dt,
    state.velocity[1] + accelerationY * dt,
  ];
  const angularVelocity = state.angularVelocity + angularAcceleration * dt;
  return {
    displacement: [
      state.displacement[0] + velocity[0] * dt,
      state.displacement[1] + velocity[1] * dt,
    ],
    velocity,
    angle: state.angle + angularVelocity * dt,
    angularVelocity,
  };
}
