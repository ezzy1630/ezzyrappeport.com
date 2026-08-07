/**
 * Per-letter physics and optical authorship for the submerged hero glyphs.
 * Geometry may be shared across repeated characters; instance authorship is not.
 */

export const WATER_IOR = 1.333;

export type GlyphPhysicsAuthorship = Readonly<{
  density: number;
  mass: number;
  inertia: readonly [number, number, number];
  buoyancy: number;
  drag: number;
  angular_drag: number;
  flex_limit: number;
  max_travel: number;
  max_tilt_deg: number;
  max_depth: number;
  max_linear_speed: number;
  center_of_mass: readonly [number, number, number];
  collision_proxy: Readonly<{
    half_extents: readonly [number, number, number];
  }>;
}>;

export type GlyphOpticalAuthorship = Readonly<{
  ior: number;
  absorption_tint: readonly [number, number, number];
  absorption_distance: number;
  roughness: number;
  dispersion_scale: number;
  bubble_density: number;
  bubble_seed: number;
  thickness_bias: number;
  caustic_response: number;
}>;

export type GlyphAuthorship = Readonly<{
  physics: GlyphPhysicsAuthorship;
  optics: GlyphOpticalAuthorship;
}>;

type CharacterAuthorshipBase = Readonly<{
  density: number;
  massBias: number;
  buoyancy: number;
  drag: number;
  angularDrag: number;
  flexLimit: number;
  maxTravelBias: number;
  maxTiltDeg: number;
  ior: number;
  absorptionTint: readonly [number, number, number];
  absorptionDistance: number;
  roughness: number;
  dispersionScale: number;
  bubbleDensity: number;
  thicknessBias: number;
  causticResponse: number;
}>;

