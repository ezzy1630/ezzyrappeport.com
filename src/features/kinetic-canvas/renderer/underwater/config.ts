import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.94,
  toneMapper: ACESFilmicToneMapping,
  keyIntensity: 3.1,
  fillIntensity: 1.35,
  environmentIntensity: 0.78,
  ior: 1.385,
  roughness: 0.095,
  absorptionColor: 0x8eabb9,
  absorptionDistance: 0.56,
  surfaceDistortion: 0.0032,
  causticStrength: 0.055,
  depthAttenuation: 0.14,
} as const;

export const TONE_MAPPER_NAMES = {
  [ACESFilmicToneMapping]: "ACES filmic",
  [LinearToneMapping]: "linear",
  [ReinhardToneMapping]: "Reinhard",
} as const;

export const HERO_GLB_URL = "/assets/hero/ezzy-rappeport-glyphs.glb";
export const HERO_MANIFEST_URL = "/assets/hero/ezzy-rappeport-glyphs.json";
