#!/usr/bin/env node
/**
 * Legacy pearl-liquid bake path retired.
 * Production water plates live under public/assets/water/ and are authored
 * offline (shallow / mid / deep). This script no longer emits unused
 * pearl-liquid-background*.webp into public/.
 */
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const waterDir = resolve(root, "public/assets/water");
const required = [
  "shallow-desktop-v1.webp",
  "shallow-portrait-v1.webp",
  "mid-depth-v1.webp",
  "deep-basin-v1.webp",
];

const missing = required.filter((name) => !existsSync(resolve(waterDir, name)));
if (missing.length) {
  console.error(`Missing authored water plates in ${waterDir}:`);
  for (const name of missing) console.error(`  - ${name}`);
  process.exit(1);
}

console.log("Water plates present; pearl-liquid bake path retired.");
