#!/usr/bin/env node
/**
 * Phase 6 fallback audit: reduced-motion, Save-Data, case + 404 routes.
 * usage: node scripts/probe-phase6-fallbacks.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, waitForHeroReady, waitForSelector, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outDir = new URL("../.verification/phase6-fallbacks/", import.meta.url).pathname;

mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({
  defaultViewport: { width: 1440, height: 900 },
});

const report = { baseUrl, capturedAt: new Date().toISOString(), cases: [] };

async function captureCase(name, fn) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", (err) => consoleErrors.push(err.message));
  page.on("response", (res) => {
    if (res.status() >= 400 && !res.url().includes("favicon")) {
      consoleErrors.push(`${res.status()} ${res.url()}`);
    }
  });

  try {
    const result = await fn(page);
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
    report.cases.push({ name, ...result, consoleErrors });
  } finally {
    await page.close();
  }
}

async function readPageState(page) {
  return page.evaluate(() => {
    const veil = document.querySelector(".loading-veil");
    const canvas = document.querySelector(".fluid-canvas");
    const main = document.getElementById("main-content");
    return {
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: navigator.connection?.saveData ?? null,
      heroRenderer: document.documentElement.dataset.heroRenderer ?? null,
      fluid: canvas?.dataset.fluid ?? null,
      boot: canvas?.dataset.boot ?? null,
      veilPresent: Boolean(veil),
      veilReady: veil?.dataset.ready ?? null,
      veilOpacity: veil ? getComputedStyle(veil).opacity : null,
      mainVisible: main ? getComputedStyle(main).visibility !== "hidden" : null,
      bodyTextLen: document.body?.innerText?.length ?? 0,
      title: document.title,
    };
  });
}

async function waitForUsableHome(page, timeoutMs = 12000) {
  await waitForHeroReady(page, timeoutMs);
  await page.waitForFunction(() => {
    const veil = document.querySelector(".loading-veil");
    const textLen = document.body?.innerText?.length ?? 0;
    return textLen > 200 && (!veil || veil.dataset.ready === "true" || getComputedStyle(veil).opacity === "0");
  }, { timeout: timeoutMs }).catch(() => undefined);
  await delay(300);
}

// 1. prefers-reduced-motion: reduce on home
await captureCase("01-home-reduced-motion", async (page) => {
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForUsableHome(page, 12000);
  const state = await readPageState(page);
  const usable = state.bodyTextLen > 200 && !state.veilPresent;
  const canvasStatic =
    state.fluid === "static" || state.fluid === "ready" || state.heroRenderer === "ready";
  return {
    ...state,
    pass: usable && canvasStatic,
    notes: usable
      ? state.veilPresent
        ? "Veil still present after settle"
        : "Page usable, veil dismissed"
      : "Page content too thin or blocked",
  };
});

// 2. Save-Data via CDP network conditions (Chrome supports saveData flag)
await captureCase("02-home-save-data", async (page) => {
  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
    latency: 400,
    connectionType: "cellular2g",
  });
  // Inject saveData before navigation via init script
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get() {
        return {
          saveData: true,
          effectiveType: "2g",
          downlink: 0.05,
          rtt: 800,
          addEventListener: () => {},
          removeEventListener: () => {},
        };
      },
    });
  });
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 90000 });
  await waitForUsableHome(page, 12000);
  const state = await readPageState(page);
  const usable = state.bodyTextLen > 200 && !state.veilPresent;
  return {
    ...state,
    pass: usable && (state.fluid === "static" || state.heroRenderer === "static"),
    notes:
      state.fluid === "static" || state.heroRenderer === "static"
        ? "Static path active under Save-Data"
        : `Fluid=${state.fluid} hero=${state.heroRenderer} (expected static)`,
  };
});

// 3. Case study
await captureCase("03-project-monkeyclaw", async (page) => {
  await page.goto(`${baseUrl}/project/monkeyclaw`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForSelector(page, "h1", { timeoutMs: 15000 });
  await delay(300);
  const state = await readPageState(page);
  const hasCaseContent = await page.evaluate(() =>
    Boolean(document.querySelector("h1")?.textContent?.toLowerCase().includes("monkey")),
  );
  return {
    ...state,
    pass: hasCaseContent && state.bodyTextLen > 300,
    notes: hasCaseContent ? "Case page rendered" : "Missing expected case heading",
  };
});

// 4. 404
await captureCase("04-404-not-found", async (page) => {
  await page.goto(`${baseUrl}/this-route-does-not-exist-404`, {
    waitUntil: "networkidle0",
    timeout: 60000,
  });
  await waitForSelector(page, "h1, .not-found__eyebrow", { timeoutMs: 10000 });
  await delay(200);
  const state = await readPageState(page);
  const is404 = await page.evaluate(() => {
    const eyebrow = document.querySelector(".not-found__eyebrow")?.textContent?.trim() ?? "";
    const h1 = document.querySelector("h1")?.textContent?.toLowerCase() ?? "";
    return eyebrow === "404" || h1.includes("not found") || h1.includes("drifted");
  });
  return {
    ...state,
    pass: is404,
    notes: is404 ? "404 page rendered" : "Unexpected 404 content",
  };
});

await browser.close();

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

const failed = report.cases.filter((c) => !c.pass);
process.exit(failed.length > 0 ? 1 : 0);
