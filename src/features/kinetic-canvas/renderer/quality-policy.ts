export type KineticQualityTier = "high" | "balanced" | "low" | "static";

export const TARGET_FPS = 45;
export const TARGET_FPS_BY_TIER: Record<KineticQualityTier, number> = {
  high: TARGET_FPS,
  balanced: 30,
  low: 24,
  static: 0,
};

export const QUALITY_PIXEL_BUDGETS: Record<Exclude<KineticQualityTier, "static">, number> = {
  high: 4_500_000,
  balanced: 2_750_000,
  low: 1_500_000,
};

export type QualitySignals = {
  coarsePointer: boolean;
  saveData: boolean;
  deviceMemory: number;
  hardwareConcurrency: number;
  viewportWidth: number;
  reducedMotion?: boolean;
  staticMode?: boolean;
};

export function resolveQualityTier({
  coarsePointer,
  saveData,
  deviceMemory,
  hardwareConcurrency,
  viewportWidth,
  reducedMotion = false,
  staticMode = false,
}: QualitySignals): KineticQualityTier {
  if (reducedMotion || staticMode || saveData) return "static";
  if (coarsePointer || deviceMemory <= 2) return "low";

  const hasDesktopHeadroom = deviceMemory >= 8 || hardwareConcurrency >= 8;
  if (!coarsePointer && viewportWidth >= 1024 && hasDesktopHeadroom) return "high";
  return "balanced";
}

export function downgradeQualityTier(tier: KineticQualityTier): KineticQualityTier {
  if (tier === "high") return "balanced";
  if (tier === "balanced") return "low";
  return tier;
}

export function pixelBudgetedDpr(
  width: number,
  height: number,
  requestedDpr: number,
  maxDpr: number,
  pixelBudget: number,
) {
  const cssPixels = Math.max(1, width) * Math.max(1, height);
  const budgetDpr = Math.sqrt(Math.max(1, pixelBudget) / cssPixels);
  return Math.max(1, Math.min(requestedDpr || 1, maxDpr, budgetDpr));
}
