#!/usr/bin/env node
/**
 * Milestone 0 baseline capture.
 *
 * Modes:
 *   node scripts/capture-milestone-0-baseline.mjs [baseUrl]
 *   node scripts/capture-milestone-0-baseline.mjs --label main [baseUrl]
 *   node scripts/capture-milestone-0-baseline.mjs --label post-m0 [baseUrl]
 *
 * Writes screenshots + metrics under .verification/milestone-0/<label>/
 * Metrics include fps, workMs, drawCalls, triangles, RT memory estimate,
 * transfer hints, and journey chrome state.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const args = process.argv.slice(2);
const labelFlag = args.indexOf("--label");
const label = labelFlag >= 0 ? args[labelFlag + 1] : "post-m0";
const baseUrl = args.filter((arg, index) => arg !== "--label" && index !== labelFlag + 1)[0]
  ?? "http://127.0.0.1:3000";

const outRoot = new URL(`../.verification/milestone-0/${label}/`, import.meta.url);

const VIEWPORTS = [
  { name: "desktop-1728x1117", w: 1728, h: 1117 },
  { name: "desktop-1440x900", w: 1440, h: 900 },
  { name: "desktop-1280x720", w: 1280, h: 720 },
  { name: "tablet-1024x768", w: 1024, h: 768 },
  { name: "mobile-390x844", w: 390, h: 844, mobile: true },
  { name: "mobile-375x812", w: 375, h: 812, mobile: true },
];

const SECTION_SHOTS = [
  { name: "hero", y: 0 },
  { name: "projects", selector: "#projects" },
  { name: "about", selector: "#about" },
  { name: "contact", selector: "#contact" },
];

function gitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".fluid-canvas canvas");
    const html = document.documentElement;
    const gl = canvas instanceof HTMLCanvasElement
      ? canvas.getContext("webgl2") || canvas.getContext("webgl")
      : null;
    let gpuVendor = null;
    let gpuRenderer = null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpuVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        gpuRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      }
    }
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
      boot: document.querySelector(".fluid-canvas")?.dataset.boot ?? null,
      hero: html.dataset.heroRenderer ?? null,
      waterSection: html.dataset.waterSection ?? null,
      experienceChapter: html.dataset.experienceChapter ?? null,
      oceanBridge: Boolean(document.querySelector("[data-ocean-bridge]")),
      renderSize: canvas?.dataset.renderSize ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      frameMsWorst: canvas?.dataset.frameMsWorst ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      workMsWorst: canvas?.dataset.workMsWorst ?? null,
      fps: canvas?.dataset.fps ?? null,
      adaptiveScale: canvas?.dataset.adaptiveScale ?? null,
      worldDepth: canvas?.dataset.worldDepth ?? null,
      glyphCount: canvas?.dataset.glyphCount ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      textureMemoryEstimateMb: canvas?.dataset.textureMemoryEstimateMb ?? null,
      gpuVendor,
      gpuRenderer,
      transferHint: performance.getEntriesByType("resource")
        .filter((entry) => /\.glb($|\?)/.test(entry.name))
        .map((entry) => ({
          name: entry.name.split("/").pop(),
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          duration: entry.duration,
        })),
      inner: { w: window.innerWidth, h: window.innerHeight },
    };
  });
}

async function waitForIdleMetrics(page, timeoutMs = 14000) {
  await waitForHeroReady(page, timeoutMs);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const canvas = document.querySelector(".fluid-canvas canvas");
      return Boolean(
        canvas?.dataset.fps
        && canvas?.dataset.workMsP95
        && canvas?.dataset.drawCalls
        && canvas?.dataset.triangles,
      );
    });
    if (ready) return;
    await delay(250);
  }
}

async function scrollToSection(page, shot) {
  if (typeof shot.y === "number") {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), shot.y);
    return;
  }
  await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) return;
    const nav = document.querySelector(".site-nav");
    const offset = nav ? nav.getBoundingClientRect().bottom + 12 : 0;
    const top = window.scrollY + el.getBoundingClientRect().top - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, shot.selector);
}

async function captureFrameTrace(page, seconds = 2) {
  // Lightweight main-thread frame interval sample via rAF (not Chrome tracing).
  return page.evaluate(async (durationSec) => {
    const samples = [];
    let last = performance.now();
    const end = last + durationSec * 1000;
    await new Promise((resolve) => {
      const tick = (now) => {
        samples.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else resolve(undefined);
      };
      requestAnimationFrame(tick);
    });
    const sorted = [...samples].sort((a, b) => a - b);
    const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
    return {
      sampleCount: samples.length,
      p50: Number(at(0.5).toFixed(2)),
      p95: Number(at(0.95).toFixed(2)),
      worst: Number(Math.max(...samples).toFixed(2)),
    };
  }, seconds);
}

const browser = await launchChrome({ defaultViewport: null });
const baselineDir = new URL("./baseline/", outRoot).pathname;
const sectionsDir = new URL("./sections/", outRoot).pathname;
mkdirSync(baselineDir, { recursive: true });
mkdirSync(sectionsDir, { recursive: true });

const page = await browser.newPage();
const report = {
  milestone: 0,
  label,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: gitCommit(),
  idle: [],
  sections: [],
  frameTraces: [],
};

try {
  for (const viewport of VIEWPORTS) {
    await page.setViewport({
      width: viewport.w,
      height: viewport.h,
      deviceScaleFactor: 1,
      isMobile: Boolean(viewport.mobile),
      hasTouch: Boolean(viewport.mobile),
    });
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await waitForIdleMetrics(page, 14000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(300);
    const path = join(baselineDir, `${viewport.name}.png`);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    const frameTrace = viewport.name === "desktop-1440x900"
      ? await captureFrameTrace(page, 2)
      : null;
    if (frameTrace) {
      report.frameTraces.push({ viewport: viewport.name, ...frameTrace });
    }
    report.idle.push({ ...viewport, path, metrics, frameTrace });
    process.stdout.write(
      `idle ${viewport.name} chapter=${metrics.experienceChapter} fps=${metrics.fps} workP95=${metrics.workMsP95} draws=${metrics.drawCalls} tris=${metrics.triangles} rtMb=${metrics.textureMemoryEstimateMb}\n`,
    );
  }

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page, 10000);
  for (const shot of SECTION_SHOTS) {
    await scrollToSection(page, shot);
    await delay(400);
    const path = join(sectionsDir, `1440x900-${shot.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.sections.push({ ...shot, path, metrics });
    process.stdout.write(
      `section ${shot.name} water=${metrics.waterSection} chapter=${metrics.experienceChapter} depth=${metrics.worldDepth}\n`,
    );
  }
} finally {
  await browser.close();
}

writeFileSync(join(baselineDir, "capture-report.json"), JSON.stringify(report, null, 2));
writeFileSync(
  join(new URL("./", outRoot).pathname, "README.md"),
  [
    `# Milestone 0 baseline — ${label}`,
    "",
    `Captured at: ${report.capturedAt}`,
    `Commit: ${report.commit ?? "unknown"}`,
    `oceanBridge: ${report.idle[0]?.metrics?.oceanBridge}`,
    "",
    "Includes idle screenshots, section frames, drawCalls/triangles/RT memory,",
    "fps/workMs, transfer hints, and a short rAF frame trace on 1440×900.",
    "",
  ].join("\n"),
);

const missing = report.idle.filter((entry) => {
  const m = entry.metrics ?? {};
  return !m.drawCalls || !m.triangles || !m.textureMemoryEstimateMb || !m.workMsP95 || !m.fps;
});
if (missing.length > 0) {
  process.stderr.write(
    `WARNING: missing required metrics on: ${missing.map((entry) => entry.name).join(", ")}\n`,
  );
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({
  ok: missing.length === 0,
  label,
  idle: report.idle.length,
  sections: report.sections.length,
  frameTraces: report.frameTraces.length,
}, null, 2)}\n`);
