#!/usr/bin/env node
/**
 * Production viewport capture for master-revamp baselines.
 * Uses system Chrome + puppeteer-core so Emulation viewports are exact.
 *
 * usage: node scripts/capture-master-revamp.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/master-revamp/", import.meta.url);

const VIEWPORTS = [
  { name: "01-idle-1728x1117", w: 1728, h: 1117 },
  { name: "02-idle-1440x900", w: 1440, h: 900 },
  { name: "03-idle-1280x720", w: 1280, h: 720 },
  { name: "04-idle-1024x768", w: 1024, h: 768 },
  { name: "05-idle-390x844", w: 390, h: 844, mobile: true },
  { name: "06-idle-375x812", w: 375, h: 812, mobile: true },
];

async function waitForHero(page, timeoutMs = 12000) {
  await waitForHeroReady(page, timeoutMs);
  return page.evaluate(() => ({
    fluid: document.querySelector(".fluid-canvas")?.dataset.fluid,
    hero: document.documentElement.dataset.heroRenderer,
    boot: document.querySelector(".fluid-canvas")?.dataset.boot,
  }));
}

async function waitForIdleMetrics(page, timeoutMs = 12000) {
  await waitForHeroReady(page, timeoutMs);
  // Collect steady-state metrics after entrance settle + sample window.
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const canvas = document.querySelector(".fluid-canvas canvas");
      return Boolean(canvas?.dataset.fps && canvas?.dataset.workMsP95);
    });
    if (ready) return;
    await delay(250);
  }
}

async function captureIdle(page, viewport, folder) {
  await page.setViewport({
    width: viewport.w,
    height: viewport.h,
    deviceScaleFactor: 1,
    isMobile: Boolean(viewport.mobile),
    hasTouch: Boolean(viewport.mobile),
  });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  const state = await waitForHero(page);
  await waitForIdleMetrics(page, 10000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(250);
  const path = join(folder, `${viewport.name}.png`);
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, type: "png", captureBeyondViewport: false });
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector(".fluid-canvas canvas");
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid,
      boot: document.querySelector(".fluid-canvas")?.dataset.boot,
      hero: document.documentElement.dataset.heroRenderer,
      renderSize: canvas?.dataset.renderSize,
      frameMsP95: canvas?.dataset.frameMsP95,
      frameMsWorst: canvas?.dataset.frameMsWorst,
      workMsP95: canvas?.dataset.workMsP95,
      workMsWorst: canvas?.dataset.workMsWorst,
      fps: canvas?.dataset.fps,
      adaptiveScale: canvas?.dataset.adaptiveScale,
      worldDepth: canvas?.dataset.worldDepth,
      glyphCount: canvas?.dataset.glyphCount,
      inner: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  return { path, state, metrics };
}

async function captureSequences(page, folder) {
  await page.setViewport({ width: 1728, height: 1117, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForHero(page);
  await waitForIdleMetrics(page, 4000);

  const shots = [];
  const snap = async (name) => {
    const path = join(folder, `${name}.png`);
    await page.screenshot({ path, type: "png" });
    shots.push(path);
  };

  await snap("01-idle");
  await page.mouse.move(320, 490, { steps: 12 });
  await delay(180);
  await page.mouse.move(980, 430, { steps: 24 });
  await delay(220);
  await snap("02-slow-wake");
  await page.mouse.move(240, 520);
  await page.mouse.move(1400, 380, { steps: 6 });
  await delay(160);
  await snap("03-fast-wake");
  await page.mouse.move(920, 480);
  await page.mouse.down();
  await delay(120);
  await snap("04-press");
  await delay(700);
  await snap("05-hold");
  await page.mouse.up();
  await delay(280);
  await snap("06-release");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 1.2, behavior: "instant" }));
  await delay(500);
  await snap("07-scroll-away");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await delay(500);
  await snap("08-return");
  await page.goto(`${baseUrl}/project/monkeyclaw`, { waitUntil: "networkidle0", timeout: 60000 });
  await page.waitForSelector("h1", { timeout: 15000 });
  await delay(400);
  await snap("09-route-change");
  return shots;
}

const browser = await launchChrome({
  defaultViewport: null,
});

const baselineDir = new URL("baseline/", outRoot).pathname;
const sequenceDir = new URL("sequences/", outRoot).pathname;
mkdirSync(baselineDir, { recursive: true });
mkdirSync(sequenceDir, { recursive: true });

const page = await browser.newPage();
const report = { baseUrl, capturedAt: new Date().toISOString(), idle: [], sequences: [] };

try {
  for (const viewport of VIEWPORTS) {
    const result = await captureIdle(page, viewport, baselineDir);
    report.idle.push({ ...viewport, ...result });
    process.stdout.write(`captured ${viewport.name} fluid=${result.metrics.fluid} fps=${result.metrics.fps}\n`);
  }
  report.sequences = await captureSequences(page, sequenceDir);
  process.stdout.write(`captured ${report.sequences.length} sequence frames\n`);
} finally {
  await browser.close();
}

writeFileSync(join(baselineDir, "capture-report.json"), JSON.stringify(report, null, 2));

// Budget: workMsP95 is real render cost (plan <=17ms). frameMs* are rAF
// intervals (~16.7ms at 60Hz). Fail on real work overruns, clear dropped-frame
// patterns (fps < 40), or long hitches (>=50ms) after boot.
const frameBudgetViolations = report.idle.filter((entry) => {
  const workP95 = Number(entry.metrics?.workMsP95);
  const fps = Number(entry.metrics?.fps);
  const frameWorst = Number(entry.metrics?.frameMsWorst);
  const workFail = Number.isFinite(workP95) && workP95 > 17;
  const fpsFail = Number.isFinite(fps) && fps < 30;
  const hitchFail = Number.isFinite(frameWorst) && frameWorst >= 50;
  const missingMetrics = !Number.isFinite(workP95) || !Number.isFinite(fps);
  // workMs is the authoritative GPU/CPU cost; fps/hitch use stall-filtered windows.
  return workFail || fpsFail || hitchFail || missingMetrics;
});
if (frameBudgetViolations.length > 0) {
  const detail = frameBudgetViolations
    .map((entry) => `${entry.name}=workP95:${entry.metrics.workMsP95}ms fps:${entry.metrics.fps} worst:${entry.metrics.frameMsWorst}ms`)
    .join(", ");
  process.stderr.write(`frame budget exceeded (workMsP95>17 | fps<30 | frameMsWorst>=50 | missing): ${detail}\n`);
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({
  ok: frameBudgetViolations.length === 0,
  idle: report.idle.length,
  sequences: report.sequences.length,
  frameBudgetViolations: frameBudgetViolations.length,
}, null, 2)}\n`);
