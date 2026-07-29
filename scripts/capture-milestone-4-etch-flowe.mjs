#!/usr/bin/env node
/**
 * Milestone 4 Etch + FlowE encounter evidence capture.
 *
 * Captures both verification-ladder and planning-current choreographies
 * across their chapter loops, probe signatures, transition seams from
 * MonkeyClaw, mobile compositions, aggregate budgets, and reversibility.
 *
 *   node scripts/capture-milestone-4-etch-flowe.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = new URL("../.verification/milestone-4/", import.meta.url);

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
    const encounters = {};
    for (const el of document.querySelectorAll("[data-encounter]")) {
      const title = el.querySelector('[class*="title"]');
      const r = el.getBoundingClientRect();
      encounters[el.getAttribute("data-encounter")] = {
        visible: r.top < window.innerHeight && r.bottom > 0,
        title: title?.textContent ?? null,
        titleVisible: title ? (title.getBoundingClientRect().top > 0 && title.getBoundingClientRect().top < window.innerHeight) : false,
      };
    }
    return {
      fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
      encounter: canvas?.dataset.encounterScene ?? null,
      encounterFade: canvas?.dataset.encounterSceneFade ?? null,
      experienceChapter: document.documentElement.dataset.experienceChapter ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      fps: canvas?.dataset.fps ?? null,
      encounters,
      etchProof: Boolean(document.querySelector('[data-encounter="etch"]')?.textContent?.includes("Saved FIFO run · simulation pass · bounded-formal pass · signoff pending")),
      floweProof: Boolean(document.querySelector('[data-encounter="flowe"]')?.textContent?.includes("SwiftUI client · Convex backend · Canvas sync · offline retry")),
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

async function seekEncounter(page, encounterId, progress = 0.42, settleMs = 1000) {
  await page.evaluate(({ id, p }) => {
    const section = document.querySelector(`#project-${id}`);
    if (!(section instanceof HTMLElement)) throw new Error(`Missing encounter section: ${id}`);
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: top + section.offsetHeight * p, left: 0, behavior: "instant" });
  }, { id: encounterId, p: progress });
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
const etchDir = new URL("./etch/", outRoot).pathname;
const floweDir = new URL("./flowe/", outRoot).pathname;
const seamsDir = new URL("./seams/", outRoot).pathname;
for (const dir of [etchDir, floweDir, seamsDir]) {
  mkdirSync(dir, { recursive: true });
}

const page = await browser.newPage();
const report = {
  milestone: 4,
  baseUrl,
  capturedAt: new Date().toISOString(),
  commit: gitCommit(),
  etch: [],
  flowe: [],
  seams: [],
  probes: [],
  frameTraces: [],
  checks: [],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok: Boolean(ok), detail: detail ?? null });
  process.stdout.write(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}\n`);
}

const ETCH_BEATS = [
  { name: "00-intent", journey: 0.28 },
  { name: "01-constraints", journey: 0.32 },
  { name: "02-candidates", journey: 0.36 },
  { name: "03-gates", journey: 0.40 },
  { name: "04-relax", journey: 0.44 },
];
const FLOWE_BEATS = [
  { name: "00-drift", journey: 0.52 },
  { name: "01-group", journey: 0.56 },
  { name: "02-focus", journey: 0.60 },
  { name: "03-contract", journey: 0.64 },
];

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);

  for (const beat of ETCH_BEATS) {
    await seekJourney(page, beat.journey);
    const path = join(etchDir, `desktop-1440x900-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.etch.push({ ...beat, path, metrics });
    process.stdout.write(`etch ${beat.name} scene=${metrics.encounter} chapter=${metrics.experienceChapter} dd=${metrics.drawCalls}\n`);
  }
  for (const beat of FLOWE_BEATS) {
    await seekJourney(page, beat.journey);
    const path = join(floweDir, `desktop-1440x900-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.flowe.push({ ...beat, path, metrics });
    process.stdout.write(`flowe ${beat.name} scene=${metrics.encounter} chapter=${metrics.experienceChapter} dd=${metrics.drawCalls}\n`);
  }

  const etch = report.etch;
  const flowe = report.flowe;
  check("etch scene active through its chapter",
    etch.every((entry) => entry.metrics.encounter === "etch" && entry.metrics.experienceChapter === "etch"),
    etch.map((entry) => `${entry.metrics.encounter}/${entry.metrics.experienceChapter}`).join(","));
  check("flowe scene active through its chapter",
    flowe.every((entry) => entry.metrics.encounter === "flowe" && entry.metrics.experienceChapter === "flowe"),
    flowe.map((entry) => `${entry.metrics.encounter}/${entry.metrics.experienceChapter}`).join(","));
  check("etch copy matches scene (ETCH title visible during chapter)",
    etch.some((entry) => entry.metrics.encounters.etch?.titleVisible),
    etch.map((entry) => entry.metrics.encounters.etch?.titleVisible).join(","));
  check("flowe copy matches scene (FLOWE title visible during chapter)",
    flowe.some((entry) => entry.metrics.encounters.flowe?.titleVisible));
  check("etch facts present (signoff pending honest)",
    etch.every((entry) => entry.metrics.etchProof));
  check("flowe facts present",
    flowe.every((entry) => entry.metrics.floweProof));
  const peakDraw = Math.max(
    ...etch.map((entry) => Number(entry.metrics.drawCalls)),
    ...flowe.map((entry) => Number(entry.metrics.drawCalls)),
  );
  const peakTri = Math.max(
    ...etch.map((entry) => Number(entry.metrics.triangles)),
    ...flowe.map((entry) => Number(entry.metrics.triangles)),
  );
  check("aggregate budget: draw calls ≤ 90", peakDraw <= 90, `peak=${peakDraw}`);
  check("aggregate budget: triangles ≤ 350k", peakTri <= 350000, `peak=${peakTri}`);

  // --- Frame traces during chapter holds --------------------------------
  await seekJourney(page, 0.44, 1200);
  report.frameTraces.push({ viewport: "desktop-1440x900", state: "etch-gates-hold", ...(await captureFrameTrace(page, 2)) });
  await seekJourney(page, 0.62, 1200);
  report.frameTraces.push({ viewport: "desktop-1440x900", state: "flowe-focus-hold", ...(await captureFrameTrace(page, 2)) });

  // --- Probe signatures ---------------------------------------------------
  await seekJourney(page, 0.42, 1100);
  await page.mouse.click(430, 470);
  await delay(300);
  const etchProbePath = join(etchDir, "desktop-1440x900-probe-perturb.png");
  await page.screenshot({ path: etchProbePath, type: "png", captureBeyondViewport: false });
  const etchProbe = await collectMetrics(page);
  report.probes.push({ name: "etch-perturb", path: etchProbePath, metrics: etchProbe });
  await delay(1400);
  const etchSettled = await collectMetrics(page);
  check("etch probe perturbation settles back",
    etchProbe.fluid === "ready" && etchSettled.fluid === "ready");

  await seekJourney(page, 0.56, 1100);
  await page.mouse.click(330, 360);
  await delay(300);
  const floweProbePath = join(floweDir, "desktop-1440x900-probe-nudge.png");
  await page.screenshot({ path: floweProbePath, type: "png", captureBeyondViewport: false });
  const floweProbe = await collectMetrics(page);
  report.probes.push({ name: "flowe-nudge", path: floweProbePath, metrics: floweProbe });
  check("flowe probe nudge keeps renderer live", floweProbe.fluid === "ready");

  // --- Causal seams --------------------------------------------------------
  for (const [name, journey] of [["monkeyclaw-to-etch", 0.265], ["etch-to-flowe", 0.5]]) {
    await seekJourney(page, journey, 1100);
    const path = join(seamsDir, `desktop-1440x900-${name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.seams.push({ name, journey, path, metrics });
  }
  check("seams keep one coherent water (renderer live through handoffs)",
    report.seams.every((entry) => entry.metrics.fluid === "ready"));

  // --- Reversibility --------------------------------------------------------
  await seekJourney(page, 0.44, 1000);
  const downMetrics = await collectMetrics(page);
  await seekJourney(page, 0.62, 700);
  await seekJourney(page, 0.44, 1000);
  const upMetrics = await collectMetrics(page);
  check("etch state reconstructs on reverse",
    downMetrics.encounter === upMetrics.encounter
      && Math.abs(Number(downMetrics.encounterFade) - Number(upMetrics.encounterFade)) < 0.03,
    `down=${downMetrics.encounter}@${downMetrics.encounterFade} up=${upMetrics.encounter}@${upMetrics.encounterFade}`);

  // --- Mobile ----------------------------------------------------------------
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);
  for (const [name, encounter] of [["etch-mobile", "etch"], ["flowe-mobile", "flowe"]]) {
    await seekEncounter(page, encounter, 0.42, 1100);
    const path = join(seamsDir, `mobile-390x844-${name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.seams.push({ name, encounter, path, metrics });
    check(`${name} active with complete DOM`, metrics.fluid === "ready"
      && metrics.encounter === encounter
      && metrics.experienceChapter === encounter,
      `scene=${metrics.encounter} chapter=${metrics.experienceChapter}`);
  }

  const failures = report.checks.filter((entry) => !entry.ok);
  writeFileSync(new URL("./capture-report.json", outRoot), JSON.stringify(report, null, 2));
  writeFileSync(new URL("./README.md", outRoot),
    `# Milestone 4 — Etch + FlowE encounter evidence\n\nCaptured at: ${report.capturedAt}\nCommit: ${report.commit}\n\nVerification-ladder and planning-current sequences, probe signatures,\ncausal seams, reversibility, mobile compositions, and frame traces.\n\nChecks: ${report.checks.length - failures.length}/${report.checks.length} passed.\n`);
  if (failures.length > 0) {
    throw new Error(`Milestone 4 capture checks failed: ${failures.map((f) => f.name).join(", ")}`);
  }
} finally {
  await browser.close();
}
