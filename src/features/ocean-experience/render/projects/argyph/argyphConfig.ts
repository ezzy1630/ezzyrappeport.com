/**
 * Argyph encounter — authored constants (plan §10.5).
 *
 * Short local sonar index: one decisive bathymetric scan reveals a dense
 * local "code reef" in tiers — tier-0 reef points immediately, symbol nodes
 * (the 19 read-only tools) resolve next, semantic links emerge last. A
 * query pulse returns bounded spans, then the resolved map widens into the
 * Charted Work catalog. Deliberately the shortest anchor beat.
 */

export const ARGYPH_LOOP = {
  reefStart: 0.02,
  reefFull: 0.2,
  sweepStart: 0.18,
  sweepFull: 0.58,
  linksStart: 0.55,
  linksFull: 0.8,
  widenStart: 0.78,
  widenFull: 0.97,
} as const;

export const ARGYPH_COUNTS = {
  /** Dense local reef points (tier 0). */
  reefPoints: 170,
  /** Symbol nodes == the 19 read-only tools (content.ts fact). */
  symbols: 19,
  /** Semantic links between symbol pairs. */
  links: 26,
  /** Points highlighted by one bounded query pulse. */
  querySpan: 14,
  /** Concurrent query pulses. */
  probePool: 2,
} as const;

/** Stage-local composition (camera-locked; +x right, +y up, +z to camera). */
export const ARGYPH_STAGE = {
  distance: 4.4,
  /** Reef patch center: left field, copy on the calm right. */
  reefDesktop: [-0.85, -0.18, 0] as const,
  reefMobile: [0, 0.5, 0] as const,
  reefRadiusX: 1.15,
  reefRadiusY: 0.62,
  sweepRadiusMax: 1.18,
  queryRadius: 0.42,
} as const;

export const ARGYPH_COLORS = {
  reef: 0x7183ac,
  sweep: 0xd8deff,
  symbol: 0xacb8ff,
  link: 0x8393d8,
  query: 0xe6d6b5,
} as const;

/** Deterministic reef point (golden-angle disc with terrain-like relief). */
export function reefPoint(
  pointIndex: number,
  out: [number, number, number],
): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radius = Math.sqrt((pointIndex + 0.5) / ARGYPH_COUNTS.reefPoints);
  const theta = goldenAngle * pointIndex + 0.7;
  const relief = Math.sin(pointIndex * 1.7) * 0.5 + Math.sin(pointIndex * 0.31) * 0.5;
  out[0] = Math.cos(theta) * radius * ARGYPH_STAGE.reefRadiusX;
  out[1] = Math.sin(theta) * radius * ARGYPH_STAGE.reefRadiusY + relief * 0.09;
  out[2] = Math.sin(pointIndex * 2.9) * 0.1;
  return out;
}

/** Symbol node positions: an authored inner constellation on the reef. */
export function symbolPoint(
  symbolIndex: number,
  out: [number, number, number],
): [number, number, number] {
  const ring = symbolIndex % 3;
  const slot = Math.floor(symbolIndex / 3);
  const angle = slot * ((Math.PI * 2) / 7) + ring * 0.42 + 0.3;
  const radius = 0.22 + ring * 0.21;
  out[0] = Math.cos(angle) * radius * ARGYPH_STAGE.reefRadiusX;
  out[1] = Math.sin(angle) * radius * ARGYPH_STAGE.reefRadiusY + Math.sin(symbolIndex * 1.3) * 0.05;
  out[2] = 0.05 + ring * 0.03;
  return out;
}

/** Semantic links connect deterministic symbol pairs. */
export function linkPair(linkIndex: number): readonly [number, number] {
  const first = (linkIndex * 5 + 2) % ARGYPH_COUNTS.symbols;
  const second = (first + 1 + (linkIndex % 3)) % ARGYPH_COUNTS.symbols;
  return [first, second] as const;
}
