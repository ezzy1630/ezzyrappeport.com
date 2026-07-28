/**
 * Etch encounter — authored constants (plan §10.3).
 *
 * Pressure-forged verification path: natural-language intent begins as an
 * unstable pressure volume; typed constraints crystallize its boundary;
 * candidate structures form and pass through simulation/formal light planes;
 * only the evidence-backed result remains. The physical-signoff gate stays
 * visibly pending — no false completion (content.ts: "signoff pending").
 */

export const ETCH_LOOP = {
  intentStart: 0.02,
  intentFull: 0.2,
  constraintsStart: 0.18,
  constraintsFull: 0.38,
  candidatesStart: 0.36,
  candidatesFull: 0.55,
  gatesStart: 0.52,
  gatesFull: 0.85,
  relaxStart: 0.82,
  relaxFull: 0.97,
} as const;

export const ETCH_COUNTS = {
  /** Typed constraint planes that crystallize the intent volume. */
  constraintPlanes: 3,
  /** Candidate structures formed from the crystallized boundary. */
  candidates: 3,
  /** Verification gates (4th = physical signoff, visibly pending). */
  gates: 4,
  /** Soft linked paths relaxing toward FlowE. */
  relaxPaths: 5,
  /** Concurrent probe perturbations. */
  probePool: 2,
} as const;

/** Gate identity from content.ts proof line. */
export const ETCH_GATES = [
  { id: "fifo", label: "Saved FIFO run", passed: true },
  { id: "sim", label: "Simulation pass", passed: true },
  { id: "formal", label: "Bounded-formal pass", passed: true },
  { id: "signoff", label: "Physical signoff", passed: false },
] as const;

/** Stage-local composition (camera-locked; +x right, +y up, +z to camera). */
export const ETCH_STAGE = {
  distance: 4.35,
  /** Verification ladder axis: enters left, inspected toward center-right. */
  axisDesktop: { x0: -1.75, x1: 1.05, y: -0.08 } as const,
  axisMobile: { x0: -0.9, x1: 0.9, y: 0.62 } as const,
  intentRadius: 0.3,
  candidateSize: 0.17,
  gateWidth: 0.028,
  gateHeight: 0.62,
  gateSpacing: 0.46,
  relaxLength: 0.85,
} as const;

export const ETCH_COLORS = {
  intent: 0xe8a37a,
  constraint: 0xbfe4f2,
  candidate: 0xd9ecf6,
  pass: 0x6fd8c8,
  pending: 0x8ea6b8,
  result: 0x7fd0e8,
  relax: 0x9fd8e2,
} as const;

/**
 * Candidate ladder outcome: which gate stops each candidate (3 = clears all
 * available gates). Candidate 0 fails at simulation, candidate 1 at
 * bounded-formal, candidate 2 clears every available gate (signoff pending).
 */
const CANDIDATE_CLEARANCE: readonly number[] = [1, 2, 3];

export function candidateClearance(candidateIndex: number): number {
  return CANDIDATE_CLEARANCE[candidateIndex] ?? 0;
}

/** Per-station x position along the verification ladder. */
export function gateStationX(gateIndex: number, x0: number, spacing: number): number {
  return x0 + 0.62 + gateIndex * spacing;
}
