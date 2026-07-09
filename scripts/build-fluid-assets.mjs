#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/assets/pearl-liquid-background.png");
const outputs = [
  {
    path: resolve(root, "public/assets/pearl-liquid-background.webp"),
    args: ["-q", "82", "-m", "6"],
  },
  {
    path: resolve(root, "public/assets/pearl-liquid-background-poster.webp"),
    args: ["-resize", "1280", "0", "-q", "68", "-m", "6"],
  },
];

if (!existsSync(source)) {
  console.error(`Missing source asset: ${source}`);
  process.exit(1);
}

for (const output of outputs) {
  const result = spawnSync("cwebp", [...output.args, source, "-o", output.path], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
