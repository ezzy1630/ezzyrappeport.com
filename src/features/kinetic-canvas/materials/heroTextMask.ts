"use client";

import { HERO_LINE_1, HERO_LINE_2 } from "../renderer/quality";

type TextLine = {
  text: string;
  scale: number;
};

let cachedField: { key: string; canvas: HTMLCanvasElement } | null = null;

export function clearHeroTextCanvasCache() {
  cachedField = null;
}

function distanceFromSeeds(width: number, height: number, seeds: Uint8Array) {
  const diagonal = Math.SQRT2;
  const distance = new Float32Array(width * height);
  distance.fill(1e6);
  for (let i = 0; i < seeds.length; i++) {
    if (seeds[i]) distance[i] = 0;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      let value = distance[i];
      if (x > 0) value = Math.min(value, distance[i - 1] + 1);
      if (y > 0) value = Math.min(value, distance[i - width] + 1);
      if (x > 0 && y > 0) value = Math.min(value, distance[i - width - 1] + diagonal);
      if (x + 1 < width && y > 0) value = Math.min(value, distance[i - width + 1] + diagonal);
      distance[i] = value;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      let value = distance[i];
      if (x + 1 < width) value = Math.min(value, distance[i + 1] + 1);
      if (y + 1 < height) value = Math.min(value, distance[i + width] + 1);
      if (x + 1 < width && y + 1 < height) value = Math.min(value, distance[i + width + 1] + diagonal);
      if (x > 0 && y + 1 < height) value = Math.min(value, distance[i + width - 1] + diagonal);
      distance[i] = value;
    }
  }
  return distance;
}

/** Pack signed distance, dome height, inner bevel, and hard coverage into RGBA. */
function encodeTitleField(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const image = ctx.getImageData(0, 0, width, height);
  const insideSeeds = new Uint8Array(width * height);
  const outsideSeeds = new Uint8Array(width * height);
  for (let i = 0; i < insideSeeds.length; i++) {
    const inside = image.data[i * 4 + 3] >= 128;
    insideSeeds[i] = inside ? 1 : 0;
    outsideSeeds[i] = inside ? 0 : 1;
  }
  const distanceToInside = distanceFromSeeds(width, height, insideSeeds);
  const distanceToOutside = distanceFromSeeds(width, height, outsideSeeds);
  const range = Math.max(18, Math.min(48, Math.round(width * 0.022)));
  for (let i = 0; i < insideSeeds.length; i++) {
    const inside = insideSeeds[i] === 1;
    const signed = inside ? distanceToOutside[i] : -distanceToInside[i];
    const distanceIn = inside ? distanceToOutside[i] : 0;
    image.data[i * 4] = Math.max(0, Math.min(255, Math.round(127.5 + (signed / range) * 127.5)));
    image.data[i * 4 + 1] = Math.max(0, Math.min(255, Math.round((distanceIn / range) * 255)));
    image.data[i * 4 + 2] = inside
      ? Math.max(0, Math.min(255, Math.round((1 - distanceIn / (range * 0.32)) * 255)))
      : 0;
  }
  ctx.putImageData(image, 0, 0);
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
  paint: "fill" | "stroke" = "fill",
) {
  const lineW = measureHeroLine(ctx, text, fontSize, fontStack, tracking);
  let x = startX;
  ctx.font = `900 ${fontSize}px ${fontStack}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < text.length; i++) {
    const glyph = text[i];
    if (paint === "stroke") ctx.strokeText(glyph, x, baseline);
    else ctx.fillText(glyph, x, baseline);
    x += ctx.measureText(glyph).width + (i < text.length - 1 ? tracking : 0);
  }

  return lineW;
}

export function createHeroTextCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, width, height);

  const family = resolveHeroFont();
  const fontStack = `${family}, "Inter Tight", system-ui, sans-serif`;
  const cacheKey = `${width}x${height}:${fontStack}`;
  if (cachedField?.key === cacheKey) return cachedField.canvas;
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
    if (index === 0 && !isMobilePoster) {
      ctx.translate(titleLeft, 0);
      ctx.scale(1.09, 1);
    }
    const drawLeft = index === 0 && !isMobilePoster ? 0 : titleLeft;
    ctx.font = `900 ${sz}px ${fontStack}`;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, sz * 0.012);
    drawTrackedText(ctx, line.text, drawLeft, baseline, sz, fontStack, tracking, "stroke");
    ctx.fillStyle = "#ffffff";
    drawTrackedText(ctx, line.text, drawLeft, baseline, sz, fontStack, tracking);
    ctx.restore();
  });
  ctx.restore();
  encodeTitleField(ctx, width, height);
  cachedField = { key: cacheKey, canvas };
  return canvas;
}
