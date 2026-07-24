#!/usr/bin/env node
/**
 * Phase-5 mobile touch probe: 390×844 coarse viewport, live low-tier fluid,
 * tap shockwave, no DeviceOrientation permission spam on load.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launchChrome, waitForHeroReady, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outDir = join(process.cwd(), ".tmp", "mobile-touch");
mkdirSync(outDir, { recursive: true });

const browser = await launchChrome({
  defaultViewport: null,
});

const page = await browser.newPage();
await page.setViewport({
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

const logs = [];
page.on("console", (msg) => {
  const text = msg.text();
  if (/permission|DeviceOrientation|Orientation|error|Error|GL_/i.test(text)) {
    logs.push(`[${msg.type()}] ${text}`);
  }
});
page.on("pageerror", (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto(`${baseUrl}/`, { waitUntil: "networkidle0", timeout: 60000 });
await waitForHeroReady(page, 45000);
await delay(800);

const snap = async (name) => {
  const path = join(outDir, `${name}.png`);
  await page.screenshot({ path, type: "png" });
  console.log(`shot ${name}`);
  return path;
};

const readState = () => page.evaluate(() => {
  const root = document.querySelector(".fluid-canvas");
  const canvas = document.querySelector(".fluid-canvas canvas");
  const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
  return {
    fluid: root?.dataset.fluid ?? null,
    quality: root?.dataset.quality ?? null,
    boot: root?.dataset.boot ?? null,
    renderSize: canvas?.dataset.renderSize ?? null,
    fps: canvas?.dataset.fps ?? null,
    workMsP95: canvas?.dataset.workMsP95 ?? null,
    deviceTilt: canvas?.dataset.deviceTilt ?? null,
    injection: canvas?.dataset.waterInjectionCount ?? null,
    overflowX,
    coarse: matchMedia("(pointer: coarse)").matches,
    inner: { w: window.innerWidth, h: window.innerHeight },
  };
});

await snap("00-idle");
const idle = await readState();
console.log("idle", JSON.stringify(idle));

// Finger tap — use CDP touch when available, else mouse (hasTouch viewport).
const tapX = 196;
const tapY = 420;
const injectionBefore = Number(idle.injection ?? 0);
try {
  await page.touchscreen.tap(tapX, tapY);
} catch {
  await page.mouse.click(tapX, tapY);
}
await delay(120);
await snap("01-tap-120ms");
await delay(220);
await snap("02-tap-340ms");
const afterTap = await readState();
console.log("afterTap", JSON.stringify(afterTap));

// Confirm no permission prompt was forced on load: gesture may enable tilt
// path, but console must not spam permission errors.
await delay(200);
const afterGesture = await readState();

const permissionSpam = logs.filter((line) =>
  /requestPermission|Permission denied|DeviceOrientationEvent/i.test(line)
    && !/denied|unavailable|off/i.test(line));

const report = {
  ok:
    (idle.fluid === "ready" || idle.fluid === "static")
    && idle.quality === "low"
    && !idle.overflowX
    && permissionSpam.length === 0,
  idle,
  afterTap,
  afterGesture,
  injectionDelta: Number(afterTap.injection ?? 0) - injectionBefore,
  logs,
  permissionSpam,
};

writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ok: report.ok, quality: idle.quality, fluid: idle.fluid, fps: afterTap.fps, logs: logs.length }, null, 2));

await browser.close();
process.exit(report.ok ? 0 : 1);
