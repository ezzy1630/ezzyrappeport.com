#!/usr/bin/env node
/**
 * Behavioral contracts for the kinetic-canvas runtime audit.
 * Prefer executable checks over incidental source-literal regex locks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accumulateFixedSteps } from "../src/features/kinetic-canvas/physics/fixedStep.ts";
import { pointSegmentDistanceXY } from "../src/features/kinetic-canvas/physics/waterCoordinates.ts";
import { exposureForDepth } from "../src/features/kinetic-canvas/renderer/underwater/assetUrls.ts";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

const kineticCanvasSource = read("../src/features/kinetic-canvas/KineticCanvas.tsx");
const assetUrlsSource = read("../src/features/kinetic-canvas/renderer/underwater/assetUrls.ts");
const configSource = read("../src/features/kinetic-canvas/renderer/underwater/config.ts");
const qualitySource = read("../src/features/kinetic-canvas/renderer/quality.ts");
const rendererSource = read("../src/features/kinetic-canvas/renderer/underwater/underwaterHeroRenderer.ts");
const glyphBodiesSource = read("../src/features/kinetic-canvas/physics/glyphRigidBodies.ts");
const frameClockSource = read("../src/lib/portfolio/frame-clock.ts");
const deviceTiltSource = read("../src/lib/portfolio/device-tilt.ts");

const tests = [
  ["assetUrls stays free of three.js", () => {
    assert.doesNotMatch(assetUrlsSource, /from ["']three["']/);
    assert.match(assetUrlsSource, /export const HERO_GLB_URL/);
    assert.equal(typeof exposureForDepth(0), "number");
    assert.ok(exposureForDepth(0) > exposureForDepth(1));
  }],

  ["KineticCanvas warms GLB through assetUrls, not config", () => {
    assert.match(kineticCanvasSource, /from "\.\/renderer\/underwater\/assetUrls"/);
    assert.doesNotMatch(kineticCanvasSource, /from "\.\/renderer\/underwater\/config"/);
    assert.doesNotMatch(kineticCanvasSource, /from ["']three["']/);
  }],

  ["underwater config no longer imports three tone mappers", () => {
    assert.doesNotMatch(configSource, /from ["']three["']/);
    assert.doesNotMatch(configSource, /TONE_MAPPER_NAMES/);
    assert.match(configSource, /export \{[\s\S]*HERO_GLB_URL/);
  }],

  ["misleading pressureIterations / activeRipples quality fields are gone", () => {
    assert.doesNotMatch(qualitySource, /pressureIterations/);
    assert.doesNotMatch(qualitySource, /activeRipples/);
    assert.doesNotMatch(qualitySource, /RIPPLE_COUNT/);
    assert.doesNotMatch(qualitySource, /FLUID_TEXTURE_SRC/);
  }],

  ["startInteractiveRenderer is single-flight and tracks breach timers", () => {
    assert.match(kineticCanvasSource, /startInFlight/);
    assert.match(kineticCanvasSource, /startGeneration/);
    assert.match(kineticCanvasSource, /breachTimer/);
    assert.match(kineticCanvasSource, /clearBootTimers/);
    assert.match(kineticCanvasSource, /generation !== startGeneration/);
    assert.match(kineticCanvasSource, /resolveEffectiveReducedMotion/);
  }],

  ["renderer copies environment once then draws glyphs only", () => {
    assert.match(rendererSource, /backdropScene/);
    assert.match(rendererSource, /render\(backdropScene, fullscreenCamera\)/);
    assert.match(rendererSource, /backdrop\.frustumCulled = false/);
    assert.match(rendererSource, /renderer\.resetState\(\)/);
    // environmentTarget still filled for glyph refraction; sceneTarget paints the plate directly.
    assert.match(rendererSource, /setRenderTarget\(environmentTarget\)/);
    assert.match(rendererSource, /setRenderTarget\(sceneTarget\)/);
    assert.match(rendererSource, /camera\.layers\.set\(GLYPH_LAYER\)/);
    // Glyph pass must not wipe the optical plate (Color background force-clears).
    assert.match(rendererSource, /scene\.background = null/);
    assert.match(rendererSource, /renderer\.autoClear = false/);
    assert.match(rendererSource, /renderer\.clearDepth\(\)/);
    // Production thickness path keeps shadows off.
    assert.match(rendererSource, /renderer\.shadowMap\.enabled = false/);
    assert.match(rendererSource, /usePhysicalMaterial/);
  }],

  ["canvas geometry is cached outside the render hot path", () => {
    assert.match(rendererSource, /refreshCanvasRect/);
    assert.match(rendererSource, /const canvasRect/);
    // Hot-path reads use the cache; measurement stays inside refreshCanvasRect.
    const refreshBlock = rendererSource.match(
      /const refreshCanvasRect = \(\) => \{[\s\S]*?\n  \};/,
    )?.[0] ?? "";
    assert.match(refreshBlock, /getBoundingClientRect/);
    const renderFn = rendererSource.slice(rendererSource.indexOf("const render = (now: number)"));
    assert.doesNotMatch(renderFn.slice(0, 3500), /getBoundingClientRect/);
  }],

  ["off-hero simulation banks debt and catch-up stays bounded", () => {
    assert.match(rendererSource, /offHeroSimDebt/);
    assert.match(rendererSource, /OFF_HERO_MAX_CATCHUP_STEPS/);
    const catchUp = accumulateFixedSteps(0, 3 / 120, 1 / 120, 3);
    assert.equal(catchUp.steps, 3);
    const over = accumulateFixedSteps(0, 1, 1 / 120, 3);
    assert.ok(over.steps <= 3);
  }],

  ["hero metrics gate exists without removing probe hooks", () => {
    assert.match(rendererSource, /heroMetrics/);
    assert.match(rendererSource, /navigator\.webdriver/);
    assert.match(rendererSource, /glyphMotion/);
    assert.match(rendererSource, /workMsP95/);
  }],

  ["glyph physics avoids hot-loop object / array allocations", () => {
    assert.match(glyphBodiesSource, /pointSegmentDistanceXY/);
    assert.match(glyphBodiesSource, /CORNER_SCRATCH/);
    assert.match(glyphBodiesSource, /Number\.isFinite\(body\.position\.x\)/);
    assert.doesNotMatch(glyphBodiesSource, /\.every\(Number\.isFinite\)/);
    assert.equal(pointSegmentDistanceXY(0, 0, 0, 0, 10, 0), 0);
    assert.ok(pointSegmentDistanceXY(0, 5, 0, 0, 10, 0) > 4);
  }],

  ["device tilt has no module-evaluation listeners and reuses samples", async () => {
    assert.match(deviceTiltSource, /ensureLifecycleListeners/);
    assert.match(deviceTiltSource, /tearDownLifecycleListeners/);
    assert.match(deviceTiltSource, /const LIVE: DeviceTiltSample/);
    // No always-live install at module evaluation.
    assert.doesNotMatch(
      deviceTiltSource,
      /\nif \(typeof window !== "undefined"\) \{\n  window\.addEventListener\("blur"/,
    );
    const tilt = await import("../src/lib/portfolio/device-tilt.ts");
    assert.equal(typeof tilt.disposeDeviceTilt, "function");
    assert.equal(typeof tilt.getDeviceTilt, "function");
    const sample = tilt.getDeviceTilt();
    assert.equal(sample.active, false);
  }],

  ["frame clock GSAP bind is reference-counted with unbind", () => {
    assert.match(frameClockSource, /export function unbindGsapFromFrameClock/);
    assert.match(frameClockSource, /gsapBindCount/);
    assert.match(frameClockSource, /unbindVisibility/);
  }],
];

for (const [name, run] of tests) {
  await run();
  console.log(`PASS ${name}`);
}

console.log(`${tests.length} renderer runtime audit tests passed`);
