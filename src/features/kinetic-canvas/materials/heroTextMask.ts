"use client";

import { HERO_LINE_1, HERO_LINE_2 } from "../renderer/quality";

type TextLine = {
  text: string;
  scale: number;
};

export type HeroTextLineLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  tracking: number;
};

export const HERO_GLYPH_COUNT = HERO_LINE_1.length + HERO_LINE_2.length;

export type HeroGlyphMetadata = {
  index: number;
  glyph: string;
  /** Rest center and half-size in top-left-origin viewport UV coordinates. */
  rest: [number, number, number, number];
  /** Atlas origin and size in top-left-origin texture UV coordinates. */
  atlas: [number, number, number, number];
  /** mass, spring stiffness, damping, and maximum translation in viewport UV. */
  physics: [number, number, number, number];
  /** buoyancy, rotational stiffness, maximum rotation, and depth response. */
  material: [number, number, number, number];
};

export type HeroGlyphAtlas = {
  canvas: HTMLCanvasElement;
  glyphs: HeroGlyphMetadata[];
};

let cachedField: { key: string; canvas: HTMLCanvasElement } | null = null;

export function clearHeroTextCanvasCache() {
  if (cachedField) {
    cachedField.canvas.width = 1;
    cachedField.canvas.height = 1;
  }
  cachedField = null;
}

function squaredDistanceTransform1D(source: Float64Array, target: Float64Array) {
  const length = source.length;
  const locations = new Int32Array(length);
  const boundaries = new Float64Array(length + 1);
  let envelope = 0;
  locations[0] = 0;
  boundaries[0] = Number.NEGATIVE_INFINITY;
  boundaries[1] = Number.POSITIVE_INFINITY;

  for (let position = 1; position < length; position++) {
    let previous = locations[envelope];
    let boundary = (
      source[position] + position * position - source[previous] - previous * previous
    ) / (2 * position - 2 * previous);
    while (boundary <= boundaries[envelope]) {
      envelope -= 1;
      previous = locations[envelope];
      boundary = (
        source[position] + position * position - source[previous] - previous * previous
      ) / (2 * position - 2 * previous);
    }
    envelope += 1;
    locations[envelope] = position;
    boundaries[envelope] = boundary;
    boundaries[envelope + 1] = Number.POSITIVE_INFINITY;
  }

  envelope = 0;
  for (let position = 0; position < length; position++) {
    while (boundaries[envelope + 1] < position) envelope += 1;
    const delta = position - locations[envelope];
    target[position] = delta * delta + source[locations[envelope]];
  }
}

/** Exact Euclidean distance field; the former eight-neighbor chamfer pass
 * produced the triangular planes visible across the inflated letter faces. */
function distanceFromSeeds(width: number, height: number, seeds: Uint8Array) {
  const unreachable = 1e12;
  const horizontal = new Float64Array(width * height);
  const result = new Float32Array(width * height);
  const source = new Float64Array(Math.max(width, height));
  const target = new Float64Array(Math.max(width, height));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) source[x] = seeds[y * width + x] ? 0 : unreachable;
    squaredDistanceTransform1D(source.subarray(0, width), target.subarray(0, width));
    for (let x = 0; x < width; x++) horizontal[y * width + x] = target[x];
  }
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) source[y] = horizontal[y * width + x];
    squaredDistanceTransform1D(source.subarray(0, height), target.subarray(0, height));
    for (let y = 0; y < height; y++) result[y * width + x] = Math.sqrt(target[y]);
  }
  return result;
}

