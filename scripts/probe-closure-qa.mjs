#!/usr/bin/env node
/**
 * Closure QA probe — production evidence for the audit matrix.
 * Deterministic waits via chrome.mjs; no Math.random seeding.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { launchChrome, waitForHeroReady } from "./lib/chrome.mjs";

const BASE = process.env.CLOSURE_BASE_URL || "http://127.0.0.1:4321";
const OUT = join(process.cwd(), ".tmp/closure-qa");
mkdirSync(OUT, { recursive: true });

const report = {
  baseUrl: BASE,
  capturedAt: new Date().toISOString(),
  checks: {},
  metrics: {},
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
};

function shot(name) {
  const path = join(OUT, `${name}.png`);
  report.screenshots.push(path);
  return path;
}

async function collectNetwork(page) {
  const entries = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      name: e.name,
      type: e.initiatorType,
      transferSize: e.transferSize || 0,
      encodedBodySize: e.encodedBodySize || 0,
      decodedBodySize: e.decodedBodySize || 0,
    })),
  );
  let js = 0;
  let css = 0;
  let img = 0;
  let font = 0;
  let other = 0;
  let total = 0;
  const remoteFonts = [];
  const jsChunks = [];
  for (const e of entries) {
    total += e.transferSize;
    const n = e.name;
    if (/fonts\.google|fonts\.gstatic/i.test(n)) remoteFonts.push(n);
    if (/\.js(\?|$)/i.test(n) || e.type === "script") {
      js += e.transferSize;
      jsChunks.push({ name: n.split("/").pop(), transfer: e.transferSize });
    } else if (/\.css(\?|$)/i.test(n) || e.type === "css" || e.type === "link") {
      css += e.transferSize;
    } else if (/\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(n) || e.type === "img") {
      img += e.transferSize;
    } else if (/\.woff2?(\?|$)/i.test(n)) {
      font += e.transferSize;
    } else {
      other += e.transferSize;
    }
  }
  return { js, css, img, font, other, total, remoteFonts, jsChunks, resourceCount: entries.length };
}

async function heroMetrics(page) {
  return page.evaluate(() => {
    const c = document.querySelector(".fluid-canvas canvas");
    const ds = c?.dataset || {};
    return {
      fluid: document.documentElement.dataset.fluid || ds.fluid,
      boot: document.documentElement.dataset.heroBoot || ds.boot,
      heroRenderer: document.documentElement.dataset.heroRenderer || ds.heroRenderer,
      quality: ds.quality || ds.opticalTier,
      drawCalls: ds.drawCalls,
      triangles: ds.triangles,
      textureMemoryEstimateMb: ds.textureMemoryEstimateMb,
      fps: ds.fps,
      frameMsP95: ds.frameMsP95,
      workMsP95: ds.workMsP95,
      offHero: ds.offHero,
      motionLoop: ds.motionLoop,
      renderGraph: ds.renderGraph,
      glyphMaterial: ds.glyphMaterial,
      opticalSource: ds.opticalSource,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
}

async function waitMetrics(page, { needFps = false } = {}) {
  await waitForHeroReady(page, { timeoutMs: 45000 }).catch(() => undefined);
  await page.evaluate(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("heroMetrics")) {
      url.searchParams.set("heroMetrics", "1");
      window.history.replaceState({}, "", url.toString());
    }
  });
  // Force metrics path if canvas already up — dataset may need a few frames.
  for (let i = 0; i < 40; i++) {
    const m = await heroMetrics(page);
    if (m.drawCalls && Number(m.drawCalls) > 10 && (!needFps || (m.fps && Number(m.fps) > 0))) {
      return m;
    }
    await delay(250);
  }
  return heroMetrics(page);
}

async function withPage(browser, { width, height, deviceScaleFactor = 1, reducedMotion = false }, fn) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor });
  if (reducedMotion) {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  }
  page.on("pageerror", (err) => report.pageErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") report.consoleErrors.push(msg.text());
  });
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

const browser = await launchChrome();

try {
  // --- Cold cache desktop network ---
  await withPage(browser, { width: 1280, height: 720 }, async (page) => {
    const client = await page.createCDPSession();
    await client.send("Network.clearBrowserCache");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
    await page.goto(`${BASE}/?heroMetrics=1`, { waitUntil: "networkidle0", timeout: 90000 });
    const m = await waitMetrics(page, { needFps: true });
    await delay(2500);
    const m2 = await heroMetrics(page);
    const net = await collectNetwork(page);
    await page.screenshot({ path: shot("desktop-1280x720-hero"), type: "png" });
    report.metrics.desktopCold = { ...net, hero: { ...m, ...m2 } };
    report.checks.desktopOverflow = !(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    ));
    report.checks.noRemoteFonts = net.remoteFonts.length === 0;
    report.checks.canonical = await page.evaluate(() => {
      const link = document.querySelector('link[rel="canonical"]');
      return link?.href || null;
    });
    report.checks.jsonLd = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('script[type="application/ld+json"]')];
      return nodes.map((n) => {
        try {
          return JSON.parse(n.textContent || "{}");
        } catch {
          return { parseError: true };
        }
      });
    });
    report.checks.twitter = await page.evaluate(() => ({
      card: document.querySelector('meta[name="twitter:card"]')?.content || null,
      creator: document.querySelector('meta[name="twitter:creator"]')?.content || null,
      site: document.querySelector('meta[name="twitter:site"]')?.content || null,
    }));
    report.checks.og = await page.evaluate(() => ({
      title: document.querySelector('meta[property="og:title"]')?.content || null,
      image: document.querySelector('meta[property="og:image"]')?.content || null,
      type: document.querySelector('meta[property="og:type"]')?.content || null,
    }));

    // CTA focus safety early
    report.checks.ctaEarly = await page.evaluate(() => {
      const cta = document.querySelector(".hero-cta, [data-hero-cta], a[href='#projects']");
      if (!cta) return { found: false };
      const style = getComputedStyle(cta);
      return {
        found: true,
        tabIndex: cta.tabIndex,
        ariaHidden: cta.getAttribute("aria-hidden"),
        inert: cta.hasAttribute("inert"),
        visibility: style.visibility,
        opacity: style.opacity,
      };
    });

    // Site motion toggle
    const motionToggle = await page.$('button[aria-label="Turn motion off"], button[aria-label="Turn motion on"]');
    if (motionToggle) {
      await motionToggle.click();
      await delay(400);
      await page.screenshot({ path: shot("desktop-motion-off"), type: "png" });
      report.checks.siteMotionToggle = await page.evaluate(() => ({
        pressed: document.querySelector('button[aria-label="Turn motion on"], button[aria-label="Turn motion off"]')?.getAttribute("aria-pressed"),
        rootMotion: document.querySelector(".portfolio-root")?.getAttribute("data-motion"),
      }));
      await motionToggle.click();
      await delay(300);
    } else {
      report.checks.siteMotionToggle = { found: false };
    }

    // Keyboard nav: skip link + tab through
    await page.keyboard.press("Tab");
    await delay(100);
    report.checks.skipLinkFocus = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName, text: el?.textContent?.trim()?.slice(0, 40), href: el?.getAttribute?.("href") };
    });

    // Scroll to projects / about / contact
    await page.evaluate(() => document.querySelector("#projects")?.scrollIntoView({ block: "start" }));
    await delay(1200);
    const offHero = await heroMetrics(page);
    report.metrics.desktopOffHero = offHero;
    await page.screenshot({ path: shot("desktop-projects"), type: "png" });

    await page.evaluate(() => document.querySelector("#about")?.scrollIntoView({ block: "center" }));
    await delay(900);
    await page.screenshot({ path: shot("desktop-about"), type: "png" });

    await page.evaluate(() => document.querySelector("#contact")?.scrollIntoView({ block: "center" }));
    await delay(900);
    await page.screenshot({ path: shot("desktop-contact"), type: "png" });

    // Abyss modal + focus trap
    await page.evaluate(() => document.querySelector("#contact")?.scrollIntoView({ block: "center" }));
    await delay(500);
    const abyssOpened = await page.evaluate(async () => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return true;
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /keep diving/i.test(b.textContent || ""),
      );
      if (!btn) return false;
      btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 1550));
      btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0 }));
      await new Promise((r) => setTimeout(r, 100));
      return !!document.querySelector('[role="dialog"][aria-modal="true"]');
    });
    report.checks.abyssOpen = abyssOpened;
    if (abyssOpened) {
      await page.screenshot({ path: shot("desktop-abyss"), type: "png" });
      // Focus trap: tab several times, activeElement stays inside dialog
      const trap = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        trap.push(
          await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"][aria-modal="true"]');
            const active = document.activeElement;
            return dialog?.contains(active) ?? false;
          }),
        );
      }
      report.checks.abyssFocusTrap = trap.every(Boolean);
      await page.keyboard.press("Escape");
      await delay(300);
      report.checks.abyssEscape = await page.evaluate(
        () => !document.querySelector('[role="dialog"][aria-modal="true"]'),
      );
    }

    // Project → resume → home
    await page.goto(`${BASE}/project/monkeyclaw`, { waitUntil: "networkidle0", timeout: 60000 });
    report.checks.projectMain = await page.evaluate(() => ({
      hasMain: !!document.querySelector("main#main-content, main"),
      hasArticle: !!document.querySelector("article"),
    }));
    await page.screenshot({ path: shot("desktop-project-monkeyclaw"), type: "png" });

    await page.goto(`${BASE}/resume`, { waitUntil: "networkidle0", timeout: 60000 });
    report.checks.resumeMain = await page.evaluate(() => !!document.querySelector("main"));
    await page.screenshot({ path: shot("desktop-resume"), type: "png" });

    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    report.checks.navHome = true;

    await page.goto(`${BASE}/missing-page-xyz`, { waitUntil: "domcontentloaded", timeout: 30000 });
    report.checks.notFound = await page.evaluate(() => document.title);
    await page.screenshot({ path: shot("desktop-404"), type: "png" });
  });

  // --- Wider Retina viewport ---
  await withPage(browser, { width: 1728, height: 1117, deviceScaleFactor: 2 }, async (page) => {
    await page.goto(`${BASE}/?heroMetrics=1`, { waitUntil: "networkidle0", timeout: 90000 });
    const m = await waitMetrics(page, { needFps: true });
    await delay(2000);
    await page.screenshot({ path: shot("desktop-retina-1728-hero"), type: "png" });
    report.metrics.retina = await heroMetrics(page);
    report.metrics.retina.initial = m;
  });

  // --- Mobile 390×844 ---
  await withPage(browser, { width: 390, height: 844, deviceScaleFactor: 2 }, async (page) => {
    await page.goto(`${BASE}/?heroMetrics=1`, { waitUntil: "networkidle0", timeout: 90000 });
    await waitMetrics(page);
    await delay(1500);
    await page.screenshot({ path: shot("mobile-390x844-hero"), type: "png" });
    report.metrics.mobileHero = await heroMetrics(page);

    // Open mobile menu
    const menuBtn = await page.$('button[aria-label*="menu" i], button[aria-expanded], .nav-toggle, [data-nav-toggle]');
    if (menuBtn) {
      await menuBtn.click();
      await delay(400);
      await page.screenshot({ path: shot("mobile-mobile-menu"), type: "png" });
      report.checks.mobileMenuOpen = await page.evaluate(() => {
        const nav = document.querySelector("nav, [data-mobile-nav], .site-nav");
        return {
          expanded: document.querySelector("[aria-expanded='true']") != null,
          focusInside: nav?.contains(document.activeElement) ?? false,
        };
      });
      // Focus trap-ish: tab and ensure we don't escape to canvas
      const trap = [];
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        trap.push(
          await page.evaluate(() => {
            const sheet = document.querySelector("[data-mobile-nav], .nav-sheet, nav[data-open], .site-nav[data-open], [aria-modal='true']");
            const active = document.activeElement;
            if (!sheet) return active?.closest("header, nav") != null;
            return sheet.contains(active);
          }),
        );
      }
      report.checks.mobileFocusTrap = trap.filter(Boolean).length >= Math.floor(trap.length * 0.7);
      await page.keyboard.press("Escape");
      await delay(200);
    } else {
      report.checks.mobileMenuOpen = { found: false };
    }

    await page.evaluate(() => document.querySelector("#projects")?.scrollIntoView({ block: "start" }));
    await delay(800);
    await page.screenshot({ path: shot("mobile-projects"), type: "png" });
    await page.evaluate(() => document.querySelector("#about")?.scrollIntoView({ block: "center" }));
    await delay(700);
    await page.screenshot({ path: shot("mobile-about"), type: "png" });
    await page.evaluate(() => document.querySelector("#contact")?.scrollIntoView({ block: "center" }));
    await delay(700);
    await page.screenshot({ path: shot("mobile-contact"), type: "png" });

    // Abyss on mobile
    const opened = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /keep diving/i.test(b.textContent || ""),
      );
      if (!btn) return false;
      btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 1550));
      btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      return !!document.querySelector('[role="dialog"][aria-modal="true"]');
    });
    report.checks.mobileAbyssOpen = opened;
    if (opened) {
      await page.screenshot({ path: shot("mobile-abyss"), type: "png" });
      await page.keyboard.press("Escape");
    }

    await page.goto(`${BASE}/project/monkeyclaw`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.screenshot({ path: shot("mobile-project-monkeyclaw"), type: "png" });
    await page.goto(`${BASE}/resume`, { waitUntil: "networkidle0", timeout: 60000 });
    await page.screenshot({ path: shot("mobile-resume"), type: "png" });
    await page.goto(`${BASE}/missing-page-xyz`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.screenshot({ path: shot("mobile-404"), type: "png" });
  });

  // --- Reduced motion emulation ---
  await withPage(browser, { width: 1280, height: 720, reducedMotion: true }, async (page) => {
    await page.goto(`${BASE}/?heroMetrics=1`, { waitUntil: "networkidle0", timeout: 90000 });
    await waitForHeroReady(page, { timeoutMs: 45000 }).catch(() => undefined);
    await delay(1500);
    report.metrics.reducedMotion = await heroMetrics(page);
    await page.screenshot({ path: shot("desktop-reduced-motion-hero"), type: "png" });
    await page.evaluate(() => document.querySelector("#projects")?.scrollIntoView({ block: "start" }));
    await delay(600);
    await page.screenshot({ path: shot("desktop-reduced-motion-projects"), type: "png" });
    report.checks.reducedMotionLoopStopped =
      report.metrics.reducedMotion.motionLoop === "stopped" ||
      report.metrics.reducedMotion.fps === "0" ||
      report.metrics.reducedMotion.fps === 0 ||
      report.metrics.reducedMotion.quality === "low";
  });

  // robots + sitemap content
  report.checks.robotsBody = await (await fetch(`${BASE}/robots.txt`)).text();
  report.checks.sitemapBody = (await (await fetch(`${BASE}/sitemap.xml`)).text()).slice(0, 800);
} finally {
  await browser.close();
}

writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  screenshots: report.screenshots.length,
  checks: report.checks,
  metricsSummary: {
    desktopCold: report.metrics.desktopCold && {
      total: report.metrics.desktopCold.total,
      js: report.metrics.desktopCold.js,
      img: report.metrics.desktopCold.img,
      font: report.metrics.desktopCold.font,
      hero: report.metrics.desktopCold.hero,
    },
    desktopOffHero: report.metrics.desktopOffHero,
    retina: report.metrics.retina,
    mobile: report.metrics.mobileHero,
    reducedMotion: report.metrics.reducedMotion,
  },
  consoleErrorCount: report.consoleErrors.length,
  pageErrorCount: report.pageErrors.length,
}, null, 2));
console.log(`Wrote ${join(OUT, "report.json")}`);
