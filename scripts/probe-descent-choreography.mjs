#!/usr/bin/env node
/**
 * Phase 3 descent choreography probe — projects / about / contact depth bands.
 * usage: node scripts/probe-descent-choreography.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, waitForPageCondition, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outDir = new URL("../.tmp/descent-choreography/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  try {
    sessionStorage.setItem("portfolio.hero-boot.v1", "1");
    sessionStorage.setItem("dive-upgrade.hero-breach.v1", "1");
  } catch { /* ignore */ }
});

await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60000 });

const waitFor = (fn, timeoutMs = 22000) => waitForPageCondition(page, fn, { timeoutMs, intervalMs: 40 });

await waitFor(() => {
  const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
  return fluid === "ready" || fluid === "failed" || fluid === "static";
});
await delay(400);

const readState = () => page.evaluate(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  const root = document.documentElement;
  const projects = document.getElementById("projects");
  const about = document.getElementById("about");
  const contact = document.getElementById("contact");
  return {
    fluid: document.querySelector(".fluid-canvas")?.dataset.fluid ?? null,
    worldDepth: canvas?.dataset.worldDepth ?? root.style.getPropertyValue("--world-depth"),
    worldCalm: root.style.getPropertyValue("--world-calm"),
    workMsP95: canvas?.dataset.workMsP95 ?? null,
    fps: canvas?.dataset.fps ?? null,
    quality: document.querySelector(".fluid-canvas")?.dataset.quality ?? null,
    discovery: projects?.dataset.discovery ?? null,
    calmBeat: about?.dataset.calmBeat ?? null,
    abyss: contact?.dataset.abyss ?? null,
    abyssArrived: root.dataset.abyssArrived ?? null,
    descentProjects: root.style.getPropertyValue("--descent-projects"),
    descentAbout: root.style.getPropertyValue("--descent-about"),
    descentContact: root.style.getPropertyValue("--descent-contact"),
  };
});

const shots = [];
const capture = async (name) => {
  const path = join(outDir.pathname, `${name}.png`);
  const state = await readState();
  await page.screenshot({ path, type: "png" });
  shots.push({ name, path, state });
  process.stdout.write(`${name}: ${JSON.stringify(state)}\n`);
};

const scrollToSelector = async (selector, align = 0.28) => {
  await page.evaluate((sel, a) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - window.innerHeight * a;
    window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
  }, selector, align);
  await page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }, { timeout: 2000 }, selector).catch(() => undefined);
  await delay(350);
};

await scrollToSelector("#project-etch", 0.25);
await delay(300);
await capture("01-projects-mid");

await scrollToSelector("#about", 0.08);
await delay(350);
await capture("02-about-mid");

await scrollToSelector("#contact", 0.05);
await delay(400);
await capture("03-contact-deep");

// Idle metrics at contact (deep) for workMsP95 budget.
await waitFor(() => {
  const canvas = document.querySelector(".fluid-canvas canvas");
  return Boolean(canvas?.dataset.workMsP95);
}, 8000);
await delay(600);
await capture("04-contact-idle");

writeFileSync(join(outDir.pathname, "report.json"), JSON.stringify({ shots }, null, 2));
await browser.close();

const idle = shots.find((s) => s.name === "04-contact-idle")?.state;
const deep = shots.find((s) => s.name === "03-contact-deep")?.state;
const work = Number(idle?.workMsP95 ?? deep?.workMsP95 ?? NaN);
const ok = (deep?.fluid === "ready" || idle?.fluid === "ready")
  && (!Number.isFinite(work) || work <= 4.5);
process.stdout.write(`\nprobe-descent: ok=${ok} workMsP95=${idle?.workMsP95 ?? deep?.workMsP95}\n`);
process.exit(ok ? 0 : 1);
