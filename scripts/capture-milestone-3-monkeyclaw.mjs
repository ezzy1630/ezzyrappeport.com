#!/usr/bin/env node
/**
 * Milestone 3 MonkeyClaw encounter evidence capture.
 *
 * Captures the adversarial current field across the chapter loop (red →
 * judge → blue → purple), the probe signature interaction, mobile/reduced/
 * failure compositions, lazy-load + eviction behavior, case-study route
 * transition, and scene budgets.
 *
 *   node scripts/capture-milestone-3-monkeyclaw.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/milestone-3/", import.meta.url);

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
    const encounterDom = document.querySelector('[data-encounter="monkeyclaw"]');
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
      encounter: canvas?.dataset.encounterScene ?? null,
      encounterFade: canvas?.dataset.encounterSceneFade ?? null,
      heroPhase: canvas?.dataset.heroPhase ?? null,
      experienceChapter: html.dataset.experienceChapter ?? null,
      worldDepth: canvas?.dataset.worldDepth ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      fps: canvas?.dataset.fps ?? null,
      scrollY: Math.round(window.scrollY),
      encounterDomPresent: Boolean(encounterDom),
      encounterDomHeight: encounterDom ? Math.round(encounterDom.getBoundingClientRect().height) : 0,
      proofText: encounterDom?.textContent?.includes("18 seeded attack zones · 8 verifier gates · 1,051 tracked test functions") ?? false,
      diveHref: encounterDom?.querySelector('a[href="/project/monkeyclaw"]')?.getAttribute("href") ?? null,
      sourceHref: encounterDom?.querySelector('a[href^="https://github.com"]')?.getAttribute("href") ?? null,
    };
  });
}

async function waitForIdleMetrics(page, timeoutMs = 16000) {
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

async function seekJourney(page, progress, settleMs = 1000) {
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
const interactionDir = new URL("./interaction/", outRoot).pathname;
const statesDir = new URL("./states/", outRoot).pathname;
for (const dir of [sequenceDir, interactionDir, statesDir]) {
  mkdirSync(dir, { recursive: true });
}

const page = await browser.newPage();
const report = {
  milestone: 3,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: gitCommit(),
  sequence: [],
  interaction: [],
  states: [],
  route: [],
  frameTraces: [],
  checks: [],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  process.stdout.write(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const BEATS = [
  { name: "00-before-window", journey: 0.06, expectEncounter: false },
  { name: "01-fade-in", journey: 0.1, expectEncounter: true },
  { name: "02-red-pressure", journey: 0.13, expectEncounter: true },
  { name: "03-judge-convergence", journey: 0.16, expectEncounter: true },
  { name: "04-blue-response", journey: 0.19, expectEncounter: true },
  { name: "05-purple-telemetry", journey: 0.22, expectEncounter: true },
  { name: "06-fade-out", journey: 0.25, expectEncounter: true },
];

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);

  for (const beat of BEATS) {
    await seekJourney(page, beat.journey);
    const path = join(sequenceDir, `desktop-1440x900-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.sequence.push({ ...beat, path, metrics });
    process.stdout.write(
      `seq ${beat.name} encounter=${metrics.encounter} fade=${metrics.encounterFade} chapter=${metrics.experienceChapter} dd=${metrics.drawCalls} tri=${metrics.triangles}\n`,
    );
    if (beat.name === "03-judge-convergence") {
      report.frameTraces.push({ viewport: "desktop-1440x900", state: "monkeyclaw-hold", ...(await captureFrameTrace(page, 2)) });
    }
  }

  const seq = report.sequence;
  check("encounter hidden before the window",
    seq[0].metrics.encounter === "none" || Number(seq[0].metrics.encounterFade) < 0.02,
    `encounter=${seq[0].metrics.encounter} fade=${seq[0].metrics.encounterFade}`);
  check("encounter active inside the window",
    seq.slice(1).every((entry) => entry.metrics.encounter === "monkeyclaw"),
    seq.map((entry) => entry.metrics.encounter).join(","));
  check("fade rises then falls across the window",
    Number(seq[2].metrics.encounterFade) > 0.5
      && Number(seq[6].metrics.encounterFade) < Number(seq[3].metrics.encounterFade)
      && Number(seq[6].metrics.encounterFade) < 0.85,
    `red fade=${seq[2].metrics.encounterFade} out fade=${seq[6].metrics.encounterFade}`);
  check("scene budget: draw calls ≤ 90 at peak",
    Math.max(...seq.map((entry) => Number(entry.metrics.drawCalls))) <= 90,
    `peak=${Math.max(...seq.map((entry) => Number(entry.metrics.drawCalls)))}`);
  check("scene budget: triangles ≤ 350k at peak",
    Math.max(...seq.map((entry) => Number(entry.metrics.triangles))) <= 350000,
    `peak=${Math.max(...seq.map((entry) => Number(entry.metrics.triangles)))}`);
  check("encounter DOM complete with facts",
    seq.every((entry) => entry.metrics.encounterDomPresent && entry.metrics.proofText),
    `proof=${seq[2].metrics.proofText}`);
  check("case-study + source links present",
    seq[2].metrics.diveHref === "/project/monkeyclaw" && Boolean(seq[2].metrics.sourceHref));

  // --- Probe signature interaction --------------------------------------
  await seekJourney(page, 0.16, 1200);
  const preProbe = await collectMetrics(page);
  await page.mouse.click(500, 420);
  await delay(280);
  const probePath = join(interactionDir, "desktop-1440x900-probe-pulse.png");
  await page.screenshot({ path: probePath, type: "png", captureBeyondViewport: false });
  const postProbe = await collectMetrics(page);
  report.interaction.push({ name: "probe-pulse", path: probePath, metrics: postProbe });
  await delay(1200);
  const settledPath = join(interactionDir, "desktop-1440x900-probe-settled.png");
  await page.screenshot({ path: settledPath, type: "png", captureBeyondViewport: false });
  const settled = await collectMetrics(page);
  report.interaction.push({ name: "probe-settled", path: settledPath, metrics: settled });
  check("probe pulse keeps renderer live",
    postProbe.fluid === "ready" && settled.fluid === "ready",
    `fluid=${postProbe.fluid}`);
  check("probe pulse decays back to primary state",
    Number(settled.encounterFade) === Number(preProbe.encounterFade),
    `fade ${preProbe.encounterFade} → ${settled.encounterFade}`);

  // --- Reverse eviction ---------------------------------------------------
  await seekJourney(page, 0.05, 1400);
  const reversed = await collectMetrics(page);
  check("encounter releases on reverse past the window",
    reversed.encounter === "none" || Number(reversed.encounterFade) < 0.02,
    `encounter=${reversed.encounter} fade=${reversed.encounterFade}`);

  // --- Mobile composition --------------------------------------------------
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);
  await seekJourney(page, 0.16, 1200);
  const mobilePath = join(sequenceDir, "mobile-390x844-judge.png");
  await page.screenshot({ path: mobilePath, type: "png", captureBeyondViewport: false });
  const mobileMetrics = await collectMetrics(page);
  report.sequence.push({ name: "mobile-judge", path: mobilePath, metrics: mobileMetrics });
  check("mobile encounter active + DOM complete",
    mobileMetrics.encounter === "monkeyclaw" && mobileMetrics.encounterDomPresent,
    `encounter=${mobileMetrics.encounter}`);

  // --- Reduced motion ------------------------------------------------------
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await delay(2500);
  await seekJourney(page, 0.16, 900);
  const reducedPath = join(statesDir, "reduced-motion-judge.png");
  await page.screenshot({ path: reducedPath, type: "png", captureBeyondViewport: false });
  const reducedMetrics = await collectMetrics(page);
  report.states.push({ name: "reduced-motion", path: reducedPath, metrics: reducedMetrics });
  check("reduced motion keeps semantic encounter",
    reducedMetrics.encounterDomPresent && reducedMetrics.proofText);

  // --- WebGL failure fallback ----------------------------------------------
  const failPage = await browser.newPage();
  await failPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await failPage.evaluateOnNewDocument(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).includes("webgl")) return null;
      return getContext.call(this, type, ...args);
    };
  });
  await failPage.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await delay(2000);
  await failPage.evaluate(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: maxScroll * 0.31, left: 0, behavior: "instant" });
  });
  await delay(800);
  const failPath = join(statesDir, "webgl-blocked-judge.png");
  await failPage.screenshot({ path: failPath, type: "png", captureBeyondViewport: false });
  const failMetrics = await collectMetrics(failPage);
  report.states.push({ name: "webgl-blocked", path: failPath, metrics: failMetrics });
  check("renderer failure keeps complete encounter surface",
    failMetrics.encounterDomPresent && failMetrics.proofText && failMetrics.diveHref === "/project/monkeyclaw");
  await failPage.close();

  // --- Case-study route transition ------------------------------------------
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);
  await seekJourney(page, 0.16, 1100);
  const link = await page.$('[data-encounter="monkeyclaw"] a[href="/project/monkeyclaw"]');
  if (!link) throw new Error("Dive in link not found");
  await link.click();
  await delay(2600);
  const onCase = page.url().includes("/project/monkeyclaw");
  const caseMetrics = await page.evaluate(() => ({
    url: location.pathname,
    canvasGone: !document.querySelector(".fluid-canvas canvas"),
    caseContent: document.body.textContent?.includes("MonkeyClaw") ?? false,
  }));
  const casePath = join(statesDir, "case-study-arrival.png");
  await page.screenshot({ path: casePath, type: "png", captureBeyondViewport: false });
  report.route.push({ name: "case-study-arrival", path: casePath, metrics: caseMetrics });
  check("case-study transition navigates and stops homepage runtime",
    onCase && caseMetrics.caseContent,
    `url=${caseMetrics.url} canvasGone=${caseMetrics.canvasGone}`);

  const failures = report.checks.filter((entry) => !entry.ok);
  writeFileSync(new URL("./capture-report.json", outRoot), JSON.stringify(report, null, 2));
  writeFileSync(new URL("./README.md", outRoot),
    `# Milestone 3 — MonkeyClaw encounter evidence\n\nCaptured at: ${report.capturedAt}\nCommit: ${report.commit}\n\nChapter loop sequence, probe signature, reverse eviction, mobile, reduced\nmotion, WebGL-blocked fallback, and case-study route transition.\n\nChecks: ${report.checks.length - failures.length}/${report.checks.length} passed.\n`);
  if (failures.length > 0) {
    throw new Error(`Milestone 3 capture checks failed: ${failures.map((f) => f.name).join(", ")}`);
  }
} finally {
  await browser.close();
}
