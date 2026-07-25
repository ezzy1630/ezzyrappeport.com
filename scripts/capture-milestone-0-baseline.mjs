#!/usr/bin/env node
/**
 * Milestone 0 baseline capture — current homepage before visual milestones.
 * Writes screenshots + frame metrics under .verification/milestone-0/
 *
 * usage: node scripts/capture-milestone-0-baseline.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/milestone-0/", import.meta.url);

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

async function collectMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".fluid-canvas canvas");
    const html = document.documentElement;
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

async function waitForIdleMetrics(page, timeoutMs = 12000) {
  await waitForHeroReady(page, timeoutMs);
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

const browser = await launchChrome({ defaultViewport: null });
const baselineDir = new URL("baseline/", outRoot).pathname;
const sectionsDir = new URL("sections/", outRoot).pathname;
mkdirSync(baselineDir, { recursive: true });
mkdirSync(sectionsDir, { recursive: true });

const page = await browser.newPage();
const report = {
  milestone: 0,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: process.env.M0_COMMIT ?? null,
  idle: [],
  sections: [],
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
    await waitForIdleMetrics(page, 10000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(300);
    const path = join(baselineDir, `${viewport.name}.png`);
    mkdirSync(dirname(path), { recursive: true });
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.idle.push({ ...viewport, path, metrics });
    process.stdout.write(
      `idle ${viewport.name} chapter=${metrics.experienceChapter} fps=${metrics.fps} workP95=${metrics.workMsP95}\n`,
    );
  }

  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page, 8000);
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
    "# Milestone 0 baseline evidence",
    "",
    `Captured at: ${report.capturedAt}`,
    "",
    "Homepage must remain visually unchanged through Milestone 0.",
    "Idle screenshots live in `baseline/`; section frames in `sections/`.",
    "Metrics include fps, workMsP95, worldDepth, experienceChapter, and GLB transfer hints.",
    "",
  ].join("\n"),
);

// Mirror into master-revamp folder name for continuity if empty.
const masterBaseline = new URL("../.verification/master-revamp/baseline/", import.meta.url).pathname;
if (!existsSync(join(masterBaseline, "capture-report.json"))) {
  mkdirSync(masterBaseline, { recursive: true });
  copyFileSync(
    join(baselineDir, "capture-report.json"),
    join(masterBaseline, "capture-report.json"),
  );
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  idle: report.idle.length,
  sections: report.sections.length,
}, null, 2)}\n`);
