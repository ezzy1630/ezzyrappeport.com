"use client";

import { portfolioIdentity } from "@/lib/portfolio/identity";
import {
  pixelBudgetedDpr,
  QUALITY_PIXEL_BUDGETS,
  resolveQualityTier,
  TARGET_FPS_BY_TIER,
  type KineticQualityTier,
} from "./quality-policy";

export const [HERO_LINE_1, HERO_LINE_2] = portfolioIdentity.titleLines;

export { TARGET_FPS } from "./quality-policy";
export type { KineticQualityTier } from "./quality-policy";

export type KineticQuality = {
  tier: KineticQualityTier;
  dpr: number;
  maxDpr: number;
  targetFps: number;
  simWidth: number;
  textMaxDim: number;
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
  const anyFinePointer = window.matchMedia("(any-pointer: fine)").matches;
  const reducedMotion =
    Boolean(reducedMotionOverride) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = getConnectionSaveData();
  const memory = getDeviceMemory();
  const cores = navigator.hardwareConcurrency ?? 8;
  const lowPower = saveData || memory <= 2;
  const tier = resolveQualityTier({
    coarsePointer,
    anyFinePointer,
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
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 2, QUALITY_PIXEL_BUDGETS.high),
      maxDpr: 2,
      targetFps: TARGET_FPS_BY_TIER.high,
      simWidth: 256,
      textMaxDim: 1800,
      startDelayMs: 45,
      // Full render scale on high; adaptive downgrade still owns recovery.
      renderScale: 1.0,
      pixelBudget: QUALITY_PIXEL_BUDGETS.high,
    },
    balanced: {
      tier: "balanced",
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 1.5, QUALITY_PIXEL_BUDGETS.balanced),
      maxDpr: 1.5,
      targetFps: TARGET_FPS_BY_TIER.balanced,
      simWidth: 160,
      textMaxDim: 1400,
      startDelayMs: 70,
      // Half-res-ish presentation headroom; adaptive scale still recovers further.
      renderScale: 0.85,
      pixelBudget: QUALITY_PIXEL_BUDGETS.balanced,
    },
    low: {
      // Live phone water: readable heightfield at a 45fps target, not a poster.
      tier: "low",
      dpr: pixelBudgetedDpr(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, 1.35, QUALITY_PIXEL_BUDGETS.low),
      maxDpr: 1.35,
      targetFps: TARGET_FPS_BY_TIER.low,
      simWidth: 112,
      textMaxDim: 1024,
      startDelayMs: 70,
      renderScale: 0.88,
      pixelBudget: QUALITY_PIXEL_BUDGETS.low,
    },
    static: {
      tier: "static",
      dpr: 1,
      maxDpr: 1,
      targetFps: 0,
      simWidth: 0,
      textMaxDim: 0,
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
