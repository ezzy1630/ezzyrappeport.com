/**
 * Shared Chrome + puppeteer-core launcher for capture/probe scripts.
 * Uses the package-locked puppeteer-core; discovers Chrome via env then
 * common macOS/Linux install paths.
 */
import { accessSync, constants } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);

const CANDIDATE_PATHS = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/snap/bin/chromium",
].filter(Boolean);

export function resolveChromePath() {
  for (const candidate of CANDIDATE_PATHS) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  throw new Error(
    "Chrome/Chromium not found. Set CHROME_PATH or PUPPETEER_EXECUTABLE_PATH.",
  );
}

export function loadPuppeteer() {
  return require("puppeteer-core");
}

/**
 * @param {import('puppeteer-core').PuppeteerLaunchOptions & {
 *   webgl?: boolean,
 * }} [options]
 */
export async function launchChrome(options = {}) {
  const { webgl = true, args = [], ...rest } = options;
  const puppeteer = loadPuppeteer();
  const executablePath = rest.executablePath ?? resolveChromePath();
  const launchArgs = [
    "--no-sandbox",
    ...(webgl
      ? ["--use-angle=metal", "--enable-webgl", "--ignore-gpu-blocklist"]
      : []),
    ...args,
  ];
  return puppeteer.launch({
    headless: "new",
    ...rest,
    executablePath,
    args: launchArgs,
  });
}

/**
 * Poll until `fn` (run in the page) returns a truthy value.
 * @param {import('puppeteer-core').Page} page
 * @param {() => unknown} pageFn
 * @param {{ timeoutMs?: number, intervalMs?: number }} [opts]
 */
export async function waitForPageCondition(page, pageFn, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 22000;
  const intervalMs = opts.intervalMs ?? 40;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await page.evaluate(pageFn)) return true;
    await delay(intervalMs);
  }
  return false;
}

/**
 * Wait for a CSS selector (wrapper around page.waitForSelector).
 * @param {import('puppeteer-core').Page} page
 * @param {string} selector
 * @param {{ timeoutMs?: number, visible?: boolean }} [opts]
 */
export async function waitForSelector(page, selector, opts = {}) {
  return page.waitForSelector(selector, {
    timeout: opts.timeoutMs ?? 30000,
    visible: opts.visible ?? false,
  });
}

/** Hero / fluid canvas reached a terminal boot state. */
export async function waitForHeroReady(page, timeoutMs = 45000) {
  return waitForPageCondition(
    page,
    () => {
      const fluid = document.querySelector(".fluid-canvas")?.dataset.fluid;
      return fluid === "ready" || fluid === "static" || fluid === "failed";
    },
    { timeoutMs, intervalMs: 100 },
  );
}

export { delay };
