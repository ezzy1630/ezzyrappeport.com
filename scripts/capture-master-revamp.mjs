#!/usr/bin/env node
/**
 * Production viewport capture for master-revamp baselines.
 * Uses system Chrome + puppeteer-core so Emulation viewports are exact.
 *
 * usage: node scripts/capture-master-revamp.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3460";
const outRoot = new URL("../.verification/master-revamp/", import.meta.url);
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const require = createRequire(import.meta.url);

async function loadPuppeteer() {
  try {
    return require("puppeteer-core");
  } catch {
    // Install into a temp local cache if missing.
    await new Promise((resolve, reject) => {
      const child = spawn("npm", ["install", "puppeteer-core@24.11.1", "--no-save", "--no-package-lock"], {
        cwd: new URL("..", import.meta.url).pathname,
        stdio: "inherit",
      });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm install failed: ${code}`))));
    });
    return require("puppeteer-core");
  }
}

const VIEWPORTS = [
  { name: "01-idle-1728x1117", w: 1728, h: 1117 },
  { name: "02-idle-1440x900", w: 1440, h: 900 },
  { name: "03-idle-1280x720", w: 1280, h: 720 },
  { name: "04-idle-1024x768", w: 1024, h: 768 },
  { name: "05-idle-390x844", w: 390, h: 844, mobile: true },
  { name: "06-idle-375x812", w: 375, h: 812, mobile: true },
];

async function waitForHero(page, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await page.evaluate(() => ({
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid,
      hero: document.documentElement.dataset.heroRenderer,
      boot: document.querySelector(".fluid-canvas")?.dataset.boot,
    }));
    if (state.fluid === "ready" || state.fluid === "static" || state.fluid === "failed") {
      return state;
    }
    await delay(200);
  }
  return page.evaluate(() => ({
    fluid: document.querySelector(".fluid-canvas")?.dataset.fluid,
    hero: document.documentElement.dataset.heroRenderer,
    boot: document.querySelector(".fluid-canvas")?.dataset.boot,
  }));
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
  await delay(900);
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
      fps: canvas?.dataset.fps,
      adaptiveScale: canvas?.dataset.adaptiveScale,
      worldDepth: canvas?.dataset.worldDepth,
      inner: { w: window.innerWidth, h: window.innerHeight },
    };
  });
  return { path, state, metrics };
}

async function captureSequences(page, folder) {
  await page.setViewport({ width: 1728, height: 1117, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForHero(page);
  await delay(800);

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
  await delay(900);
  await snap("09-route-change");
  return shots;
}

const puppeteer = await loadPuppeteer();
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
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
process.stdout.write(`${JSON.stringify({ ok: true, idle: report.idle.length, sequences: report.sequences.length }, null, 2)}\n`);
