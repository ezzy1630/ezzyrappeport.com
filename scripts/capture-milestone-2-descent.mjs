#!/usr/bin/env node
/**
 * Milestone 2 hero release + descent seam evidence capture.
 *
 * Captures the approved §8.7 choreography: living tension, release, and
 * pass-under sequences; reverse-scroll reconstruction; rapid reversals;
 * deep-link load; fast-scroll frames; and below-fold unchanged checks.
 *
 *   node scripts/capture-milestone-2-descent.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/milestone-2/", import.meta.url);

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
    let glyphMotion = null;
    try {
      glyphMotion = canvas?.dataset.glyphMotion ? JSON.parse(canvas.dataset.glyphMotion) : null;
    } catch {
      glyphMotion = null;
    }
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
      boot: document.querySelector(".fluid-canvas")?.dataset.boot ?? null,
      heroPhase: canvas?.dataset.heroPhase ?? null,
      heroProgress: canvas?.dataset.heroProgress ?? null,
      glyphRelease: canvas?.dataset.glyphRelease ?? null,
      descentBeam: canvas?.dataset.descentBeam ?? null,
      glyphInteraction: canvas?.dataset.glyphInteraction ?? null,
      waterSection: html.dataset.waterSection ?? null,
      experienceChapter: html.dataset.experienceChapter ?? null,
      worldDepth: canvas?.dataset.worldDepth ?? null,
      cameraY: canvas?.dataset.cameraY ?? null,
      cameraZ: canvas?.dataset.cameraZ ?? null,
      cameraFov: canvas?.dataset.cameraFov ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      fps: canvas?.dataset.fps ?? null,
      offHero: canvas?.dataset.offHero ?? null,
      scrollY: Math.round(window.scrollY),
      maxScroll: Math.round(document.documentElement.scrollHeight - window.innerHeight),
      glyphMotion,
      projectsPresent: Boolean(document.querySelector("#projects")),
      aboutPresent: Boolean(document.querySelector("#about")),
      contactPresent: Boolean(document.querySelector("#contact")),
    };
  });
}

async function waitForIdleMetrics(page, timeoutMs = 14000) {
  await waitForHeroReady(page, timeoutMs);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await page.evaluate(() => {
      const canvas = document.querySelector(".fluid-canvas canvas");
      return Boolean(canvas?.dataset.fps && canvas?.dataset.workMsP95 && canvas?.dataset.heroPhase);
    });
    if (ready) return;
    await delay(250);
  }
}

/** Instant scroll to a normalized journey position, then settle past the ease. */
async function seekJourney(page, progress, settleMs = 900) {
  await page.evaluate((p) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * p, left: 0, behavior: "instant" });
  }, progress);
  await delay(settleMs);
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

const browser = await launchChrome({ defaultViewport: null });
const sequenceDir = new URL("./sequence/", outRoot).pathname;
const reversalDir = new URL("./reversal/", outRoot).pathname;
const deepLinkDir = new URL("./deep-link/", outRoot).pathname;
const fastScrollDir = new URL("./fast-scroll/", outRoot).pathname;
const sectionsDir = new URL("./sections/", outRoot).pathname;
for (const dir of [sequenceDir, reversalDir, deepLinkDir, fastScrollDir, sectionsDir]) {
  mkdirSync(dir, { recursive: true });
}

