import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.96,
  toneMapper: ACESFilmicToneMapping,
  // Sun from the upper-left; bright key, cool transmitted fill.
  // Raised key to push rim highlights toward nearly white.
  keyIntensity: 7.6,
  fillIntensity: 1.85,
  environmentIntensity: 0.98,
  // Canvas UI–derived crystalline glass: clean white core, water IOR,
  // very low roughness. Cerulean lives on shoulders, not milky faces.
  ior: 1.42,
  roughness: 0.011,
  // Selective cerulean absorption — shorter distance keeps broad faces clear.
  absorptionColor: 0xb8dff0,
  absorptionDistance: 1.15,
  // Visible water surface: restrained refraction wobble — large cloudy
  // deformation behind copy is owned by calm reading pockets, not this.
  surfaceDistortion: 0.22,
  // Animated caustic fire on the sand and through the glyphs.
  causticStrength: 0.58,
  // Bright-shallows depth: deepens gradually, never muddy.
  depthAttenuation: 0.14,
} as const;

export const TONE_MAPPER_NAMES = {
  [ACESFilmicToneMapping]: "ACES filmic",
  [LinearToneMapping]: "linear",
  [ReinhardToneMapping]: "Reinhard",
} as const;

export const HERO_GLB_URL = "/assets/hero/ezzy-rappeport-glyphs.glb";
export const HERO_MANIFEST_URL = "/assets/hero/ezzy-rappeport-glyphs.json";

// Keep the high-tier desktop render target below the adaptive-scaling cliff.
// The canvas remains DPR-aware, but a full 1.5x target at laptop dimensions
// spends the frame budget on pixels before the water simulation runs.
export const MAX_DESKTOP_RENDER_DPR = 1.25;

export const WATER_PLATE_URLS = {
  shallowLandscape: "/assets/water/shallow-desktop-v1.webp",
  shallowPortrait: "/assets/water/shallow-portrait-v1.webp",
  midDepth: "/assets/water/mid-depth-v1.webp",
  deepBasin: "/assets/water/deep-basin-v1.webp",
} as const;
