/**
 * Application-audit production QA: metrics + screenshots at 1280×720 and 390×844.
 * Requires `npm run start` on :3000.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { delay, launchChrome, waitForHeroReady, waitForSelector } from "./lib/chrome.mjs";

const BASE = process.env.PORTFOLIO_BASE_URL ?? "http://127.0.0.1:3000";
const OUT = new URL("../.tmp/audit-qa/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const report = {
  consoleErrors: [],
  checks: {},
  metrics: {},
  screenshots: [],
};

async function collectTransfer(page) {
  return page.evaluate(() => {
    const entries = performance.getEntriesByType("resource");
    let cssBytes = 0;
    let imageBytes = 0;
    let scriptBytes = 0;
    let identityImageRequests = 0;
    for (const entry of entries) {
      const size = entry.transferSize || 0;
      if (entry.initiatorType === "css" || /\.css(\?|$)/.test(entry.name)) cssBytes += size;
      if (entry.initiatorType === "img" || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(entry.name)) {
        imageBytes += size;
        if (/\/projects\//.test(entry.name) && /\.(png|webp|jpe?g)(\?|$)/i.test(entry.name)) {
          identityImageRequests += 1;
        }
      }
      if (entry.initiatorType === "script" || /\.js(\?|$)/.test(entry.name)) scriptBytes += size;
    }
    return {
      cssBytes,
      imageBytes,
      scriptBytes,
      identityImageRequests,
      resourceCount: entries.length,
    };
  });
}

async function assertNoHorizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return {
      clientWidth: doc.clientWidth,
      scrollWidth: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
}

async function runViewport(browser, label, width, height) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await waitForHeroReady(page, 20000).catch(() => undefined);
  await page.waitForSelector("#main-content", { timeout: 10000 });

  const shot = async (name) => {
    const path = new URL(`./${label}-${name}.png`, OUT).pathname;
    await page.screenshot({ path, fullPage: false });
    report.screenshots.push(path);
  };

  await shot("home");

  // Motion toggle
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="motion" i], button[aria-label*="Motion" i]');
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector('.portfolio-root[data-motion="off"]', { timeout: 5000 }).catch(() => null);
  await shot("motion-off");
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="motion" i], button[aria-label*="Motion" i]');
    btn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForSelector('.portfolio-root[data-motion="on"]', { timeout: 5000 }).catch(() => null);

  // Mobile menu (only meaningful on narrow)
  if (width <= 500) {
    const menu = await page.$('button[aria-controls="mobile-navigation"]');
    if (menu) {
      await menu.click();
      await page.waitForSelector('#mobile-navigation[aria-hidden="false"], #mobile-navigation:not([inert])', {
        timeout: 5000,
      }).catch(() => undefined);
      await shot("mobile-menu");
      await page.keyboard.press("Escape");
    }
  }

  // Projects
  await page.evaluate(() => document.getElementById("projects")?.scrollIntoView({ behavior: "instant", block: "start" }));
  await waitForSelector(page, "[data-project-row]", 8000);
  await delay(400);
  await shot("projects");

  // About
  await page.evaluate(() => document.getElementById("about")?.scrollIntoView({ behavior: "instant", block: "start" }));
  await delay(350);
  await shot("about");

  // Contact + Abyss keyboard hold
  await page.evaluate(() => document.getElementById("contact")?.scrollIntoView({ behavior: "instant", block: "end" }));
  await delay(400);
  await shot("contact");

  const dive = await page.$('button[aria-label*="Hidden abyss" i]');
  if (dive) {
    await dive.focus();
    await page.keyboard.down("Enter");
    await delay(1500);
    await page.keyboard.up("Enter");
    const dialog = await page.waitForSelector("[data-abyss-dialog]", { timeout: 3000 }).catch(() => null);
    report.checks[`${label}-abyss-open`] = Boolean(dialog);
    if (dialog) {
      await shot("abyss");
      await page.keyboard.press("Escape");
      await delay(250);
      const stillOpen = await page.$("[data-abyss-dialog]");
      report.checks[`${label}-abyss-escape`] = !stillOpen;
      const active = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
      report.checks[`${label}-abyss-focus-restored`] = /Hidden abyss/i.test(active);
    }
  }

  // Hero CTA not focusable before reveal — reload and check early
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
  const ctaTabIndexEarly = await page.evaluate(() => {
    const cta = document.querySelector('a[href="/#projects"].liquid-dialogue, a[data-magnetic="cta"]');
    if (!cta) return null;
    return {
      tabIndex: cta.tabIndex,
      visible: cta.getAttribute("data-visible"),
      inert: cta.hasAttribute("inert"),
    };
  });
  report.checks[`${label}-cta-early`] = ctaTabIndexEarly;

  // Project route
  await page.goto(`${BASE}/project/monkeyclaw`, { waitUntil: "networkidle2", timeout: 60000 });
  const landmark = await page.evaluate(() => {
    const main = document.querySelector("main#main-content");
    const article = main?.querySelector("article");
    return { hasMain: Boolean(main), hasArticle: Boolean(article) };
  });
  report.checks[`${label}-project-landmark`] = landmark;
  await shot("project-monkeyclaw");

  // Project → resume
  await page.goto(`${BASE}/resume`, { waitUntil: "networkidle2", timeout: 60000 });
  await shot("resume");
  report.checks[`${label}-resume-main`] = await page.evaluate(() => Boolean(document.querySelector("main#main-content")));

  // 404
  const notFound = await page.goto(`${BASE}/this-route-does-not-exist-audit`, { waitUntil: "networkidle2", timeout: 60000 });
  report.checks[`${label}-404-status`] = notFound?.status();
  await shot("404");

  // robots + sitemap
  const robots = await page.goto(`${BASE}/robots.txt`, { waitUntil: "networkidle2" });
  report.checks[`${label}-robots`] = (await robots?.text())?.includes("Sitemap");
  const sitemap = await page.goto(`${BASE}/sitemap.xml`, { waitUntil: "networkidle2" });
  const sitemapText = await sitemap?.text();
  report.checks[`${label}-sitemap`] = Boolean(sitemapText?.includes("/project/monkeyclaw"));

  // Metadata sample via home HTML
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  const meta = await page.evaluate(() => {
    const twitter = document.querySelector('meta[name="twitter:creator"]')?.content
      || document.querySelector('meta[name="twitter:site"]')?.content;
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((el) => {
        try { return JSON.parse(el.textContent || ""); } catch { return null; }
      })
      .find((data) => data?.["@type"] === "Person");
    return {
      twitter,
      email: jsonLd?.email,
      emailIsMailto: typeof jsonLd?.email === "string" && jsonLd.email.startsWith("mailto:"),
    };
  });
  report.checks[`${label}-metadata`] = meta;

  report.checks[`${label}-overflow`] = await assertNoHorizontalOverflow(page);
  report.metrics[label] = await collectTransfer(page);
  report.consoleErrors.push(...errors.map((e) => ({ label, error: e })));

  // Invisible focus target check on home after settle
  await waitForHeroReady(page, 15000).catch(() => undefined);
  const focusLeak = await page.evaluate(async () => {
    const results = [];
    const focusables = [...document.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')];
    for (const el of focusables.slice(0, 40)) {
      if (el.closest("[inert]")) continue;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.opacity === "0" && el.tabIndex >= 0 && rect.width > 0) {
        results.push({ tag: el.tagName, text: el.textContent?.slice(0, 40), tabIndex: el.tabIndex });
      }
    }
    return results;
  });
  report.checks[`${label}-invisible-focusables`] = focusLeak;

  await page.close();
}

const browser = await launchChrome({ headless: true });
try {
  await runViewport(browser, "desktop", 1280, 720);
  await runViewport(browser, "mobile", 390, 844);
} finally {
  await browser.close();
}

const outPath = new URL("./report.json", OUT);
writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${outPath.pathname}`);
