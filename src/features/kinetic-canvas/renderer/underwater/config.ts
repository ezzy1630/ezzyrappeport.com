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
  keyIntensity: 7.55,
  fillIntensity: 1.95,
  environmentIntensity: 1.0,
  // Outside medium is water (~1.333). Glyph IOR sits in a pale acrylic/glass
  // family; relative bending is subtler than air/glass chrome.
  mediumIor: 1.333,
  ior: 1.492,
  roughness: 0.009,
  // Deeper cerulean absorption so glyph bodies carry readable mass
  // against near-white shallow water.
  absorptionColor: 0x7ec8e8,
  absorptionDistance: 0.82,
  // Soft optical wobble — enough to read as water, not jelly smear on glyphs.
  surfaceDistortion: 0.09,
  // Surface-coupled caustic fire on the sand and through the glyphs.
  causticStrength: 0.66,
  // Bright-shallows depth: deepens gradually, never muddy.
  depthAttenuation: 0.135,
} as const;
