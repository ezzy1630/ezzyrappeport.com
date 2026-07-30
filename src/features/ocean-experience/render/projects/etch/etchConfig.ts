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
  intentStart: 0.01,
  intentFull: 0.16,
  constraintsStart: 0.13,
  constraintsFull: 0.31,
  candidatesStart: 0.27,
  candidatesFull: 0.4,
  simulationStart: 0.36,
  formalStart: 0.48,
  rankingStart: 0.61,
  physicalStart: 0.72,
  dossierStart: 0.76,
  gatesStart: 0.35,
  gatesFull: 0.8,
  relaxStart: 0.9,
  relaxFull: 0.99,
} as const;

export const ETCH_COUNTS = {
  /** Typed constraint planes that crystallize the intent volume. */
  constraintPlanes: 4,
  /** Candidate structures formed from the crystallized boundary. */
  candidates: 3,
  /** Verification gates (4th = physical signoff, visibly pending). */
  gates: 4,
  /** Soft linked paths relaxing toward FlowE. */
  relaxPaths: 5,
  /** Concurrent probe perturbations. */
  probePool: 2,
} as const;

/** Exact evidence stations from the saved FIFO proof dossier. */
export const ETCH_GATES = [
  { id: "sim", label: "50-cycle oracle", passed: true },
  { id: "formal", label: "BMC depth 32", passed: true },
  { id: "synth", label: "Yosys 0.66", passed: true },
  { id: "physical", label: "DRC / LVS blocked", passed: false },
] as const;

export const ETCH_CANDIDATES = [
  { id: "A", verdict: "PROVEN", metric: "486 cells · 5485.2608 µm²", color: 0x7fd0e8 },
  { id: "B", verdict: "FALSIFIED", metric: "cycle 1 · no_underflow", color: 0xd45b47 },
  { id: "C", verdict: "PROVEN", metric: "493 cells · 5606.6272 µm²", color: 0x8ea6b8 },
] as const;

/** Stage-local composition (camera-locked; +x right, +y up, +z to camera). */
export const ETCH_STAGE = {
  distance: 4.35,
  /** Verification ladder axis: enters left, inspected toward center-right. */
  axisDesktop: { x0: -1.42, x1: 1.12, y: -0.04 } as const,
  axisMobile: { x0: -0.82, x1: 0.92, y: 0.66 } as const,
  intentRadius: 0.41,
  candidateSize: 0.22,
  gateWidth: 0.028,
  gateHeight: 0.82,
  gateSpacing: 0.5,
  relaxLength: 0.85,
} as const;

export const ETCH_COLORS = {
  intent: 0xe8a37a,
  constraint: 0xbfe4f2,
  candidate: 0xd9ecf6,
  pass: 0x6fd8c8,
  pending: 0x8ea6b8,
  fail: 0xd45b47,
  runnerUp: 0x8ea6b8,
  result: 0x7fd0e8,
  dossier: 0x173942,
  relax: 0x9fd8e2,
} as const;

/**
 * Analysis reach, not verdict. Every candidate is retained through ranking so
 * the dossier can show both positive proof and the counterexample.
 */
const CANDIDATE_CLEARANCE: readonly number[] = [3, 3, 3];

export function candidateClearance(candidateIndex: number): number {
  return CANDIDATE_CLEARANCE[candidateIndex] ?? 0;
}

/** Per-station x position along the verification ladder. */
export function gateStationX(gateIndex: number, x0: number, spacing: number): number {
  return x0 + 0.62 + gateIndex * spacing;
}
