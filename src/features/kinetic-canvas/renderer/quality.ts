"use client";

import { portfolioIdentity } from "@/lib/portfolio/identity";

export const TARGET_FPS = 45;
export const RIPPLE_COUNT = 8;
export const FLUID_TEXTURE_SRC = "/assets/pearl-liquid-background.webp";
export const FLUID_TEXTURE_FALLBACK_SRC = "/assets/pearl-liquid-background.png";
export const [HERO_LINE_1, HERO_LINE_2] = portfolioIdentity.titleLines;

export type KineticQualityTier = "high" | "balanced" | "low" | "static";

export type KineticQuality = {
  tier: KineticQualityTier;
  dpr: number;
  maxDpr: number;
  targetFps: number;
  simWidth: number;
  textMaxDim: number;
  pressureIterations: number;
  activeRipples: number;
  startDelayMs: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  lowPower: boolean;
  renderScale: number;
};

function getConnectionSaveData() {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return Boolean(nav.connection?.saveData || nav.connection?.effectiveType === "2g");
}

function getDeviceMemory() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory ?? 8;
}

export function resolveKineticQuality(
  reducedMotionOverride?: boolean,
  staticModeOverride?: boolean,
): KineticQuality {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion =
    Boolean(reducedMotionOverride) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = getConnectionSaveData();
  const memory = getDeviceMemory();
  const cores = navigator.hardwareConcurrency ?? 8;
  const lowPower = saveData || memory <= 4 || cores <= 4;

  let tier: KineticQualityTier = "balanced";
  if (reducedMotion || staticModeOverride || saveData) {
    tier = "static";
  } else if (coarsePointer || lowPower) {
    tier = "low";
  } else if (
    !coarsePointer &&
    memory >= 8 &&
    cores >= 8 &&
    window.innerWidth >= 1024
  ) {
    tier = "high";
  }

  const profiles: Record<KineticQualityTier, Omit<KineticQuality, "coarsePointer" | "reducedMotion" | "saveData" | "lowPower">> = {
    high: {
      tier: "high",
      dpr: Math.min(window.devicePixelRatio || 1, 1.75),
      maxDpr: 1.75,
      targetFps: 45,
      simWidth: 256,
      textMaxDim: 1800,
      pressureIterations: 0,
      activeRipples: 8,
      startDelayMs: 45,
      renderScale: 1,
    },
    balanced: {
      tier: "balanced",
      dpr: Math.min(window.devicePixelRatio || 1, 1.25),
      maxDpr: 1.25,
      targetFps: 30,
      simWidth: 192,
      textMaxDim: 1536,
      pressureIterations: 0,
      activeRipples: 6,
      startDelayMs: 70,
      renderScale: 0.9,
    },
    low: {
      tier: "low",
      dpr: Math.min(window.devicePixelRatio || 1, 1),
      maxDpr: 1,
      targetFps: 24,
      simWidth: 128,
      textMaxDim: 1024,
      pressureIterations: 0,
      activeRipples: 4,
      startDelayMs: 110,
      renderScale: 0.8,
    },
    static: {
      tier: "static",
      dpr: 1,
      maxDpr: 1,
      targetFps: 0,
      simWidth: 0,
      textMaxDim: 0,
      pressureIterations: 0,
      activeRipples: 0,
      startDelayMs: 0,
      renderScale: 0,
    },
  };

  return {
    ...profiles[tier],
    coarsePointer,
    reducedMotion,
    saveData,
    lowPower,
  };
}
