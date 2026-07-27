#!/usr/bin/env node
/**
 * Milestone 1 hero evidence capture.
 *
 * Captures desktop/mobile rest frames, interaction states, reduced-motion,
 * renderer-failure posters, and a short frame trace — while confirming
 * below-fold sections still render.
 *
 *   node scripts/capture-milestone-1-hero.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/milestone-1/", import.meta.url);

const VIEWPORTS = [
  { name: "desktop-1440x900", w: 1440, h: 900 },
  { name: "desktop-1280x720", w: 1280, h: 720 },
  { name: "mobile-390x844", w: 390, h: 844, mobile: true },
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
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
      boot: document.querySelector(".fluid-canvas")?.dataset.boot ?? null,
      hero: html.dataset.heroRenderer ?? null,
      glyphMaterial: canvas?.dataset.glyphMaterial ?? null,
      opticalMedium: canvas?.dataset.opticalMedium ?? null,
      opticalTier: canvas?.dataset.opticalTier ?? null,
      refractionTaps: canvas?.dataset.refractionTaps ?? null,
      dispersionStrength: canvas?.dataset.dispersionStrength ?? null,
      glyphInteraction: canvas?.dataset.glyphInteraction ?? null,
      waterSection: html.dataset.waterSection ?? null,
      experienceChapter: html.dataset.experienceChapter ?? null,
      oceanBridge: Boolean(document.querySelector("[data-ocean-bridge]")),
      renderSize: canvas?.dataset.renderSize ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      fps: canvas?.dataset.fps ?? null,
      adaptiveScale: canvas?.dataset.adaptiveScale ?? null,
      worldDepth: canvas?.dataset.worldDepth ?? null,
      glyphCount: canvas?.dataset.glyphCount ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      textureMemoryEstimateMb: canvas?.dataset.textureMemoryEstimateMb ?? null,
      impulseBudget: canvas?.dataset.impulseBudget ?? null,
      impulseScale: canvas?.dataset.impulseScale ?? null,
      projectsPresent: Boolean(document.querySelector("#projects")),
      aboutPresent: Boolean(document.querySelector("#about")),
      contactPresent: Boolean(document.querySelector("#contact")),
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
      return Boolean(canvas?.dataset.fps && canvas?.dataset.workMsP95 && canvas?.dataset.drawCalls);
    });
    if (ready) return;
    await delay(250);
  }
}

async function captureFrameTrace(page, seconds = 2) {
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

async function pointerAtGlyphCenter(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".fluid-canvas canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    // Aim slightly left of optical center so we hit the denser EZZY cluster.
    return {
      x: rect.left + rect.width * 0.42,
      y: rect.top + rect.height * 0.40,
    };
  });
}

async function forceQualityTier(page, tier) {
  await page.evaluateOnNewDocument((forcedTier) => {
    Object.defineProperty(navigator, "deviceMemory", { get: () => (forcedTier === "balanced" ? 4 : 8) });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => (forcedTier === "balanced" ? 4 : 8) });
    try {
      const matchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        if (forcedTier === "balanced" && query.includes("pointer: coarse")) {
          return { matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } };
        }
        return matchMedia(query);
      };
    } catch {
      // ignore
    }
  }, tier);
}

const browser = await launchChrome({ defaultViewport: null });
const restDir = new URL("./rest/", outRoot).pathname;
const interactionDir = new URL("./interaction/", outRoot).pathname;
const reducedDir = new URL("./reduced-motion/", outRoot).pathname;
const failureDir = new URL("./failure/", outRoot).pathname;
const sectionsDir = new URL("./sections/", outRoot).pathname;
for (const dir of [restDir, interactionDir, reducedDir, failureDir, sectionsDir]) {
  mkdirSync(dir, { recursive: true });
}

const page = await browser.newPage();
const report = {
  milestone: 1,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: gitCommit(),
  rest: [],
  interaction: [],
  reducedMotion: [],
  failure: [],
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
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await waitForIdleMetrics(page, 14000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(400);

    const restPath = join(restDir, `${viewport.name}.png`);
    mkdirSync(dirname(restPath), { recursive: true });
    await page.screenshot({ path: restPath, type: "png", captureBeyondViewport: false });
    const restMetrics = await collectMetrics(page);
    const frameTrace = viewport.name === "desktop-1440x900"
      ? await captureFrameTrace(page, 2)
      : null;
    if (frameTrace) report.frameTraces.push({ viewport: viewport.name, state: "rest", ...frameTrace });
    report.rest.push({ ...viewport, path: restPath, metrics: restMetrics, frameTrace });
    if (!restMetrics.fluid || !restMetrics.fps || !restMetrics.opticalTier) {
      throw new Error(`Rest capture failed for ${viewport.name}: missing fluid/fps/opticalTier`);
    }
    process.stdout.write(
      `rest ${viewport.name} material=${restMetrics.glyphMaterial} medium=${restMetrics.opticalMedium} fps=${restMetrics.fps} workP95=${restMetrics.workMsP95}\n`,
    );

    // Hover / approach probe
    const point = await pointerAtGlyphCenter(page);
    if (point && !viewport.mobile) {
      await page.mouse.move(point.x, point.y);
      await delay(350);
      const hoverPath = join(interactionDir, `${viewport.name}-hover.png`);
      await page.screenshot({ path: hoverPath, type: "png", captureBeyondViewport: false });
      report.interaction.push({
        ...viewport,
        state: "hover",
        path: hoverPath,
        metrics: await collectMetrics(page),
      });

      await page.mouse.down();
      await delay(450);
      const holdPath = join(interactionDir, `${viewport.name}-hold.png`);
      await page.screenshot({ path: holdPath, type: "png", captureBeyondViewport: false });
      report.interaction.push({
        ...viewport,
        state: "hold",
        path: holdPath,
        metrics: await collectMetrics(page),
      });

      await page.mouse.move(point.x + 28, point.y - 18, { steps: 6 });
      await delay(200);
      const dragPath = join(interactionDir, `${viewport.name}-drag.png`);
      await page.screenshot({ path: dragPath, type: "png", captureBeyondViewport: false });
      report.interaction.push({
        ...viewport,
        state: "drag",
        path: dragPath,
        metrics: await collectMetrics(page),
      });

      await page.mouse.up();
      await delay(350);
      const releasePath = join(interactionDir, `${viewport.name}-release.png`);
      await page.screenshot({ path: releasePath, type: "png", captureBeyondViewport: false });
      report.interaction.push({
        ...viewport,
        state: "release",
        path: releasePath,
        metrics: await collectMetrics(page),
      });

      // Click-storm + cancel-while-holding proof.
      await page.mouse.up().catch(() => {});
      for (let i = 0; i < 8; i += 1) {
        await page.mouse.click(point.x + (i % 3) * 6, point.y - (i % 2) * 4, { delay: 20 });
      }
      await delay(150);
      await page.mouse.move(point.x, point.y);
      await page.mouse.down();
      await delay(120);
      // Cancel while still holding — do not mouse.up first.
      await page.evaluate((coords) => {
        window.dispatchEvent(new PointerEvent("pointercancel", {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          clientX: coords.x,
          clientY: coords.y,
        }));
      }, point);
      await delay(250);
      const cancelPath = join(interactionDir, `${viewport.name}-cancel.png`);
      await page.screenshot({ path: cancelPath, type: "png", captureBeyondViewport: false });
      const cancelMetrics = await collectMetrics(page);
      const stormTrace = viewport.name === "desktop-1440x900"
        ? await captureFrameTrace(page, 1.5)
        : null;
      if (stormTrace) report.frameTraces.push({ viewport: viewport.name, state: "click-storm", ...stormTrace });
      report.interaction.push({
        ...viewport,
        state: "cancel-after-storm",
        path: cancelPath,
        metrics: cancelMetrics,
        frameTrace: stormTrace,
      });
      await page.mouse.up().catch(() => {});
    }

    // Reduced motion
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
    await waitForIdleMetrics(page, 12000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(300);
    const reducedPath = join(reducedDir, `${viewport.name}.png`);
    await page.screenshot({ path: reducedPath, type: "png", captureBeyondViewport: false });
    report.reducedMotion.push({
      ...viewport,
      path: reducedPath,
      metrics: await collectMetrics(page),
    });
    process.stdout.write(`reduced ${viewport.name}\n`);
  }

  // Forced WebGL failure → semantic/non-realtime poster path.
  // Fresh page + stub BEFORE navigation so the live hero never boots.
  await page.close().catch(() => {});
  const failurePage = await browser.newPage();
  await failurePage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await failurePage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await failurePage.evaluateOnNewDocument(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (type === "webgl2" || type === "webgl" || type === "experimental-webgl") {
        return null;
      }
      return original.call(this, type, ...args);
    };
  });
  await failurePage.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await delay(1200);
  const failurePath = join(failureDir, "desktop-1440x900-webgl-blocked.png");
  await failurePage.screenshot({ path: failurePath, type: "png", captureBeyondViewport: false });
  const failureMetrics = await collectMetrics(failurePage);
  report.failure.push({
    name: "webgl-blocked",
    path: failurePath,
    metrics: failureMetrics,
  });
  process.stdout.write(`failure webgl-blocked fluid=${failureMetrics.fluid} hero=${failureMetrics.hero}\n`);
  await failurePage.close();

  // Balanced-tier rest frame (force mid quality via hardware signals).
  const balancedPage = await browser.newPage();
  await forceQualityTier(balancedPage, "balanced");
  await balancedPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await balancedPage.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(balancedPage, 14000);
  await balancedPage.evaluate(() => window.scrollTo(0, 0));
  await delay(400);
  const balancedPath = join(restDir, "desktop-1440x900-balanced.png");
  await balancedPage.screenshot({ path: balancedPath, type: "png", captureBeyondViewport: false });
  const balancedMetrics = await collectMetrics(balancedPage);
  report.rest.push({
    name: "desktop-1440x900-balanced",
    w: 1440,
    h: 900,
    path: balancedPath,
    metrics: balancedMetrics,
  });
  process.stdout.write(
    `rest balanced material=${balancedMetrics.glyphMaterial} tier=${balancedMetrics.opticalTier} taps=${balancedMetrics.refractionTaps} dispersion=${balancedMetrics.dispersionStrength}\n`,
  );
  await balancedPage.close();

  // Below-fold still present and captureable (fresh page without WebGL stub).
  const sectionPage = await browser.newPage();
  await sectionPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await sectionPage.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(sectionPage, 10000);
  for (const shot of [
    { name: "projects", selector: "#projects" },
    { name: "about", selector: "#about" },
    { name: "contact", selector: "#contact" },
  ]) {
    await sectionPage.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const top = window.scrollY + el.getBoundingClientRect().top - 64;
      window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    }, shot.selector);
    await delay(350);
    const path = join(sectionsDir, `1440x900-${shot.name}.png`);
    await sectionPage.screenshot({ path, type: "png", captureBeyondViewport: false });
    report.sections.push({ ...shot, path, metrics: await collectMetrics(sectionPage) });
    process.stdout.write(`section ${shot.name}\n`);
  }
  await sectionPage.close();
} finally {
  await browser.close();
}

writeFileSync(join(new URL("./", outRoot).pathname, "capture-report.json"), JSON.stringify(report, null, 2));
writeFileSync(
  join(new URL("./", outRoot).pathname, "README.md"),
  [
    "# Milestone 1 — hero optics evidence",
    "",
    `Captured at: ${report.capturedAt}`,
    `Commit: ${report.commit ?? "unknown"}`,
    "",
    "Includes rest, hover/hold/drag/release, reduced-motion, static/failure,",
    "below-fold section frames, and a short rAF frame trace on 1440×900.",
    "",
  ].join("\n"),
);

process.stdout.write(`${JSON.stringify({
  ok: true,
  rest: report.rest.length,
  interaction: report.interaction.length,
  reducedMotion: report.reducedMotion.length,
  failure: report.failure.length,
  sections: report.sections.length,
  frameTraces: report.frameTraces.length,
}, null, 2)}\n`);
