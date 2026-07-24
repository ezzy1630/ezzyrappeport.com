/**
 * Look-dev material / lighting knobs for the underwater hero.
 * Asset URLs and exposure helpers live in assetUrls.ts (no three.js).
 */

export {
  EXPOSURE_BY_DEPTH,
  HERO_GLB_URL,
  HERO_MANIFEST_URL,
  MAX_DESKTOP_RENDER_DPR,
  WATER_PLATE_URLS,
  exposureForDepth,
} from "./assetUrls";

export const UNDERWATER_DEBUG = {
  // Surface stays bright and dimensional without blowing the glass name white.
  exposure: 0.9,
  // Sun from the upper-left; bright key, cool transmitted fill.
  keyIntensity: 7.4,
  fillIntensity: 1.9,
  environmentIntensity: 1.0,
  // Canvas UI-derived crystalline glass: clean white core, water IOR,
  // very low roughness. Cerulean lives on shoulders, not milky faces.
  ior: 1.4,
  roughness: 0.009,
  // Deeper cerulean absorption so glyph bodies carry readable mass
  // against near-white shallow water.
  absorptionColor: 0x7ec8e8,
  absorptionDistance: 0.82,
  // Soft optical wobble — enough to read as water, not jelly smear on glyphs.
  surfaceDistortion: 0.095,
  // Animated caustic fire on the sand and through the glyphs.
  causticStrength: 0.62,
  // Bright-shallows depth: deepens gradually, never muddy.
  depthAttenuation: 0.14,
} as const;
