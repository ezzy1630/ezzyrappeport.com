#!/usr/bin/env node
/**
 * Phase 2 hero cinematography probe — samples by introProgress milestones.
 * usage: node scripts/probe-hero-cinematography.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, waitForPageCondition, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outDir = new URL("../.tmp/hero-cinematography/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  try {
    sessionStorage.removeItem("portfolio.hero-boot.v1");
    sessionStorage.removeItem("dive-upgrade.hero-breach.v1");
  } catch { /* ignore */ }
});

await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });

const waitFor = (fn, timeoutMs = 22000) => waitForPageCondition(page, fn, { timeoutMs, intervalMs: 16 });

const ready = await waitFor(() => {
  const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
  return fluid === "ready" || fluid === "failed" || fluid === "static";
});

const shots = [];
const readState = () => page.evaluate(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  const root = document.querySelector(".fluid-canvas");
  return {
    boot: root?.dataset.boot ?? null,
    entrance: canvas?.dataset.entrance ?? null,
    introProgress: Number(canvas?.dataset.introProgress ?? -1),
    introDuration: canvas?.dataset.introDuration ?? null,
    cameraY: canvas?.dataset.cameraY ?? null,
    cameraZ: canvas?.dataset.cameraZ ?? null,
    cameraFov: canvas?.dataset.cameraFov ?? null,
    worldDepth: canvas?.dataset.worldDepth ?? null,
    offHero: canvas?.dataset.offHero ?? null,
    workMsP95: canvas?.dataset.workMsP95 ?? null,
    fps: canvas?.dataset.fps ?? null,
  };
});

const capture = async (name) => {
  const path = join(outDir.pathname, `${name}.png`);
  const state = await readState();
  await page.screenshot({ path, type: "png" });
  shots.push({ name, path, state });
  process.stdout.write(`${name}: ${JSON.stringify(state)}\n`);
};

// Early frame while intro is still near zero (deeper camera / letters below).
await waitFor(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  return canvas?.dataset.entrance?.includes("breach") && Number(canvas.dataset.introProgress ?? 1) < 0.2;
}, 8000);
await capture("00-intro-early");

await waitFor(() => Number(document.querySelector(".fluid-canvas canvas")?.dataset.introProgress ?? 0) >= 0.35, 4000);
await capture("01-intro-mid");

await waitFor(() => Number(document.querySelector(".fluid-canvas canvas")?.dataset.introProgress ?? 0) >= 0.7, 4000);
await capture("02-intro-late");

await waitFor(() => Number(document.querySelector(".fluid-canvas canvas")?.dataset.introProgress ?? 0) >= 0.99, 4000);
await delay(200);
await capture("03-live-idle");

await page.evaluate(() => {
  const projects = document.querySelector("#projects");
  if (!projects) return;
  const top = projects.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.32), behavior: "instant" });
});
await waitFor(() => {
  const projects = document.querySelector("#projects");
  if (!projects) return false;
  const rect = projects.getBoundingClientRect();
  return rect.top < window.innerHeight * 0.7;
}, 3000);
await delay(400);
await capture("04-scroll-projects");

await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await waitFor(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  return Boolean(canvas?.dataset.workMsP95) && Number(canvas.dataset.introProgress ?? 0) >= 0.99;
}, 8000);
await delay(500);
const idleMetrics = await readState();
writeFileSync(join(outDir.pathname, "report.json"), JSON.stringify({ ready, shots, idleMetrics }, null, 2));
process.stdout.write(`ready=${ready} idle=${JSON.stringify(idleMetrics)}\n`);
await browser.close();
