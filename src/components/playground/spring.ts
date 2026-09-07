/** Semi-implicit integration with bounded substeps keeps release stable after a slow frame. */
export function advanceSpring(
  position: number,
  velocity: number,
  target: number,
  elapsed: number,
  stiffness = 95,
  damping = 12,
) {
  const duration = Math.min(Math.max(elapsed, 0), 0.05);
  const steps = Math.max(1, Math.ceil(duration / (1 / 120)));
  const dt = duration / steps;
  for (let i = 0; i < steps; i++) {
    velocity += ((target - position) * stiffness - velocity * damping) * dt;
    position += velocity * dt;
  }
  return { position, velocity };
}
