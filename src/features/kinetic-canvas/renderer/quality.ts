"use client";

export const TARGET_FPS = 60;
export const RIPPLE_COUNT = 12;
export const FLUID_TEXTURE_SRC = "/assets/pearl-liquid-background.png";
export const HERO_LINE_1 = "ELIEZER";
export const HERO_LINE_2 = "RAPPEPORT";
export const TEXT_MAX_DIM = 2048;

const DESKTOP_MAX_DPR = 1.5;
const MOBILE_MAX_DPR = 1.0;

export type KineticQuality = {
  dpr: number;
  maxDpr: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
};

export function resolveKineticQuality(): KineticQuality {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const maxDpr = coarsePointer || reducedMotion ? MOBILE_MAX_DPR : DESKTOP_MAX_DPR;

  return {
    dpr: Math.min(window.devicePixelRatio || 1, maxDpr),
    maxDpr,
    coarsePointer,
    reducedMotion,
  };
}