const page = await browser.newPage();
const report = {
  milestone: 2,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: gitCommit(),
  sequence: [],
  reversal: [],
  deepLink: [],
  fastScroll: [],
  sections: [],
  frameTraces: [],
  checks: [],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  process.stdout.write(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

/** Journey positions (desktop end 0.22) → hero local progress. */
const DESKTOP_BEATS = [
  { name: "00-rest", journey: 0, expectPhase: "arrival" },
  { name: "01-living-tension", journey: 0.08, expectPhase: "living" },
  { name: "02-release-early", journey: 0.126, expectPhase: "release" },
  { name: "03-release-late", journey: 0.165, expectPhase: "release" },
  { name: "04-pass-under-early", journey: 0.187, expectPhase: "pass-under" },
  { name: "05-pass-under-late", journey: 0.209, expectPhase: "pass-under" },
  { name: "06-descent-complete", journey: 0.24, expectPhase: "pass-under" },
];

try {
  // --- Desktop descent sequence -----------------------------------------
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page, 14000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);

  const glyphRestBaseline = (await collectMetrics(page)).glyphMotion;

  for (const beat of DESKTOP_BEATS) {
    await seekJourney(page, beat.journey);
    const path = join(sequenceDir, `desktop-1440x900-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.sequence.push({ ...beat, path, metrics });
    process.stdout.write(
      `seq ${beat.name} phase=${metrics.heroPhase} hero=${metrics.heroProgress} release=${metrics.glyphRelease} beam=${metrics.descentBeam} camZ=${metrics.cameraZ}\n`,
    );
    if (beat.name === "03-release-late") {
      const trace = await captureFrameTrace(page, 2);
      report.frameTraces.push({ viewport: "desktop-1440x900", state: "release-hold", ...trace });
    }
  }

  const seq = report.sequence;
  check("sequence phases match contract", seq.every((entry) => entry.metrics.heroPhase === entry.expectPhase),
    seq.map((entry) => `${entry.name}:${entry.metrics.heroPhase}`).join(","));
  check("release master monotonic along descent", seq.every((entry, index) => index === 0
    || Number(entry.metrics.glyphRelease) >= Number(seq[index - 1].metrics.glyphRelease) - 0.02));
  check("camera descends through pass-under",
    Number(seq[5].metrics.cameraZ) > Number(seq[0].metrics.cameraZ) + 0.8,
    `rest camZ=${seq[0].metrics.cameraZ} pass-under camZ=${seq[5].metrics.cameraZ}`);
  check("descent beam ignites near handoff",
    Number(seq[4].metrics.descentBeam) > 0.15 && Number(seq[0].metrics.descentBeam) < 0.05,
    `beam ${seq[0].metrics.descentBeam} → ${seq[4].metrics.descentBeam}`);
  check("letters gone after descent chapter",
    Number(seq[6].metrics.glyphRelease) > 0.97 && seq[6].metrics.offHero === "true",
    `release=${seq[6].metrics.glyphRelease} offHero=${seq[6].metrics.offHero}`);

  // --- Reverse reconstruction -------------------------------------------
  await seekJourney(page, 0.15);
  await delay(400);
  await seekJourney(page, 0, 1400);
  const reversedPath = join(reversalDir, "desktop-1440x900-reversed-to-rest.png");
  await page.screenshot({ path: reversedPath, type: "png", captureBeyondViewport: false });
  const reversedMetrics = await collectMetrics(page);
  report.reversal.push({ name: "reversed-to-rest", path: reversedPath, metrics: reversedMetrics });
  check("reverse returns to living name",
    reversedMetrics.heroPhase === "arrival" || reversedMetrics.heroPhase === "living",
    `phase=${reversedMetrics.heroPhase}`);
  check("reverse reconstructs glyph rest within tolerance",
    Boolean(reversedMetrics.glyphMotion)
      && reversedMetrics.glyphMotion.every((g) => Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6 && g.depth < 0.06),
    reversedMetrics.glyphMotion
      ? `max |dx|=${Math.max(...reversedMetrics.glyphMotion.map((g) => Math.abs(g.dx)))}`
      : "no glyphMotion");
  check("reverse release master returns to zero", Number(reversedMetrics.glyphRelease) < 0.05,
    `release=${reversedMetrics.glyphRelease}`);
  check("rest pose stable against pre-descent baseline",
    Boolean(glyphRestBaseline && reversedMetrics.glyphMotion)
      && reversedMetrics.glyphMotion.every((g, i) => {
        const base = glyphRestBaseline[i];
        return base && Math.abs(g.dx - base.dx) < 4 && Math.abs(g.dy - base.dy) < 4;
      }));

  // Same-position down/up equality (eased state must converge identically).
  await seekJourney(page, 0.15, 1200);
  const downMetrics = await collectMetrics(page);
  const downPath = join(reversalDir, "desktop-1440x900-mid-release-down.png");
  await page.screenshot({ path: downPath, type: "png", captureBeyondViewport: false });
  await seekJourney(page, 0.2, 600);
  await seekJourney(page, 0.15, 1200);
  const upMetrics = await collectMetrics(page);
  const upPath = join(reversalDir, "desktop-1440x900-mid-release-up.png");
  await page.screenshot({ path: upPath, type: "png", captureBeyondViewport: false });
  report.reversal.push(
    { name: "mid-release-down", path: downPath, metrics: downMetrics },
    { name: "mid-release-up", path: upPath, metrics: upMetrics },
  );
  check("down/up hero progress converges",
    Math.abs(Number(downMetrics.heroProgress) - Number(upMetrics.heroProgress)) < 0.03,
    `down=${downMetrics.heroProgress} up=${upMetrics.heroProgress}`);
  check("down/up camera converges",
    Math.abs(Number(downMetrics.cameraZ) - Number(upMetrics.cameraZ)) < 0.08,
    `down camZ=${downMetrics.cameraZ} up camZ=${upMetrics.cameraZ}`);

  // --- Rapid reversals at the release boundary ---------------------------
  for (let cycle = 0; cycle < 8; cycle += 1) {
    await seekJourney(page, cycle % 2 === 0 ? 0.17 : 0.1, 90);
  }
  await seekJourney(page, 0, 1400);
  const stormMetrics = await collectMetrics(page);
  const stormPath = join(reversalDir, "desktop-1440x900-after-rapid-reversals.png");
  await page.screenshot({ path: stormPath, type: "png", captureBeyondViewport: false });
  report.reversal.push({ name: "after-rapid-reversals", path: stormPath, metrics: stormMetrics });
  check("rapid reversals leave finite settled glyphs",
    Number(stormMetrics.glyphRelease) < 0.05
      && Boolean(stormMetrics.glyphMotion)
      && stormMetrics.glyphMotion.every((g) => Number.isFinite(g.dx) && Number.isFinite(g.depth)),
    `release=${stormMetrics.glyphRelease}`);

  // --- Fast scroll never exposes an empty frame --------------------------
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);
  await page.evaluate(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * 0.5, left: 0, behavior: "instant" });
  });
  await delay(120);
  const fastMidPath = join(fastScrollDir, "desktop-1440x900-jump-to-mid.png");
  await page.screenshot({ path: fastMidPath, type: "png", captureBeyondViewport: false });
  const fastMidMetrics = await collectMetrics(page);
  report.fastScroll.push({ name: "jump-to-mid", path: fastMidPath, metrics: fastMidMetrics });
  await page.evaluate(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll, left: 0, behavior: "instant" });
  });
  await delay(120);
  const fastEndPath = join(fastScrollDir, "desktop-1440x900-jump-to-floor.png");
  await page.screenshot({ path: fastEndPath, type: "png", captureBeyondViewport: false });
  const fastEndMetrics = await collectMetrics(page);
  report.fastScroll.push({ name: "jump-to-floor", path: fastEndPath, metrics: fastEndMetrics });
  check("fast scroll keeps live renderer (mid)", fastMidMetrics.fluid === "ready", `fluid=${fastMidMetrics.fluid}`);
  check("fast scroll keeps live renderer (floor)", fastEndMetrics.fluid === "ready", `fluid=${fastEndMetrics.fluid}`);
  check("fast scroll lands released hero", Number(fastMidMetrics.glyphRelease) > 0.6
    || Number(fastMidMetrics.heroProgress) === 1, `release=${fastMidMetrics.glyphRelease}`);

  // --- Deep link into projects (cold load, fresh page) -------------------
  const deepPage = await browser.newPage();
  await deepPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await deepPage.goto(`${baseUrl}/#projects`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(deepPage, 14000);
  // Measure immediately after readiness: the renderer must have snapped to
  // the authored departure state — never a catch-up rise through the frame.
  const deepEarly = await collectMetrics(deepPage);
  const deepPath = join(deepLinkDir, "desktop-1440x900-projects-hash.png");
  await deepPage.screenshot({ path: deepPath, type: "png", captureBeyondViewport: false });
  report.deepLink.push({ name: "projects-hash", path: deepPath, metrics: deepEarly });
  await delay(1200);
  const deepSettled = await collectMetrics(deepPage);
  const deepSettledPath = join(deepLinkDir, "desktop-1440x900-projects-hash-settled.png");
  await deepPage.screenshot({ path: deepSettledPath, type: "png", captureBeyondViewport: false });
  report.deepLink.push({ name: "projects-hash-settled", path: deepSettledPath, metrics: deepSettled });
  check("deep link snaps to authored hero state (no pop)",
    Math.abs(Number(deepSettled.glyphRelease) - Number(deepEarly.glyphRelease)) < 0.08,
    `early=${deepEarly.glyphRelease} settled=${deepSettled.glyphRelease}`);
  check("deep link camera matches scroll position",
    Math.abs(Number(deepSettled.cameraZ) - Number(deepEarly.cameraZ)) < 0.12,
    `early camZ=${deepEarly.cameraZ} settled camZ=${deepSettled.cameraZ}`);
  await deepPage.close();

  // --- Mobile pass-under composition -------------------------------------
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page, 14000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(500);
  for (const beat of [
    { name: "rest", journey: 0 },
    { name: "release", journey: 0.14 },
    { name: "pass-under", journey: 0.215 },
  ]) {
    await seekJourney(page, beat.journey);
    const path = join(sequenceDir, `mobile-390x844-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.sequence.push({ name: `mobile-${beat.name}`, path, metrics });
    process.stdout.write(
      `seq mobile-${beat.name} phase=${metrics.heroPhase} hero=${metrics.heroProgress} release=${metrics.glyphRelease}\n`,
    );
  }

  // --- Below-fold sections remain intact ---------------------------------
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page, 14000);
  for (const section of ["projects", "about", "contact"]) {
    await page.evaluate((id) => {
      document.querySelector(`#${id}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    }, section);
    await delay(700);
    const path = join(sectionsDir, `1440x900-${section}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.sections.push({ name: section, path, metrics });
  }
  check("below-fold sections present",
    report.sections.every((entry) => entry.metrics.projectsPresent && entry.metrics.aboutPresent && entry.metrics.contactPresent));

  const failures = report.checks.filter((entry) => !entry.ok);
  writeFileSync(
    new URL("./capture-report.json", outRoot),
    JSON.stringify(report, null, 2),
  );
  writeFileSync(
    new URL("./README.md", outRoot),
    `# Milestone 2 — hero release and descent seam evidence\n\nCaptured at: ${report.capturedAt}\nCommit: ${report.commit}\n\nIncludes the living/release/pass-under sequence, reverse reconstruction,\nrapid reversals, deep-link load, fast-scroll frames, below-fold sections,\nand a release-hold frame trace on 1440×900.\n\nChecks: ${report.checks.length - failures.length}/${report.checks.length} passed.\n`,
  );
  if (failures.length > 0) {
    throw new Error(`Milestone 2 capture checks failed: ${failures.map((f) => f.name).join(", ")}`);
  }
} finally {
  await browser.close();
}
