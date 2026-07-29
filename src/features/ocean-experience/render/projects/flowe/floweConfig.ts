/**
 * FlowE encounter — authored constants (plan §10.4).
 *
 * Luminous planning current: loose obligations arrive as drifting luminous
 * fragments; a course-aware current groups them into a structured plan,
 * then narrows into one focused stream. Secondary particles settle as
 * organization increases. The stream contracts into a local index field —
 * the Argyph sonar hint.
 */

export const FLOWE_LOOP = {
  driftStart: 0.02,
  driftFull: 0.3,
  groupStart: 0.28,
  groupFull: 0.62,
  focusStart: 0.6,
  focusFull: 0.88,
  contractStart: 0.85,
  contractFull: 0.97,
} as const;

export const FLOWE_COUNTS = {
  /** Loose obligation fragments. */
  fragments: 26,
  /** Plan clusters along the current (structured plan columns). */
  clusters: 4,
  /** Fine ambient motes that settle as organization increases. */
  motes: 90,
  /** Points in the contracted index field (Argyph sonar hint). */
  indexPoints: 12,
  /** Concurrent probe nudges. */
  probePool: 3,
} as const;

/** Stage-local composition (camera-locked; +x right, +y up, +z to camera). */
export const FLOWE_STAGE = {
  distance: 4.4,
  /** Current band center: left field, generous negative space. */
  currentDesktop: [-0.85, 0.02, 0] as const,
  currentMobile: [0, 0.6, 0] as const,
  driftRadiusX: 1.35,
  driftRadiusY: 0.75,
  clusterSpacing: 0.3,
  focusRadius: 0.4,
  streamLength: 1.3,
} as const;

export const FLOWE_COLORS = {
  body: 0x102d38,
  fragment: 0xaee6f0,
  fragmentWarm: 0xf2e2b8,
  current: 0x8fd4e2,
  focus: 0xd8f2f8,
  mote: 0x9fc8d4,
  index: 0xbfe8f0,
} as const;

/** Deterministic fragment drift anchor (golden-angle disc, seeded wobble). */
export function fragmentDriftAnchor(
  fragmentIndex: number,
  out: [number, number, number],
): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radius = Math.sqrt((fragmentIndex + 0.5) / FLOWE_COUNTS.fragments);
  const theta = goldenAngle * fragmentIndex + 1.1;
  out[0] = Math.cos(theta) * radius * FLOWE_STAGE.driftRadiusX;
  out[1] = Math.sin(theta) * radius * FLOWE_STAGE.driftRadiusY;
  out[2] = Math.sin(fragmentIndex * 2.3) * 0.22;
  return out;
}

/** Cluster assignment is stable per fragment — plans do not reshuffle. */
export function clusterForFragment(fragmentIndex: number): number {
  return fragmentIndex % FLOWE_COUNTS.clusters;
}

/** Deterministic mote seed position in the clearing volume. */
export function moteSeed(moteIndex: number, out: [number, number, number]): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radius = Math.sqrt((moteIndex + 0.5) / FLOWE_COUNTS.motes);
  const theta = goldenAngle * moteIndex * 1.7;
  out[0] = Math.cos(theta) * radius * 1.7;
  out[1] = Math.sin(theta) * radius * 0.95;
  out[2] = Math.sin(moteIndex * 3.1) * 0.3;
  return out;
}
