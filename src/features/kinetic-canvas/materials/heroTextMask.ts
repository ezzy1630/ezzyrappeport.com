"use client";

import { HERO_LINE_1, HERO_LINE_2 } from "../renderer/quality";

type TextLine = {
  text: string;
  scale: number;
};

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
  centerX: number,
  baseline: number,
  fontSize: number,
  fontStack: string,
  tracking: number,
  paint: "fill" | "stroke" = "fill",
) {
  const lineW = measureHeroLine(ctx, text, fontSize, fontStack, tracking);
  let x = centerX - lineW / 2;
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
  const isMobilePoster = width / Math.max(height, 1) < 0.74;
  const lines: TextLine[] = isMobilePoster
    ? [
        { text: HERO_LINE_1, scale: 0.92 },
        { text: HERO_LINE_2, scale: 1.0 },
      ]
    : [
        { text: HERO_LINE_1, scale: 0.96 },
        { text: HERO_LINE_2, scale: 1.0 },
      ];

  const targetW = width * (isMobilePoster ? 0.92 : 0.93);
  const targetH = height * (isMobilePoster ? 0.25 : 0.40);
  const lineGap = isMobilePoster ? 0.92 : 0.88;
  const trackingFactor = isMobilePoster ? -0.030 : -0.042;

  const measureAt = (fontSize: number) => {
    const maxW = lines.reduce((max, line) => {
      const sz = fontSize * line.scale;
      return Math.max(max, measureHeroLine(ctx, line.text, sz, fontStack, sz * trackingFactor));
    }, 0);
    const blockH = fontSize * (1.0 + (lines.length - 1) * lineGap);
    return { maxW, blockH };
  };

  let size = height * (isMobilePoster ? 0.15 : 0.255);
  for (let i = 0; i < 8; i++) {
    const measured = measureAt(size);
    if (measured.maxW <= 0 || measured.blockH <= 0) break;
    size *= Math.min(targetW / measured.maxW, targetH / measured.blockH);
  }
  size = Math.max(44, Math.min(size, height * (isMobilePoster ? 0.135 : 0.30)));

  const top = height * (isMobilePoster ? 0.112 : 0.092);
  const centerX = width / 2;
  ctx.save();
  ctx.shadowColor = "rgba(255, 255, 255, 0.86)";
  ctx.shadowBlur = Math.max(4, size * 0.032);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  lines.forEach((line, index) => {
    const sz = size * line.scale;
    const tracking = sz * trackingFactor;
    const baseline = top + sz * 0.82 + index * size * lineGap;
    ctx.font = `900 ${sz}px ${fontStack}`;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(6, sz * 0.075);
    drawTrackedText(ctx, line.text, centerX, baseline, sz, fontStack, tracking, "stroke");
    ctx.fillStyle = "#ffffff";
    drawTrackedText(ctx, line.text, centerX, baseline, sz, fontStack, tracking);
  });
  ctx.restore();
  return canvas;
}
