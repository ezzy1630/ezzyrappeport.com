"use client";

import { portfolioIdentity } from "@/lib/portfolio/identity";
import {
  pixelBudgetedDpr,
  QUALITY_PIXEL_BUDGETS,
  resolveQualityTier,
  TARGET_FPS_BY_TIER,
  type KineticQualityTier,
} from "./quality-policy";

export const RIPPLE_COUNT = 8;
export const FLUID_TEXTURE_SRC = "/assets/pearl-liquid-background.webp";
export const FLUID_TEXTURE_FALLBACK_SRC = "/assets/pearl-liquid-background.png";
export const [HERO_LINE_1, HERO_LINE_2] = portfolioIdentity.titleLines;

export { TARGET_FPS } from "./quality-policy";
export type { KineticQualityTier } from "./quality-policy";

export type KineticQuality = {
  tier: KineticQualityTier;
  dpr: number;
  maxDpr: number;
  targetFps: number;
  simWidth: number;
  pressureIterations: number;
  activeRipples: number;
  startDelayMs: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  lowPower: boolean;
  renderScale: number;
  pixelBudget: number;
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
  const lowPower = saveData || memory <= 2;
  const tier = resolveQualityTier({
    coarsePointer,
    saveData,
    deviceMemory: memory,
    hardwareConcurrency: cores,
    viewportWidth: window.innerWidth,
    reducedMotion,
    staticMode: staticModeOverride,
  });

  const profiles: Record<KineticQualityTier, Omit<KineticQuality, "coarsePointer" | "reducedMotion" | "saveData" | "lowPower">> = {
    high: {
      tier: "high",
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 1.75, QUALITY_PIXEL_BUDGETS.high),
      maxDpr: 1.75,
      targetFps: TARGET_FPS_BY_TIER.high,
      simWidth: 288,
      pressureIterations: 0,
      activeRipples: 8,
      startDelayMs: 45,
      renderScale: 1,
      pixelBudget: QUALITY_PIXEL_BUDGETS.high,
    },
    balanced: {
      tier: "balanced",
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 1.25, QUALITY_PIXEL_BUDGETS.balanced),
      maxDpr: 1.25,
      targetFps: TARGET_FPS_BY_TIER.balanced,
      simWidth: 224,
      pressureIterations: 0,
      activeRipples: 6,
      startDelayMs: 70,
      renderScale: 0.9,
      pixelBudget: QUALITY_PIXEL_BUDGETS.balanced,
    },
    low: {
      tier: "low",
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 1, QUALITY_PIXEL_BUDGETS.low),
      maxDpr: 1,
      targetFps: TARGET_FPS_BY_TIER.low,
      simWidth: 128,
      pressureIterations: 0,
      activeRipples: 4,
      startDelayMs: 110,
      renderScale: 0.8,
      pixelBudget: QUALITY_PIXEL_BUDGETS.low,
    },
    static: {
      tier: "static",
      dpr: 1,
      maxDpr: 1,
      targetFps: 0,
      simWidth: 0,
      pressureIterations: 0,
      activeRipples: 0,
      startDelayMs: 0,
      renderScale: 0,
      pixelBudget: 0,
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
