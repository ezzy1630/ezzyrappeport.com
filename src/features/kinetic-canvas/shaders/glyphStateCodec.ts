export const GLYPH_STATE_RANGES = [
  [0.022, 0.022, 0.045, 0.012],
  [0.40, 0.40, 0.40, 0.12],
  [0.16, 0.16, 0.12, 1.0],
  [3.0, 3.0, 3.0, 1.0],
] as const;

export function packGlyphSigned16(value: number, logicalRow: number, component: number) {
  const range = GLYPH_STATE_RANGES[logicalRow]?.[component] ?? 1;
  const normalized = Math.max(0, Math.min(1, value / range * 0.5 + 0.5));
  const integerValue = Math.floor(normalized * 65_535 + 0.5);
  return [Math.floor(integerValue / 256), integerValue % 256] as const;
}

export function unpackGlyphSigned16(
  bytes: readonly [number, number],
  logicalRow: number,
  component: number,
) {
  const range = GLYPH_STATE_RANGES[logicalRow]?.[component] ?? 1;
  const normalized = (bytes[0] * 256 + bytes[1]) / 65_535;
  return (normalized * 2 - 1) * range;
}

/**
 * Shared GPU codec for the tiny per-glyph state texture.
 *
 * Float-capable devices store one vec4 per logical row. The compatibility
 * path stores each vec4 across two RGBA8 texels, preserving two signed 16-bit
 * values per texel. At the largest translation range this keeps quantization
 * below 0.001 CSS pixels at a 1440px viewport, so spring integration does not
 * stall or visibly jitter.
 */
export const GLYPH_STATE_CODEC_SOURCE = `
uniform bool u_packedGlyphState;

vec4 glyphStateRange(int logicalRow) {
  if (logicalRow == 0) return vec4(${GLYPH_STATE_RANGES[0].join(", ")});
  if (logicalRow == 1) return vec4(${GLYPH_STATE_RANGES[1].join(", ")});
  if (logicalRow == 2) return vec4(${GLYPH_STATE_RANGES[2].join(", ")});
  return vec4(${GLYPH_STATE_RANGES[3].join(", ")});
}

vec2 packGlyphUnit16(float value) {
  float integerValue = floor(clamp(value, 0.0, 1.0) * 65535.0 + 0.5);
  return vec2(floor(integerValue / 256.0), mod(integerValue, 256.0)) / 255.0;
}

float unpackGlyphUnit16(vec2 bytes) {
  vec2 integerBytes = floor(bytes * 255.0 + 0.5);
  return (integerBytes.x * 256.0 + integerBytes.y) / 65535.0;
}

vec4 readGlyphState(sampler2D stateTexture, int glyphIndex, int logicalRow) {
  if (!u_packedGlyphState) {
    return texelFetch(stateTexture, ivec2(glyphIndex, logicalRow), 0);
  }
  vec4 lower = texelFetch(stateTexture, ivec2(glyphIndex, logicalRow * 2), 0);
  vec4 upper = texelFetch(stateTexture, ivec2(glyphIndex, logicalRow * 2 + 1), 0);
  vec4 normalized = vec4(
    unpackGlyphUnit16(lower.rg),
    unpackGlyphUnit16(lower.ba),
    unpackGlyphUnit16(upper.rg),
    unpackGlyphUnit16(upper.ba)
  );
  return (normalized * 2.0 - 1.0) * glyphStateRange(logicalRow);
}

vec4 writeGlyphState(vec4 value, int logicalRow, int physicalRow) {
  if (!u_packedGlyphState) return value;
  vec4 normalized = clamp(value / glyphStateRange(logicalRow) * 0.5 + 0.5, 0.0, 1.0);
  if (physicalRow == logicalRow * 2) {
    return vec4(packGlyphUnit16(normalized.x), packGlyphUnit16(normalized.y));
  }
  return vec4(packGlyphUnit16(normalized.z), packGlyphUnit16(normalized.w));
}
`;