/** Pack signed distance, dome height, inner bevel, and hard coverage into RGBA. */
function encodeTitleField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  rangeOverride?: number,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const range = rangeOverride == null
    ? Math.max(18, Math.min(42, Math.round(width * 0.02)))
    : Math.max(1, Math.round(rangeOverride));
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (image.data[(y * width + x) * 4 + 3] < 8) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return;

  const cropX = Math.max(0, minX - range - 2);
  const cropY = Math.max(0, minY - range - 2);
  const cropRight = Math.min(width - 1, maxX + range + 2);
  const cropBottom = Math.min(height - 1, maxY + range + 2);
  const cropWidth = cropRight - cropX + 1;
  const cropHeight = cropBottom - cropY + 1;
  const insideSeeds = new Uint8Array(cropWidth * cropHeight);
  const outsideSeeds = new Uint8Array(cropWidth * cropHeight);
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const cropIndex = y * cropWidth + x;
      const imageIndex = ((cropY + y) * width + cropX + x) * 4;
      const inside = image.data[imageIndex + 3] >= 128;
      insideSeeds[cropIndex] = inside ? 1 : 0;
      outsideSeeds[cropIndex] = inside ? 0 : 1;
    }
  }
  const distanceToInside = distanceFromSeeds(cropWidth, cropHeight, insideSeeds);
  const distanceToOutside = distanceFromSeeds(cropWidth, cropHeight, outsideSeeds);
  const bevelWidth = Math.max(3, Math.min(14, range * 0.40));
  for (let y = 0; y < cropHeight; y++) {
    for (let x = 0; x < cropWidth; x++) {
      const cropIndex = y * cropWidth + x;
      const imageIndex = ((cropY + y) * width + cropX + x) * 4;
      const inside = insideSeeds[cropIndex] === 1;
      const signed = inside ? distanceToOutside[cropIndex] : -distanceToInside[cropIndex];
      const distanceIn = inside ? distanceToOutside[cropIndex] : 0;
      image.data[imageIndex] = Math.max(0, Math.min(255, Math.round(127.5 + (signed / range) * 127.5)));
      // Store continuous physical distance-to-wall in the same units for every
      // stroke. The shader turns this into a saturating rounded profile; unlike
      // medial-ridge catchments this field has no discontinuous planar seams.
      image.data[imageIndex + 1] = Math.max(
        0,
        Math.min(255, Math.round((distanceIn / range) * 255)),
      );
      image.data[imageIndex + 2] = inside
        ? Math.max(0, Math.min(255, Math.round((1 - distanceIn / bevelWidth) * 255)))
        : 0;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Rasterize every visible letter into an isolated SDF tile. Repeated letters
 * intentionally receive separate tiles and metadata: shape reuse is cheap,
 * but identity and physical state must never be shared.
 */
export function createHeroGlyphAtlas(
  viewportWidth: number,
  viewportHeight: number,
  tileSize = 192,
): HeroGlyphAtlas {
  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(".hero-name-fallback__glyph"),
  );
  const columns = 4;
  const rows = Math.ceil(Math.max(elements.length, HERO_GLYPH_COUNT) / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * tileSize;
  canvas.height = rows * tileSize;
  const atlasContext = canvas.getContext("2d");
  if (!atlasContext) return { canvas, glyphs: [] };

  const family = resolveHeroFont();
  const fontStack = `${family}, "Inter Tight", system-ui, sans-serif`;
  const glyphs: HeroGlyphMetadata[] = [];
  // Keep enough exterior texels for SDF filtering without visibly shrinking
  // the letter inside its typographic advance box.
  const padding = Math.round(tileSize * 0.04);

  elements.forEach((element, index) => {
    const glyph = element.dataset.glyph ?? element.textContent ?? "";
    if (!glyph.trim()) return;
    const rect = element.getBoundingClientRect();
    const tile = document.createElement("canvas");
    tile.width = tileSize;
    tile.height = tileSize;
    const context = tile.getContext("2d");
    if (!context) return;

    let fontSize = tileSize * 0.72;
    context.font = `900 ${fontSize}px ${fontStack}`;
    let metrics = context.measureText(glyph);
    const available = tileSize - padding * 2;
    const measuredHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    fontSize *= Math.min(
      available / Math.max(metrics.width, 1),
      available / Math.max(measuredHeight, 1),
    );
    context.font = `900 ${fontSize}px ${fontStack}`;
    metrics = context.measureText(glyph);
    const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const x = (tileSize - metrics.width) * 0.5;
    const baseline = (tileSize - glyphHeight) * 0.5 + metrics.actualBoundingBoxAscent;
    context.fillStyle = "#fff";
    context.strokeStyle = "#fff";
    context.lineJoin = "round";
    context.lineCap = "round";
    context.lineWidth = Math.max(2, fontSize * 0.16);
    context.textAlign = "left";
    context.textBaseline = "alphabetic";
    context.strokeText(glyph, x, baseline);
    context.fillText(glyph, x, baseline);
    encodeTitleField(context, tileSize, tileSize, tileSize * 0.16);

    const column = index % columns;
    const row = Math.floor(index / columns);
    atlasContext.drawImage(tile, column * tileSize, row * tileSize);

    const normalizedWidth = rect.width / Math.max(viewportWidth, 1);
    const normalizedHeight = rect.height / Math.max(viewportHeight, 1);
    const dimension = Math.max(normalizedWidth, normalizedHeight);
    const seed = (index * 0.61803398875) % 1;
    const mass = 0.92 + dimension * 2.4 + seed * 0.12;
    const spring = 15.8 + (1 - seed) * 2.6;
    const damping = 7.1 + seed * 0.7;
    // CSS-pixel targets are resolved in the shader, but the body still needs
    // enough normalized headroom for a 20-30 px local press on common desktop
    // viewports. The former 0.006-0.018 range made the visible clamp, not the
    // fluid force, the defining behavior.
    const maxTranslation = Math.min(0.032, Math.max(0.014, normalizedWidth * 0.22));

    glyphs.push({
      index,
      glyph,
      rest: [
        (rect.left + rect.width * 0.5) / Math.max(viewportWidth, 1),
        (rect.top + rect.height * 0.5) / Math.max(viewportHeight, 1),
        normalizedWidth * 0.5,
        normalizedHeight * 0.5,
      ],
      atlas: [
        (column * tileSize) / canvas.width,
        (row * tileSize) / canvas.height,
        tileSize / canvas.width,
        tileSize / canvas.height,
      ],
      physics: [mass, spring, damping, maxTranslation],
      material: [
        0.78 + (1 - seed) * 0.18,
        9.8 + seed * 1.8,
        0.11 + (1 - seed) * 0.025,
        0.86 + seed * 0.24,
      ],
    });
  });

  return { canvas, glyphs };
}

/** Resolve the loaded Inter Tight family name for canvas rasterization. */
function resolveHeroFont(): string {
  if (typeof document === "undefined") return "Inter Tight";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-inter-tight")
    .trim();
  if (!raw) return "Inter Tight";
  return raw.split(",")[0].trim() || "Inter Tight";
}

function measureHeroLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontSize: number,
  fontStack: string,
  tracking: number,
) {
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  return ctx.measureText(text).width + Math.max(0, text.length - 1) * tracking;
}

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  startX: number,
  baseline: number,
  fontSize: number,
  fontStack: string,
  tracking: number,
) {
  const lineW = measureHeroLine(ctx, text, fontSize, fontStack, tracking);
  let x = startX;
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < text.length; i++) {
    const glyph = text[i];
    ctx.fillText(glyph, x, baseline);
    x += ctx.measureText(glyph).width + (i < text.length - 1 ? tracking : 0);
  }

  return lineW;
}

