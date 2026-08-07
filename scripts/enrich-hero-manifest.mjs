#!/usr/bin/env node
/**
 * Enrich the checked-in hero glyph manifest with Milestone 1 physics/optics
 * authorship without regenerating GLB geometry.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolveGlyphAuthorship } from "../src/features/kinetic-canvas/renderer/underwater/glyphAuthorship.ts";

const manifestPath = new URL("../public/assets/hero/ezzy-rappeport-glyphs.json", import.meta.url);
const raw = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(raw.glyphs) || raw.glyphs.length !== 13) {
  throw new Error("Expected 13 glyphs in hero manifest");
}

raw.version = 2;
raw.medium = {
  name: "water",
  ior: 1.333,
};
raw.authorship = {
  milestone: 1,
  note: "Per-letter physics and optical variation; geometry unchanged from inflated Inter Tight v2.",
};

for (const glyph of raw.glyphs) {
  const authored = resolveGlyphAuthorship({
    glyphIndex: glyph.glyph_index,
    character: glyph.character,
    objectNodeName: glyph.object_node_name,
    localBoundingBox: glyph.local_bounding_box,
    scale: glyph.rest_transform.scale,
  });
  glyph.physics = authored.physics;
  glyph.optics = authored.optics;
}

writeFileSync(manifestPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  version: raw.version,
  glyphs: raw.glyphs.length,
  path: manifestPath.pathname,
}, null, 2));
