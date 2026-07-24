#!/usr/bin/env node
/**
 * Runtime audit browser verification for kinetic-canvas.
 * usage: node scripts/verify-renderer-runtime-audit.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");
const baseUrl = process.argv[2] ?? "http://127.0.0.1:4310";
const outDir = new URL("../.tmp/renderer-runtime-audit/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function waitFor(page, fn, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.evaluate(fn)) return true;
    await delay(50);
  }
  return false;
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".fluid-canvas canvas");
    const root = document.querySelector(".fluid-canvas");
    const transferred = performance.getEntriesByType("resource")
      .filter((entry) => entry.initiatorType === "script" || entry.name.includes("/_next/static/chunks/"))
      .reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    const chunkNames = performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => name.includes("/_next/static/chunks/"))
      .map((name) => name.split("/").pop());
    return {
      fluid: root?.dataset.fluid ?? null,
      boot: root?.dataset.boot ?? null,
      heroRenderer: document.documentElement.dataset.heroRenderer ?? null,
      quality: root?.dataset.quality ?? null,
      renderGraph: canvas?.dataset.renderGraph ?? null,
      glyphMaterial: canvas?.dataset.glyphMaterial ?? null,
      drawCalls: canvas?.dataset.drawCalls ?? null,
      triangles: canvas?.dataset.triangles ?? null,
      textureMemoryEstimateMb: canvas?.dataset.textureMemoryEstimateMb ?? null,
      fps: canvas?.dataset.fps ?? null,
      frameMsP95: canvas?.dataset.frameMsP95 ?? null,
      workMsP95: canvas?.dataset.workMsP95 ?? null,
      offHero: canvas?.dataset.offHero ?? null,
      motionLoop: canvas?.dataset.motionLoop ?? null,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      consoleErrors: window.__auditConsoleErrors ?? [],
      transferredJsBytes: transferred,
      chunkNames,
      bodyOverflow: document.body.scrollWidth > window.innerWidth + 1,
    };
  });
}

async function runViewport(browser, { name, width, height, mobile, reducedMotion }) {
  const page = await browser.newPage();
  const consoleErrors = [];
  await page.evaluateOnNewDocument(() => {
    window.__auditConsoleErrors = [];
    const push = (args) => {
      try {
        window.__auditConsoleErrors.push(args.map(String).join(" "));
      } catch { /* ignore */ }
    };
    const originalError = console.error.bind(console);
    console.error = (...args) => {
      push(args);
      originalError(...args);
    };
    window.addEventListener("error", (event) => {
      window.__auditConsoleErrors.push(String(event.message || event.error || "error"));
    });
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewport({ width, height, isMobile: Boolean(mobile), deviceScaleFactor: mobile ? 2 : 1 });
  if (reducedMotion) {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  }
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 90000 });
  const ready = await waitFor(page, () => {
    const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
    const hero = document.documentElement.dataset.heroRenderer;
    return fluid === "ready" || fluid === "static" || hero === "ready" || hero === "live";
  }, 30000);

  await delay(reducedMotion ? 800 : 2400);
  const heroPath = join(outDir.pathname, `${name}-hero.png`);
  await page.screenshot({ path: heroPath, fullPage: false });

  // Descend to projects for a second composition check.
  await page.evaluate(() => {
    const target = document.querySelector("#projects");
    target?.scrollIntoView({ behavior: "instant", block: "start" });
    window.scrollBy(0, Math.min(window.innerHeight * 0.35, 280));
  });
  await delay(1600);
  const projectsPath = join(outDir.pathname, `${name}-projects.png`);
  await page.screenshot({ path: projectsPath, fullPage: false });

  const metrics = await collectMetrics(page);
  metrics.ready = ready;
  metrics.pageErrors = consoleErrors;
  metrics.consoleErrors = [...(metrics.consoleErrors || []), ...consoleErrors];

  // Context recovery safety: lose + restore should not throw.
  if (!reducedMotion) {
    const recovery = await page.evaluate(async () => {
      const canvas = document.querySelector(".fluid-canvas canvas");
      if (!canvas) return { ok: false, reason: "no-canvas" };
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return { ok: false, reason: "no-gl" };
      const ext = gl.getExtension("WEBGL_lose_context");
      if (!ext) return { ok: false, reason: "no-lose-ext" };
      ext.loseContext();
      await new Promise((resolve) => setTimeout(resolve, 120));
      ext.restoreContext();
      await new Promise((resolve) => setTimeout(resolve, 800));
      const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
      return { ok: fluid === "ready" || fluid === "starting" || fluid === "recovering", fluid };
    });
    metrics.contextRecovery = recovery;
  }

  await page.close();
  return { name, width, height, reducedMotion: Boolean(reducedMotion), metrics, heroPath, projectsPath };
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
});

const results = [];
results.push(await runViewport(browser, { name: "desktop-1280x720", width: 1280, height: 720 }));
results.push(await runViewport(browser, { name: "mobile-390x844", width: 390, height: 844, mobile: true }));
results.push(await runViewport(browser, {
  name: "desktop-reduced-motion",
  width: 1280,
  height: 720,
  reducedMotion: true,
}));

await browser.close();

const report = {
  baseUrl,
  capturedAt: new Date().toISOString(),
  results,
};
writeFileSync(join(outDir.pathname, "report.json"), JSON.stringify(report, null, 2));

const failures = [];
for (const result of results) {
  const { metrics, name } = result;
  if (!metrics.ready) failures.push(`${name}: renderer not ready`);
  if (metrics.overflowX || metrics.bodyOverflow) failures.push(`${name}: horizontal overflow`);
  const errors = (metrics.consoleErrors || []).filter((line) => !/favicon/i.test(line));
  if (errors.length) failures.push(`${name}: console errors ${errors.slice(0, 3).join(" | ")}`);
  if (result.reducedMotion) {
    if (metrics.motionLoop !== "stopped" && metrics.fluid !== "static") {
      // Frozen composed frame should stop the animated loop after one frame.
      failures.push(`${name}: expected motionLoop=stopped (got ${metrics.motionLoop})`);
    }
  } else if (metrics.glyphMaterial && metrics.glyphMaterial !== "thickness-refraction") {
    failures.push(`${name}: unexpected glyph material ${metrics.glyphMaterial}`);
  }
  if (!result.reducedMotion && metrics.contextRecovery && metrics.contextRecovery.ok === false) {
    failures.push(`${name}: context recovery failed (${metrics.contextRecovery.reason || metrics.contextRecovery.fluid})`);
  }
}

console.log(JSON.stringify(report, null, 2));
if (failures.length) {
  console.error("VERIFY FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("VERIFY PASS");
