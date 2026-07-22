import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.88,
  toneMapper: ACESFilmicToneMapping,
  // Sun from the upper-left; bright key, cool transmitted fill.
  keyIntensity: 5.2,
  fillIntensity: 1.7,
  environmentIntensity: 0.9,
  // Physical glass: high transmission, low roughness, water IOR.
  ior: 1.4,
  roughness: 0.06,
  // Pale cerulean attenuation through the letterform depth.
  absorptionColor: 0x9fd2e4,
  absorptionDistance: 1.05,
  // Visible water surface: restrained refraction wobble.
  surfaceDistortion: 0.016,
  // Animated caustic fire on the sand and through the glyphs.
  causticStrength: 0.28,
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
