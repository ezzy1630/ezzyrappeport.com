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
};

export type HeroGlyphManifest = {
  asset: string;
  version: number;
  glyphs: HeroGlyphManifestEntry[];
};

export function validateHeroManifest(value: unknown): HeroGlyphManifest {
  const manifest = value as Partial<HeroGlyphManifest>;
  if (manifest.version !== 1 || !Array.isArray(manifest.glyphs)) {
    throw new Error("Unsupported hero glyph manifest");
  }
  const glyphs = [...manifest.glyphs].sort((a, b) => a.glyph_index - b.glyph_index);
  if (glyphs.length !== 13 || glyphs.some((glyph, index) => glyph.glyph_index !== index)) {
    throw new Error("Hero glyph manifest must contain glyph indices 0..12");
  }
  return { asset: manifest.asset ?? "hero glyphs", version: 1, glyphs };
}
