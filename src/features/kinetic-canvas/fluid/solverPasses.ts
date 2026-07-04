"use client";

export type FluidSolverPass =
  | "injectPointerSplats"
  | "advectVelocity"
  | "advectDye"
  | "computeCurl"
  | "vorticityConfinement"
  | "computeDivergence"
  | "solvePressure"
  | "subtractPressureGradient"
  | "applyObstacleMask"
  | "updateHeightfield"
  | "deriveNormals"
  | "composite";

export const FUTURE_NAVIER_STOKES_PIPELINE: FluidSolverPass[] = [
  "injectPointerSplats",
  "advectVelocity",
  "advectDye",
  "computeCurl",
  "vorticityConfinement",
  "computeDivergence",
  "solvePressure",
  "subtractPressureGradient",
  "applyObstacleMask",
  "updateHeightfield",
  "deriveNormals",
  "composite",
];

export const CURRENT_HEIGHTFIELD_PIPELINE: FluidSolverPass[] = [
  "injectPointerSplats",
  "applyObstacleMask",
  "updateHeightfield",
  "deriveNormals",
  "composite",
];
