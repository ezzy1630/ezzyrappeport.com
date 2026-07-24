"use client";

export type FluidSolverPass =
  | "injectPointerSplats"
  | "applyObstacleMask"
  | "updateHeightfield"
  | "deriveNormals"
  | "composite";

export const CURRENT_HEIGHTFIELD_PIPELINE: FluidSolverPass[] = [
  "injectPointerSplats",
  "applyObstacleMask",
  "updateHeightfield",
  "deriveNormals",
  "composite",
];
