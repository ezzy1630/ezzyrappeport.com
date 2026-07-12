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
  minDistance = 18,
  minInterval = 160,
}: MovementSplatInput) {
  if (distance <= minDistance || now - lastAt <= minInterval) return null;
  return Math.min(0.3, Math.max(0.12, 0.12 + distance / 360));
}
