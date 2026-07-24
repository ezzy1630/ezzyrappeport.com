#!/usr/bin/env node
/**
 * Phase-1 pointer physics probe: slow wake, fast wake, click ring timeline,
 * glyph jostle, and press-hold suction. Screenshots land in
 * .tmp/pointer-physics/ for visual tuning.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, waitForPageCondition, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outDir = join(process.cwd(), ".tmp", "pointer-physics");
mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (/GL_|WebGL|error|Error/i.test(text)) logs.push(`[${msg.type()}] ${text}`);
});
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
await waitForPageCondition(page, () => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
  return (
    canvas?.dataset.heroReady === "true"
    || document.documentElement.dataset.heroRenderer === "live"
    || fluid === "ready"
    || fluid === "static"
  );
}, { timeoutMs: 45000, intervalMs: 100 });
await delay(800);

const snap = async (name) => {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, type: "png" });
  console.log(`shot ${name}`);
  return path;
};

const metrics = async () => page.evaluate(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  return {
    fps: canvas?.dataset.fps ?? null,
    workMsP95: canvas?.dataset.workMsP95 ?? null,
    ok: canvas?.dataset.frameBudgetOk ?? null,
    injection: canvas?.dataset.waterInjectionCount ?? null,
    glyphMotion: canvas?.dataset.glyphMotion ? JSON.parse(canvas.dataset.glyphMotion) : null,
  };
});

await snap("00-idle");

// 1) Slow glide across open water / name band
await page.mouse.move(280, 420);
await page.mouse.move(1100, 400, { steps: 48 });
await delay(120);
await snap("01-slow-wake");
console.log("after slow", await metrics());

// 2) Fast churn
await page.mouse.move(220, 520);
await page.mouse.move(1280, 360, { steps: 4 });
await delay(80);
await snap("02-fast-wake");
console.log("after fast", await metrics());

// 3) Click in open water (mid-field, above copy band) — ring timeline
await page.mouse.move(520, 560);
await page.mouse.down();
await page.mouse.up();
await delay(100);
await snap("03-click-open-100ms");
await delay(200);
await snap("04-click-open-300ms");
await delay(300);
await snap("05-click-open-600ms");
console.log("after open click", await metrics());

// 4) Click near glyphs — letters should jostle
await page.mouse.move(740, 360);
await page.mouse.down();
await page.mouse.up();
await delay(160);
const afterGlyphClick = await metrics();
await snap("06-click-glyphs");
console.log("after glyph click", JSON.stringify(afterGlyphClick.glyphMotion?.map((g) => ({
  c: g.c, dx: g.dx, dy: g.dy, rot: g.rotation, peak: g.peakPx,
}))));

// 5) Press-hold suction in open water
await page.mouse.move(980, 640);
await page.mouse.down();
await delay(800);
await snap("07-hold-800ms");
await page.mouse.up();
await delay(200);
await snap("08-hold-release");

// Frame budget after interaction sequence
await delay(400);
const finalMetrics = await metrics();
console.log("final", finalMetrics);
console.log("gl/errors", logs.slice(0, 20));
console.log(`screenshots -> ${outDir}`);
await browser.close();
