import { ACESFilmicToneMapping, LinearToneMapping, ReinhardToneMapping } from "three";

export const UNDERWATER_DEBUG = {
  exposure: 0.96,
  toneMapper: ACESFilmicToneMapping,
  keyIntensity: 3.8,
  fillIntensity: 1.1,
  environmentIntensity: 0.58,
  ior: 1.405,
  roughness: 0.072,
  absorptionColor: 0x91a9b7,
  absorptionDistance: 1.08,
  surfaceDistortion: 0.0105,
  causticStrength: 0.18,
  depthAttenuation: 0.18,
} as const;

export const TONE_MAPPER_NAMES = {
  [ACESFilmicToneMapping]: "ACES filmic",
  [LinearToneMapping]: "linear",
  [ReinhardToneMapping]: "Reinhard",
} as const;

export const HERO_GLB_URL = "/assets/hero/ezzy-rappeport-glyphs.glb";
export const HERO_MANIFEST_URL = "/assets/hero/ezzy-rappeport-glyphs.json";
