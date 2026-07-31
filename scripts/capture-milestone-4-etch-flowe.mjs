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
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outRoot = process.env.PORTFOLIO_CAPTURE_ROOT
  ? resolve(process.env.PORTFOLIO_CAPTURE_ROOT)
  : new URL("../.verification/milestone-4/", import.meta.url).pathname;

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
    const experienceRoot = document.querySelector(".portfolio-root");
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
      experienceChapter: experienceRoot?.dataset.experienceChapter ?? null,
      chapterProgress: Number.parseFloat(
        experienceRoot
          ? getComputedStyle(experienceRoot).getPropertyValue("--experience-chapter-progress")
          : "",
      ),
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      fps: canvas?.dataset.fps ?? null,
      encounters,
      etchProof: (() => {
        const text = document.querySelector('[data-encounter="etch"]')?.textContent ?? "";
        return text.includes("A proven · 50-cycle sim · BMC depth 32 · Yosys 0.66")
          && text.includes("Physical signoff pending");
      })(),
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

async function seekEncounter(page, encounterId, progress = 0.42, settleMs = 1000) {
  await page.evaluate(({ id, p }) => {
    const section = document.querySelector(`#project-${id}`);
    if (!(section instanceof HTMLElement)) throw new Error(`Missing encounter section: ${id}`);
    const top = section.getBoundingClientRect().top + window.scrollY;
    const stickyTravel = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + stickyTravel * p, left: 0, behavior: "instant" });
  }, { id: encounterId, p: progress });
  await delay(settleMs);
}

async function seekChapterProgress(page, encounterId, target, settleMs = 1000) {
  const bounds = await page.evaluate((id) => {
    const section = document.querySelector(`#project-${id}`);
    if (!(section instanceof HTMLElement)) throw new Error(`Missing encounter section: ${id}`);
    const top = section.getBoundingClientRect().top + window.scrollY;
    return {
      low: Math.max(0, top - window.innerHeight * 0.35),
      high: top + section.offsetHeight,
    };
  }, encounterId);
  let low = bounds.low;
  let high = bounds.high;
  for (let iteration = 0; iteration < 14; iteration += 1) {
    const midpoint = (low + high) * 0.5;
    await page.evaluate((scrollY) => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    }, midpoint);
    await delay(32);
    const sample = await page.evaluate(() => {
      const root = document.querySelector(".portfolio-root");
      return {
        chapter: root?.dataset.experienceChapter ?? null,
        progress: Number.parseFloat(
          root ? getComputedStyle(root).getPropertyValue("--experience-chapter-progress") : "",
        ),
      };
    });
    if (sample.chapter === encounterId && sample.progress >= target) high = midpoint;
    else if (sample.chapter === encounterId) low = midpoint;
    else {
      const sectionOrder = ["monkeyclaw", "etch", "flowe", "argyph"];
      if (sectionOrder.indexOf(sample.chapter) < sectionOrder.indexOf(encounterId)) low = midpoint;
      else high = midpoint;
    }
  }
  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
  }, (low + high) * 0.5);
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
const etchDir = join(outRoot, "etch");
const floweDir = join(outRoot, "flowe");
const seamsDir = join(outRoot, "seams");
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
  { name: "00-intent", progress: 0.195 },
  { name: "01-design-spec", progress: 0.26 },
  { name: "02-candidates", progress: 0.38 },
  { name: "03-simulation", progress: 0.5 },
  { name: "04-formal", progress: 0.62 },
  { name: "05-rank", progress: 0.73 },
  { name: "06-physical-blocked", progress: 0.83 },
  { name: "07-proof-dossier", progress: 0.94 },
];
const FLOWE_BEATS = [
  { name: "00a-logo-first-light", progress: 0.125 },
  { name: "00b-logo-draw", progress: 0.155 },
  { name: "00c-logo-formed", progress: 0.185 },
  { name: "01-brain-dump", progress: 0.245 },
  { name: "02-semantic-parse", progress: 0.355 },
  { name: "03-course-context", progress: 0.475 },
  { name: "04-daily-plan", progress: 0.595 },
  { name: "05-focus-live-activity", progress: 0.72 },
  { name: "06-offline-sync", progress: 0.85 },
  { name: "07-morning-brief", progress: 0.96 },
];

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForIdleMetrics(page);

  for (const beat of ETCH_BEATS) {
    await seekChapterProgress(page, "etch", beat.progress);
    const path = join(etchDir, `desktop-1440x900-${beat.name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.etch.push({ ...beat, path, metrics });
    process.stdout.write(`etch ${beat.name} scene=${metrics.encounter} chapter=${metrics.experienceChapter} dd=${metrics.drawCalls}\n`);
  }
  for (const beat of FLOWE_BEATS) {
    await seekChapterProgress(page, "flowe", beat.progress);
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
  await seekChapterProgress(page, "etch", 0.56, 1200);
  report.frameTraces.push({ viewport: "desktop-1440x900", state: "etch-gates-hold", ...(await captureFrameTrace(page, 2)) });
  await seekChapterProgress(page, "flowe", 0.62, 1200);
  report.frameTraces.push({ viewport: "desktop-1440x900", state: "flowe-focus-hold", ...(await captureFrameTrace(page, 2)) });

  // --- Probe signatures ---------------------------------------------------
  await seekChapterProgress(page, "etch", 0.32, 1100);
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

  await seekChapterProgress(page, "flowe", 0.4, 1100);
  await page.mouse.click(330, 360);
  await delay(300);
  const floweProbePath = join(floweDir, "desktop-1440x900-probe-nudge.png");
  await page.screenshot({ path: floweProbePath, type: "png", captureBeyondViewport: false });
  const floweProbe = await collectMetrics(page);
  report.probes.push({ name: "flowe-nudge", path: floweProbePath, metrics: floweProbe });
  check("flowe probe nudge keeps renderer live", floweProbe.fluid === "ready");

  // --- Causal seams --------------------------------------------------------
  for (const [name, encounter] of [["monkeyclaw-to-etch", "monkeyclaw"], ["etch-to-flowe", "etch"]]) {
    await seekEncounter(page, encounter, 0.98, 1100);
    const path = join(seamsDir, `desktop-1440x900-${name}.png`);
    await page.screenshot({ path, type: "png", captureBeyondViewport: false });
    const metrics = await collectMetrics(page);
    report.seams.push({ name, encounter, path, metrics });
  }
  check("seams keep one coherent water (renderer live through handoffs)",
    report.seams.every((entry) => entry.metrics.fluid === "ready"));

  // --- Reversibility --------------------------------------------------------
  await seekChapterProgress(page, "etch", 0.56, 1000);
  const downMetrics = await collectMetrics(page);
  await seekChapterProgress(page, "etch", 0.78, 700);
  await seekChapterProgress(page, "etch", 0.56, 1000);
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
    await seekChapterProgress(page, encounter, 0.5, 1100);
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
  writeFileSync(join(outRoot, "capture-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(join(outRoot, "README.md"),
    `# Milestone 4 — Etch + FlowE encounter evidence\n\nCaptured at: ${report.capturedAt}\nCommit: ${report.commit}\n\nVerification-ladder and planning-current sequences, probe signatures,\ncausal seams, reversibility, mobile compositions, and frame traces.\n\nChecks: ${report.checks.length - failures.length}/${report.checks.length} passed.\n`);
  if (failures.length > 0) {
    throw new Error(`Milestone 4 capture checks failed: ${failures.map((f) => f.name).join(", ")}`);
  }
} finally {
  await browser.close();
}
