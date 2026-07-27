import {
  resolveGlyphAuthorship,
  type GlyphOpticalAuthorship,
  type GlyphPhysicsAuthorship,
} from "./glyphAuthorship.ts";

export type HeroGlyphManifestEntry = {
  glyph_index: number;
  character: string;
  line_index: number;
  object_node_name: string;
  rest_transform: {
    translation: [number, number, number];
    rotation_xyzw: [number, number, number, number];
    scale: [number, number, number];
  };
  pivot: { type: string; local: [number, number, number] };
  local_bounding_box: {
    min: [number, number, number];
    max: [number, number, number];
  };
  shared_geometry_identifier: string;
  physics: GlyphPhysicsAuthorship;
  optics: GlyphOpticalAuthorship;
};

export type HeroGlyphManifest = {
  asset: string;
  version: number;
  glyphs: HeroGlyphManifestEntry[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isVec3(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && value.every(isFiniteNumber);
}

function assertPhysics(value: unknown, label: string): GlyphPhysicsAuthorship {
  const physics = value as Partial<GlyphPhysicsAuthorship> | undefined;
  if (!physics
    || !isFiniteNumber(physics.density)
    || !isFiniteNumber(physics.mass)
    || !isVec3(physics.inertia)
    || !isFiniteNumber(physics.buoyancy)
    || !isFiniteNumber(physics.drag)
    || !isFiniteNumber(physics.angular_drag)
    || !isFiniteNumber(physics.flex_limit)
    || !isFiniteNumber(physics.max_travel)
    || !isFiniteNumber(physics.max_tilt_deg)
    || !isFiniteNumber(physics.max_depth)
    || !isFiniteNumber(physics.max_linear_speed)
    || !isVec3(physics.center_of_mass)
    || !physics.collision_proxy
    || !isVec3(physics.collision_proxy.half_extents)
  ) {
    throw new Error(`Hero glyph manifest missing physics for ${label}`);
  }
  return physics as GlyphPhysicsAuthorship;
}

function assertOptics(value: unknown, label: string): GlyphOpticalAuthorship {
  const optics = value as Partial<GlyphOpticalAuthorship> | undefined;
  if (!optics
    || !isFiniteNumber(optics.ior)
    || !isVec3(optics.absorption_tint)
    || !isFiniteNumber(optics.absorption_distance)
    || !isFiniteNumber(optics.roughness)
    || !isFiniteNumber(optics.dispersion_scale)
    || !isFiniteNumber(optics.bubble_density)
    || !isFiniteNumber(optics.bubble_seed)
    || !isFiniteNumber(optics.thickness_bias)
    || !isFiniteNumber(optics.caustic_response)
  ) {
    throw new Error(`Hero glyph manifest missing optics for ${label}`);
  }
  return optics as GlyphOpticalAuthorship;
}

export function validateHeroManifest(value: unknown): HeroGlyphManifest {
  const manifest = value as Partial<HeroGlyphManifest> & {
    glyphs?: Array<Partial<HeroGlyphManifestEntry> & {
      physics?: unknown;
      optics?: unknown;
    }>;
  };
  if (manifest.version !== 2 || !Array.isArray(manifest.glyphs)) {
    throw new Error("Unsupported hero glyph manifest");
  }
  const glyphs = [...manifest.glyphs].sort((a, b) => (a.glyph_index ?? -1) - (b.glyph_index ?? -1));
  if (glyphs.length !== 13 || glyphs.some((glyph, index) => glyph.glyph_index !== index)) {
    throw new Error("Hero glyph manifest must contain glyph indices 0..12");
  }

  const normalized: HeroGlyphManifestEntry[] = glyphs.map((glyph, index) => {
    if (!glyph
      || typeof glyph.character !== "string"
      || typeof glyph.object_node_name !== "string"
      || typeof glyph.line_index !== "number"
      || !glyph.rest_transform
      || !glyph.pivot
      || !glyph.local_bounding_box
      || typeof glyph.shared_geometry_identifier !== "string"
    ) {
      throw new Error(`Hero glyph manifest entry ${index} is incomplete`);
    }

    const authored = resolveGlyphAuthorship({
      glyphIndex: index,
      character: glyph.character,
      objectNodeName: glyph.object_node_name,
      localBoundingBox: glyph.local_bounding_box as HeroGlyphManifestEntry["local_bounding_box"],
      scale: glyph.rest_transform.scale as [number, number, number],
    });

    // Version 2 requires authored blocks on disk — no silent synthesis.
    const physics = assertPhysics(glyph.physics, glyph.object_node_name);
    const optics = assertOptics(glyph.optics, glyph.object_node_name);

    // Guard against authored drift relative to the deterministic table.
    if (Math.abs(physics.mass - authored.physics.mass) > 0.05) {
      throw new Error(`Hero glyph mass drift for ${glyph.object_node_name}`);
    }
    if (Math.abs(optics.ior - authored.optics.ior) > 0.02) {
      throw new Error(`Hero glyph IOR drift for ${glyph.object_node_name}`);
    }

    return {
      glyph_index: index,
      character: glyph.character,
      line_index: glyph.line_index,
      object_node_name: glyph.object_node_name,
      rest_transform: glyph.rest_transform as HeroGlyphManifestEntry["rest_transform"],
      pivot: glyph.pivot as HeroGlyphManifestEntry["pivot"],
      local_bounding_box: glyph.local_bounding_box as HeroGlyphManifestEntry["local_bounding_box"],
      shared_geometry_identifier: glyph.shared_geometry_identifier,
      physics,
      optics,
    };
  });

  return {
    asset: manifest.asset ?? "hero glyphs",
    version: 2,
    glyphs: normalized,
  };
}
