type Point = { x: number; y: number };
export type ContactBody = {
  position: Point;
  velocity: Point;
  width: number;
  height: number;
  mass: number;
};

/** Soft rounded-body contact. Returns closing speed for the shared water impulse. */
export function resolveContact(
  a: ContactBody,
  b: ContactBody,
  elapsed: number,
  held?: ContactBody,
) {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const overlapX = (a.width + b.width) * 0.46 - Math.abs(dx);
  const overlapY = (a.height + b.height) * 0.46 - Math.abs(dy);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  const axis = overlapX < overlapY ? "x" : "y";
  const direction = Math.sign(axis === "x" ? dx : dy) || 1;
  const inverseA = a === held ? 0 : 1 / a.mass;
  const inverseB = b === held ? 0 : 1 / b.mass;
  const inverseSum = inverseA + inverseB;
  const overlap = Math.min(axis === "x" ? overlapX : overlapY, 0.08);
  const correction =
    overlap * (1 - Math.exp(-24 * Math.min(Math.max(elapsed, 0), 0.05)));
  a.position[axis] -= (direction * correction * inverseA) / inverseSum;
  b.position[axis] += (direction * correction * inverseB) / inverseSum;
  const closing = (b.velocity[axis] - a.velocity[axis]) * direction;
  if (closing >= 0) return 0;
  // Restitution .25 gives a small bump without adding energy to free bodies.
  const impulse = (-closing * 1.25) / inverseSum;
  a.velocity[axis] -= impulse * inverseA * direction;
  b.velocity[axis] += impulse * inverseB * direction;
  return -closing;
}
