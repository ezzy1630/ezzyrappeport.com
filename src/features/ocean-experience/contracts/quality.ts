/**
 * Quality tier contract for ExperienceFrame and adaptive controllers.
 */

export type QualityTier = "high" | "balanced" | "low" | "static";

export type ResolvedQuality = {
  tier: QualityTier;
  /** User preference ceiling/floor context. */
  preference: "auto" | "high" | "balanced" | "low";
  dpr: number;
  maxDpr: number;
  renderScale: number;
  targetFps: number;
};

export const DEFAULT_RESOLVED_QUALITY: ResolvedQuality = {
  tier: "balanced",
  preference: "auto",
  dpr: 1,
  maxDpr: 2,
  renderScale: 1,
  targetFps: 60,
};

export function isQualityTier(value: unknown): value is QualityTier {
  return (
    value === "high"
    || value === "balanced"
    || value === "low"
    || value === "static"
  );
}
