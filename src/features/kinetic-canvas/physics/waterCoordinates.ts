export type RectLike = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type Point2 = Readonly<{ x: number; y: number }>;

export function clientToCanvasPoint(point: Point2, rect: RectLike) {
  return {
    x: point.x - rect.left,
    y: point.y - rect.top,
  };
}

export function canvasPointToUv(point: Point2, rect: RectLike) {
  return {
    x: Math.max(0, Math.min(1, point.x / Math.max(rect.width, 1))),
    y: Math.max(0, Math.min(1, point.y / Math.max(rect.height, 1))),
  };
}

export function clientToWaterUv(point: Point2, rect: RectLike) {
  const local = clientToCanvasPoint(point, rect);
  const topLeftUv = canvasPointToUv(local, rect);
  return { x: topLeftUv.x, y: 1 - topLeftUv.y };
}

export function waterUvToNdc(point: Point2) {
  return { x: point.x * 2 - 1, y: point.y * 2 - 1 };
}

export function pointInRect(point: Point2, rect: RectLike) {
  return point.x >= rect.left && point.x <= rect.left + rect.width
    && point.y >= rect.top && point.y <= rect.top + rect.height;
}

export function pointSegmentDistance(point: Point2, start: Point2, end: Point2) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
}

export function radialFalloff(distance: number, radius: number, exponent = 2) {
  const normalized = distance / Math.max(radius, 0.0001);
  return Math.exp(-Math.pow(normalized, exponent));
}

export function softLimitForce(value: number, limit: number, stiffness: number) {
  const safeLimit = Math.max(limit, 0.0001);
  const normalized = Math.abs(value) / safeLimit;
  if (normalized <= 0.68) return 0;
  const excess = (normalized - 0.68) / 0.32;
  return -Math.sign(value) * stiffness * excess * excess;
}

