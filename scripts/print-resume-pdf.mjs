#!/usr/bin/env node
/**
 * Print /resume to public/resume.pdf via system Chrome + puppeteer-core.
 * usage: node scripts/print-resume-pdf.mjs [baseUrl]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchChrome, waitForSelector, delay } from "./lib/chrome.mjs";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const outPath = fileURLToPath(new URL("../public/resume.pdf", import.meta.url));

const browser = await launchChrome({
  webgl: false,
  args: [],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
  await page.goto(`${baseUrl}/resume`, { waitUntil: "networkidle0", timeout: 60000 });
  await waitForSelector(page, "main, article, .resume, body", { timeoutMs: 15000 });
  // Brief settle for fonts/layout after network idle.
  await delay(200);
  mkdirSync(dirname(outPath), { recursive: true });
  const pdf = await page.pdf({
    path: outPath,
    format: "Letter",
    printBackground: true,
    margin: { top: "0.6in", right: "0.6in", bottom: "0.6in", left: "0.6in" },
  });
  if (!pdf?.length) writeFileSync(outPath, Buffer.alloc(0));
  process.stdout.write(`wrote ${outPath}\n`);
} finally {
  await browser.close();
}
