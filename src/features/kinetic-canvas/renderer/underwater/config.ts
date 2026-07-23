import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.9,
  toneMapper: ACESFilmicToneMapping,
  // Sun from the upper-left; bright key, cool transmitted fill.
  keyIntensity: 5.6,
  fillIntensity: 1.7,
  environmentIntensity: 0.9,
  // Physical glass: high transmission, very low roughness, water IOR. The
  // reference letters have crisp crystalline cores, not milk.
  ior: 1.4,
  roughness: 0.028,
  // Pale cerulean attenuation through the letterform depth. A longer
  // absorption distance keeps broad faces optically clear.
  absorptionColor: 0xb5e0ee,
  absorptionDistance: 1.55,
  // Visible water surface: restrained refraction wobble.
  surfaceDistortion: 0.34,
  // Animated caustic fire on the sand and through the glyphs.
  causticStrength: 0.5,
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

export const WATER_PLATE_URLS = {
  shallowLandscape: "/assets/water/shallow-desktop-v1.webp",
  shallowPortrait: "/assets/water/shallow-portrait-v1.webp",
  midDepth: "/assets/water/mid-depth-v1.webp",
  deepBasin: "/assets/water/deep-basin-v1.webp",
} as const;