/** Character-family baselines inside one pale-blue submerged material family. */
const CHARACTER_BASE: Readonly<Record<string, CharacterAuthorshipBase>> = {
  E: {
    density: 1.08,
    massBias: 1.0,
    buoyancy: 0.92,
    drag: 12.8,
    angularDrag: 11.6,
    flexLimit: 0.012,
    maxTravelBias: 1.0,
    maxTiltDeg: 3.5,
    ior: 1.492,
    absorptionTint: [0.494, 0.784, 0.910],
    absorptionDistance: 0.84,
    roughness: 0.009,
    dispersionScale: 1.0,
    bubbleDensity: 0.86,
    thicknessBias: 0.0,
    causticResponse: 1.0,
  },
  Z: {
    density: 1.02,
    massBias: 0.94,
    buoyancy: 0.98,
    drag: 12.2,
    angularDrag: 11.0,
    flexLimit: 0.014,
    maxTravelBias: 1.05,
    maxTiltDeg: 3.7,
    ior: 1.486,
    absorptionTint: [0.510, 0.796, 0.918],
    absorptionDistance: 0.88,
    roughness: 0.0085,
    dispersionScale: 1.05,
    bubbleDensity: 0.78,
    thicknessBias: -0.01,
    causticResponse: 1.04,
  },
  Y: {
    density: 1.05,
    massBias: 0.98,
    buoyancy: 0.95,
    drag: 13.0,
    angularDrag: 12.2,
    flexLimit: 0.013,
    maxTravelBias: 1.08,
    maxTiltDeg: 3.8,
    ior: 1.495,
    absorptionTint: [0.478, 0.772, 0.902],
    absorptionDistance: 0.80,
    roughness: 0.0095,
    dispersionScale: 1.08,
    bubbleDensity: 0.9,
    thicknessBias: 0.015,
    causticResponse: 1.06,
  },
  R: {
    density: 1.1,
    massBias: 1.06,
    buoyancy: 0.9,
    drag: 13.4,
    angularDrag: 12.0,
    flexLimit: 0.011,
    maxTravelBias: 0.96,
    maxTiltDeg: 3.35,
    ior: 1.498,
    absorptionTint: [0.486, 0.776, 0.905],
    absorptionDistance: 0.79,
    roughness: 0.0092,
    dispersionScale: 0.96,
    bubbleDensity: 0.88,
    thicknessBias: 0.01,
    causticResponse: 0.98,
  },
  A: {
    density: 1.14,
    massBias: 1.18,
    buoyancy: 0.86,
    drag: 14.0,
    angularDrag: 12.8,
    flexLimit: 0.01,
    maxTravelBias: 0.92,
    maxTiltDeg: 3.15,
    ior: 1.505,
    absorptionTint: [0.470, 0.760, 0.895],
    absorptionDistance: 0.74,
    roughness: 0.01,
    dispersionScale: 0.92,
    bubbleDensity: 0.94,
    thicknessBias: 0.02,
    causticResponse: 0.95,
  },
  P: {
    density: 1.07,
    massBias: 1.02,
    buoyancy: 0.93,
    drag: 13.1,
    angularDrag: 11.8,
    flexLimit: 0.012,
    maxTravelBias: 0.98,
    maxTiltDeg: 3.45,
    ior: 1.49,
    absorptionTint: [0.500, 0.788, 0.912],
    absorptionDistance: 0.83,
    roughness: 0.0088,
    dispersionScale: 1.02,
    bubbleDensity: 0.84,
    thicknessBias: 0.005,
    causticResponse: 1.02,
  },
  O: {
    density: 1.12,
    massBias: 1.14,
    buoyancy: 0.88,
    drag: 13.8,
    angularDrag: 13.4,
    flexLimit: 0.009,
    maxTravelBias: 0.9,
    maxTiltDeg: 3.05,
    ior: 1.502,
    absorptionTint: [0.462, 0.752, 0.888],
    absorptionDistance: 0.72,
    roughness: 0.0098,
    dispersionScale: 0.9,
    bubbleDensity: 1.0,
    thicknessBias: 0.025,
    causticResponse: 0.93,
  },
  T: {
    density: 1.03,
    massBias: 0.96,
    buoyancy: 0.97,
    drag: 12.5,
    angularDrag: 11.2,
    flexLimit: 0.013,
    maxTravelBias: 1.04,
    maxTiltDeg: 3.6,
    ior: 1.488,
    absorptionTint: [0.508, 0.794, 0.916],
    absorptionDistance: 0.86,
    roughness: 0.0086,
    dispersionScale: 1.06,
    bubbleDensity: 0.8,
    thicknessBias: -0.005,
    causticResponse: 1.05,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function hashSeed(glyphIndex: number, identity: string) {
  let hash = 2166136261 >>> 0;
  hash ^= glyphIndex + 1;
  hash = Math.imul(hash, 16777619);
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

export function boundingVolume(
  bounds: Readonly<{ min: readonly [number, number, number]; max: readonly [number, number, number] }>,
  scale: readonly [number, number, number],
) {
  const width = Math.max(0.001, (bounds.max[0] - bounds.min[0]) * scale[0]);
  const height = Math.max(0.001, (bounds.max[1] - bounds.min[1]) * scale[1]);
  const depth = Math.max(0.001, (bounds.max[2] - bounds.min[2]) * scale[2]);
  return {
    width,
    height,
    depth,
    volume: width * height * depth,
    halfExtents: [width * 0.5, height * 0.5, depth * 0.5] as const,
  };
}

export function resolveGlyphAuthorship(input: {
  glyphIndex: number;
  character: string;
  objectNodeName: string;
  localBoundingBox: Readonly<{
    min: readonly [number, number, number];
    max: readonly [number, number, number];
  }>;
  scale: readonly [number, number, number];
}): GlyphAuthorship {
  const base = CHARACTER_BASE[input.character];
  if (!base) {
    throw new Error(`Missing authorship for glyph character "${input.character}"`);
  }
  const seed = hashSeed(input.glyphIndex, input.objectNodeName);
  const instanceBias = 0.96 + ((input.glyphIndex * 37) % 9) * 0.011 + (seed - 0.5) * 0.02;
  const size = boundingVolume(input.localBoundingBox, input.scale);
  const mass = clamp(
    (0.68 + size.volume * 4.05) * base.massBias * instanceBias,
    0.58,
    1.72,
  );
  const inertiaScale = 1 + (seed - 0.5) * 0.04;
  // Box inertia about principal axes through COM:
  // Ix ∝ (h²+d²), Iy ∝ (w²+d²), Iz ∝ (w²+h²).
  const inertia: [number, number, number] = [
    round4(mass * (size.height * size.height + size.depth * size.depth) / 12 * inertiaScale),
    round4(mass * (size.width * size.width + size.depth * size.depth) / 12 * inertiaScale),
    round4(mass * (size.width * size.width + size.height * size.height) / 12 * inertiaScale),
  ];
  const maxTravel = clamp(
    Math.max(0.034, size.halfExtents[0] * 0.55) * base.maxTravelBias,
    0.03,
    0.085,
  );

  return {
    physics: {
      density: round3(base.density * (0.985 + seed * 0.03)),
      mass: round4(mass),
      inertia,
      buoyancy: round3(base.buoyancy * (0.97 + seed * 0.06)),
      drag: round3(base.drag * (0.97 + seed * 0.05)),
      angular_drag: round3(base.angularDrag * (0.97 + seed * 0.05)),
      flex_limit: round4(base.flexLimit),
      max_travel: round4(maxTravel),
      max_tilt_deg: round3(base.maxTiltDeg + (seed - 0.5) * 0.25),
      max_depth: round4(0.105 + (1 - base.buoyancy) * 0.02),
      max_linear_speed: round3(0.78 + base.buoyancy * 0.08),
      center_of_mass: [0, 0, round4((seed - 0.5) * 0.012)],
      collision_proxy: {
        half_extents: [
          round4(size.halfExtents[0] * 0.92),
          round4(size.halfExtents[1] * 0.92),
          round4(size.halfExtents[2] * 0.92),
        ],
      },
    },
    optics: {
      ior: round4(base.ior + (seed - 0.5) * 0.008),
      absorption_tint: [
        round4(clamp(base.absorptionTint[0] + (seed - 0.5) * 0.02, 0.42, 0.56)),
        round4(clamp(base.absorptionTint[1] + (seed - 0.5) * 0.015, 0.72, 0.84)),
        round4(clamp(base.absorptionTint[2] + (seed - 0.5) * 0.01, 0.86, 0.94)),
      ],
      absorption_distance: round4(base.absorptionDistance * (0.96 + seed * 0.08)),
      roughness: round4(clamp(base.roughness + (seed - 0.5) * 0.0015, 0.007, 0.014)),
      dispersion_scale: round3(base.dispersionScale * (0.94 + seed * 0.12)),
      bubble_density: round3(clamp(base.bubbleDensity * (0.9 + seed * 0.2), 0.55, 1.15)),
      bubble_seed: round4(seed * 97.13 + input.glyphIndex * 3.17),
      thickness_bias: round4(base.thicknessBias + (seed - 0.5) * 0.01),
      caustic_response: round3(base.causticResponse * (0.96 + seed * 0.08)),
    },
  };
}

/** Relative screen-space refraction strength for water→glyph transmission. */
export function relativeRefractionEta(glyphIor: number, mediumIor = WATER_IOR) {
  const safeGlyph = Math.max(glyphIor, mediumIor + 0.01);
  return (safeGlyph - mediumIor) / safeGlyph;
}

/** Schlick F0 for two participating media. */
export function schlickF0(glyphIor: number, mediumIor = WATER_IOR) {
  const ratio = (mediumIor - glyphIor) / (mediumIor + glyphIor);
  return ratio * ratio;
}

export function opticalTierPolicy(tier: "high" | "balanced" | "low" | "static") {
  if (tier === "high") {
    return {
      refractionTaps: 3,
      dispersionStrength: 1,
      spectralEdges: true as const,
      environmentSamples: 5 as const,
    };
  }
  if (tier === "balanced") {
    return {
      refractionTaps: 2,
      dispersionStrength: 0.45,
      spectralEdges: true as const,
      environmentSamples: 3 as const,
    };
  }
  if (tier === "low") {
    return {
      refractionTaps: 1,
      dispersionStrength: 0,
      spectralEdges: false as const,
      environmentSamples: 1 as const,
    };
  }
  return {
    refractionTaps: 0,
    dispersionStrength: 0,
    spectralEdges: false as const,
    environmentSamples: 0 as const,
  };
}
