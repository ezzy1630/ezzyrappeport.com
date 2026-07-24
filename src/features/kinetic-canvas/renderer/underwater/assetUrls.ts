/**
 * Dependency-free hero asset URLs and numeric render constants.
 * Kept free of three.js so the KineticCanvas shell can warm the GLB
 * without pulling the WebGL chunk into the initial graph.
 */

export const HERO_GLB_URL = "/assets/hero/ezzy-rappeport-glyphs.glb";
export const HERO_MANIFEST_URL = "/assets/hero/ezzy-rappeport-glyphs.json";

/** Cap desktop DPR for clean glyph silhouettes; adaptive scale recovers. */
export const MAX_DESKTOP_RENDER_DPR = 2;

export const WATER_PLATE_URLS = {
  shallowLandscape: "/assets/water/shallow-desktop-v1.webp",
  shallowPortrait: "/assets/water/shallow-portrait-v1.webp",
  midDepth: "/assets/water/mid-depth-v1.webp",
  deepBasin: "/assets/water/deep-basin-v1.webp",
} as const;

/** Authored exposure multipliers keyed by world-depth bands. */
export const EXPOSURE_BY_DEPTH = {
  surface: 1.0,
  shallow: 0.94,
  mid: 0.86,
  deep: 0.78,
} as const;

/** Map continuous world depth to an authored exposure scale. */
export function exposureForDepth(worldDepth: number): number {
  if (worldDepth < 0.18) return EXPOSURE_BY_DEPTH.surface;
  if (worldDepth < 0.48) {
    const t = (worldDepth - 0.18) / 0.3;
    return EXPOSURE_BY_DEPTH.surface + (EXPOSURE_BY_DEPTH.shallow - EXPOSURE_BY_DEPTH.surface) * t;
  }
  if (worldDepth < 0.72) {
    const t = (worldDepth - 0.48) / 0.24;
    return EXPOSURE_BY_DEPTH.shallow + (EXPOSURE_BY_DEPTH.mid - EXPOSURE_BY_DEPTH.shallow) * t;
  }
  const t = Math.min(1, (worldDepth - 0.72) / 0.28);
  return EXPOSURE_BY_DEPTH.mid + (EXPOSURE_BY_DEPTH.deep - EXPOSURE_BY_DEPTH.mid) * t;
}
