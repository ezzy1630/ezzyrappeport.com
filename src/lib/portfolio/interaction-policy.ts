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
  minDistance = 3,
  minInterval = 38,
}: MovementSplatInput) {
  if (distance <= minDistance || now - lastAt <= minInterval) return null;
  return Math.min(0.28, Math.max(0.08, 0.07 + distance / 520));
}
