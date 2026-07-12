export type MovementSplatInput = {
  distance: number;
  now: number;
  lastAt: number;
  minDistance?: number;
  minInterval?: number;
};

export function resolveMovementSplat({
  distance,
  now,
  lastAt,
  minDistance = 10,
  minInterval = 90,
}: MovementSplatInput) {
  if (distance <= minDistance || now - lastAt <= minInterval) return null;
  return Math.min(0.34, Math.max(0.12, 0.11 + distance / 420));
}
