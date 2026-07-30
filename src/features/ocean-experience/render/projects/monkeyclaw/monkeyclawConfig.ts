/**
 * MonkeyClaw encounter — authored constants (plan §10.2).
 *
 * The scene communicates target → red → judge → repro → blue → purple:
 * coverage selects one of 18 attack-surface zones; red generates and executes
 * an attack; tiered judging promotes evidence into replay/minimization; blue
 * proposes a patch and runs 8 verifier gates; purple requires both prevention
 * and observability, then routes the detection gap into the next red cycle.
 */

/** Chapter-progress loop windows. Primary state is a pure function of these. */
export const MONKEYCLAW_LOOP = {
  targetStart: 0,
  targetFull: 0.15,
  redStart: 0.1,
  redFull: 0.3,
  judgeStart: 0.25,
  judgeFull: 0.46,
  reproStart: 0.41,
  reproFull: 0.62,
  blueStart: 0.57,
  blueFull: 0.78,
  purpleStart: 0.73,
  purpleFull: 0.92,
} as const;

export const MONKEYCLAW_COUNTS = {
  /** The public registry's 18 attack-surface zones. */
  vectors: 18,
  /** Three confirmed criticals shown by the checked-in demo cycle. */
  confirmedFindings: 3,
  /** Independent blue-team patch-verifier stages. */
  verifierGates: 8,
  /** Evidence streams emitted after the verifier completes. */
  telemetryRails: 8,
  /** Concurrent probe pulses (pointer signature). */
  probePool: 3,
} as const;

/** Stage-local composition (camera-locked; +x right, +y up, +z to camera). */
export const MONKEYCLAW_STAGE = {
  distance: 4.35,
  /** Core center: left field so DOM copy owns the calm right region. */
  coreDesktop: [-1.04, -0.02, 0] as const,
  /** Mobile: upper field, copy below — vertical poster composition. */
  coreMobile: [0, 1.15, 0] as const,
  coreRadius: 0.38,
  cageRadius: 0.5,
  judgeRadius: 0.68,
  perimeterRadius: 1.08,
  spawnRadiusMin: 1.6,
  spawnRadiusMax: 2.3,
  telemetryLength: 0.92,
} as const;

export const MONKEYCLAW_COLORS = {
  hostile: 0xe2604a,
  hostileDim: 0x8f4a40,
  judge: 0xcdeef6,
  repro: 0xd18a1d,
  blue: 0x4f9eff,
  purple: 0x8f86f2,
  telemetry: 0x5cd4e6,
  core: 0xd9edf5,
  cage: 0x9fc8d8,
} as const;

/** Deterministic demo outcome: three attack paths become confirmed findings. */
export function vectorBecomesFinding(vectorIndex: number): boolean {
  return vectorIndex >= MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.confirmedFindings;
}

/** Confirmed-finding rank for the demo path, else -1. */
export function findingRankForVector(vectorIndex: number): number {
  if (!vectorBecomesFinding(vectorIndex)) return -1;
  return vectorIndex - (MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.confirmedFindings);
}

/** Golden-angle sphere direction, deterministic by index. */
export function vectorSpawnDirection(
  vectorIndex: number,
  out: [number, number, number],
): [number, number, number] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (vectorIndex / Math.max(MONKEYCLAW_COUNTS.vectors - 1, 1)) * 2;
  const radius = Math.sqrt(Math.max(1 - y * y, 0));
  const theta = goldenAngle * vectorIndex + 0.6;
  out[0] = Math.cos(theta) * radius;
  out[1] = Math.sin(theta) * radius * 0.72;
  out[2] = y * 0.55;
  return out;
}

/** Per-vector loop timing: staggered approach inside the red window. */
const VECTOR_TIMINGS = Array.from({ length: MONKEYCLAW_COUNTS.vectors }, (_, vectorIndex) => {
  const rank = vectorIndex / MONKEYCLAW_COUNTS.vectors;
  const finding = vectorBecomesFinding(vectorIndex);
  const startT = MONKEYCLAW_LOOP.redStart + rank * 0.11;
  return {
    startT,
    arriveT: startT + 0.12 + (vectorIndex % 3) * 0.012,
    judgeT: finding ? MONKEYCLAW_LOOP.judgeStart + 0.11
      + findingRankForVector(vectorIndex) * 0.04 : 1,
  };
});

/** Hot-path safe: precomputed timing table, no per-frame allocation. */
export function vectorTiming(vectorIndex: number): {
  startT: number;
  arriveT: number;
  judgeT: number;
} {
  return VECTOR_TIMINGS[vectorIndex];
}
