#!/usr/bin/env node
// Temporary diagnostic: why does the kinetic canvas stay in poster mode under headless Chrome?
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

const browser = await launchChrome({
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on("console", (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));
page.on("response", (res) => {
  if (res.status() >= 400) logs.push(`[${res.status()}] ${res.url()}`);
});

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
await waitForHeroReady(page, 45000);
// Extra settle so dataset metrics populate after ready.
await delay(1500);

const state = await page.evaluate(() => {
  const el = document.querySelector(".fluid-canvas");
  const canvas = document.querySelector(".fluid-canvas canvas");
  const gl = document.createElement("canvas").getContext("webgl2");
  return {
    dataset: el ? { ...el.dataset } : null,
    canvasDataset: canvas ? { ...canvas.dataset } : null,
    webgl2: Boolean(gl),
    glRenderer: gl ? gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info")?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) : null,
    deviceMemory: navigator.deviceMemory,
    cores: navigator.hardwareConcurrency,
    coarse: matchMedia("(pointer: coarse)").matches,
    finePointer: matchMedia("(pointer: fine)").matches,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: navigator.connection?.saveData,
    effectiveType: navigator.connection?.effectiveType,
    heroRenderer: document.documentElement.dataset.heroRenderer,
  };
});

console.log(JSON.stringify(state, null, 2));
console.log("--- console logs ---");
for (const l of logs) console.log(l);
await browser.close();
