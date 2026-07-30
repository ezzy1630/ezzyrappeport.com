/**
 * MonkeyClaw encounter — authored constants (plan §10.2).
 *
 * The scene communicates attack → judge → reproduce → patch → detection:
 * 18 faint attack vectors (the 18 seeded attack zones) approach through the
 * surrounding water; a sandbox perimeter deflects most; 8 reach the judge
 * layer and light the 8 verifier gates; verified detections return as
 * telemetry rails that align into Etch's clean verification geometry.
 */

/** Chapter-progress loop windows. Primary state is a pure function of these. */
export const MONKEYCLAW_LOOP = {
  wakeStart: 0,
  wakeFull: 0.12,
  redStart: 0.08,
  redFull: 0.26,
  containStart: 0.22,
  containFull: 0.42,
  judgeStart: 0.38,
  judgeFull: 0.58,
  blueStart: 0.54,
  blueFull: 0.72,
  purpleStart: 0.68,
  purpleFull: 0.86,
} as const;

export const MONKEYCLAW_COUNTS = {
  /** 18 seeded attack zones (content.ts fact). */
  vectors: 18,
  /** Vectors that reach the judge layer == the 8 verifier gates. */
  judged: 8,
  /** Verified detections that return as telemetry rails. */
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
  coreMobile: [0, 0.62, 0] as const,
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
  blue: 0x4f9eff,
  purple: 0x8f86f2,
  telemetry: 0x5cd4e6,
  core: 0xd9edf5,
  cage: 0x9fc8d8,
} as const;

/** Deterministic per-vector outcome: index < 10 deflect at the perimeter. */
export function vectorReachesJudge(vectorIndex: number): boolean {
  return vectorIndex >= MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.judged;
}

/** Verified detections among judged vectors → telemetry rail rank, else -1. */
export function telemetryRankForVector(vectorIndex: number): number {
  if (!vectorReachesJudge(vectorIndex)) return -1;
  return vectorIndex - (MONKEYCLAW_COUNTS.vectors - MONKEYCLAW_COUNTS.judged);
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
  const judged = vectorReachesJudge(vectorIndex);
  const startT = MONKEYCLAW_LOOP.redStart + rank * 0.16;
  return {
    startT,
    arriveT: startT + 0.15 + (vectorIndex % 3) * 0.012,
    judgeT: judged ? MONKEYCLAW_LOOP.judgeStart + 0.05
      + telemetryRankForVector(vectorIndex) * 0.028 : 1,
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
