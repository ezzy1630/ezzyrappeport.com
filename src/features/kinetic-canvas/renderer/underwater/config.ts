import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.98,
  toneMapper: ACESFilmicToneMapping,
  // Sun from the upper-left; bright key, cool transmitted fill.
  // Raised key to push rim highlights toward nearly white.
  keyIntensity: 8.1,
  fillIntensity: 1.95,
  environmentIntensity: 1.05,
  // Canvas UI–derived crystalline glass: clean white core, water IOR,
  // very low roughness. Cerulean lives on shoulders, not milky faces.
  ior: 1.4,
  roughness: 0.009,
  // Selective cerulean absorption — shorter distance keeps broad faces clear.
  absorptionColor: 0xb8dff0,
  absorptionDistance: 1.05,
  // Visible water surface: readable refraction wobble without clouding copy.
  surfaceDistortion: 0.28,
  // Animated caustic fire on the sand and through the glyphs.
  causticStrength: 0.64,
  // Bright-shallows depth: deepens gradually, never muddy.
  depthAttenuation: 0.13,
} as const;

export const TONE_MAPPER_NAMES = {
  [ACESFilmicToneMapping]: "ACES filmic",
  [LinearToneMapping]: "linear",
  [ReinhardToneMapping]: "Reinhard",
} as const;

export const HERO_GLB_URL = "/assets/hero/ezzy-rappeport-glyphs.glb";
export const HERO_MANIFEST_URL = "/assets/hero/ezzy-rappeport-glyphs.json";

// Keep the high-tier desktop render target below the adaptive-scaling cliff,
// but do not crush Retina below the quality profile's own maxDpr — that is
// what made the submerged title look stair-stepped / low-res.
export const MAX_DESKTOP_RENDER_DPR = 2;

export const WATER_PLATE_URLS = {
  shallowLandscape: "/assets/water/shallow-desktop-v1.webp",
  shallowPortrait: "/assets/water/shallow-portrait-v1.webp",
  midDepth: "/assets/water/mid-depth-v1.webp",
  deepBasin: "/assets/water/deep-basin-v1.webp",
} as const;