export function createHeroTextCanvas(
  width: number,
  height: number,
  layout?: HeroTextLineLayout[],
): HTMLCanvasElement {
  const family = resolveHeroFont();
  const fontStack = `${family}, "Inter Tight", system-ui, sans-serif`;
  const layoutKey = layout
    ?.map((line) => [line.x, line.y, line.width, line.height, line.fontSize, line.tracking].map(Math.round).join(","))
    .join(";") ?? "viewport";
  const cacheKey = `${width}x${height}:${fontStack}:${layoutKey}`;
  if (cachedField?.key === cacheKey) return cachedField.canvas;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, width, height);

  if (layout?.length === 2) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    layout.forEach((line, index) => {
      const text = index === 0 ? HERO_LINE_1 : HERO_LINE_2;
      const fontSize = line.fontSize;
      const tracking = line.tracking;
      const metrics = (() => {
        ctx.font = `900 ${fontSize}px ${fontStack}`;
        return ctx.measureText(text);
      })();
      const measuredWidth = measureHeroLine(ctx, text, fontSize, fontStack, tracking);
      const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
      const horizontalScale = line.width / Math.max(1, measuredWidth);
      const verticalScale = line.height / Math.max(1, glyphHeight);

      ctx.save();
      ctx.translate(line.x, line.y);
      ctx.scale(horizontalScale, verticalScale);
      ctx.fillStyle = "#ffffff";
      drawTrackedText(ctx, text, 0, metrics.actualBoundingBoxAscent, fontSize, fontStack, tracking);
      ctx.restore();
    });
    ctx.restore();
    encodeTitleField(ctx, width, height);
    cachedField = { key: cacheKey, canvas };
    return canvas;
  }

  const isMobilePoster = width / Math.max(height, 1) < 0.74;
  const lines: TextLine[] = [
    { text: HERO_LINE_1, scale: isMobilePoster ? 1.48 : 1.22 },
    { text: HERO_LINE_2, scale: 1 },
  ];
  const trackingFactor = isMobilePoster ? -0.035 : -0.042;
  const targetW = width * (isMobilePoster ? 0.9 : 0.81);
  let size = height * (isMobilePoster ? 0.082 : 0.245);
  for (let i = 0; i < 6; i++) {
    const surnameWidth = measureHeroLine(ctx, HERO_LINE_2, size, fontStack, size * trackingFactor);
    if (surnameWidth <= 0) break;
    size *= targetW / surnameWidth;
  }
  size = Math.max(42, Math.min(size, height * (isMobilePoster ? 0.088 : 0.265)));

  const top = height * (isMobilePoster ? 0.105 : 0.115);
  const titleLeft = width * (isMobilePoster ? 0.05 : 0.125);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  lines.forEach((line, index) => {
    const sz = size * line.scale;
    const tracking = sz * trackingFactor;
    const baseline = index === 0
      ? top + sz * 0.82
      : top + size * lines[0].scale * 0.76 + size * 0.84;
    ctx.save();
    const drawLeft = titleLeft;
    ctx.font = `900 ${sz}px ${fontStack}`;
    ctx.fillStyle = "#ffffff";
    drawTrackedText(ctx, line.text, drawLeft, baseline, sz, fontStack, tracking);
    ctx.restore();
  });
  ctx.restore();
  encodeTitleField(ctx, width, height);
  cachedField = { key: cacheKey, canvas };
  return canvas;
}
