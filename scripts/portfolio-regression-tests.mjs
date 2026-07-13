/* eslint-disable no-console -- this script is a CLI regression reporter */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  downgradeQualityTier,
  MIN_PIXEL_BUDGET_DPR,
  pixelBudgetedDpr,
  QUALITY_PIXEL_BUDGETS,
  resolveQualityTier,
  TARGET_FPS_BY_TIER,
} from "../src/features/kinetic-canvas/renderer/quality-policy.ts";
import { resolveMovementSplat } from "../src/lib/portfolio/interaction-policy.ts";

const contentSource = readFileSync(new URL("../src/lib/portfolio/content.ts", import.meta.url), "utf8");
const fluidRendererSource = readFileSync(
  new URL("../src/features/kinetic-canvas/renderer/webglFluidRenderer.ts", import.meta.url),
  "utf8",
);
const liquidCompositeSource = readFileSync(
  new URL("../src/features/kinetic-canvas/shaders/liquidComposite.ts", import.meta.url),
  "utf8",
);

const tests = [
  ["Retina 4K stays inside the high pixel budget", () => {
    const dpr = pixelBudgetedDpr(2560, 1440, 2, 1.75, 4_500_000);
    assert.ok(dpr <= 1.11);
    assert.ok(2560 * dpr * 1440 * dpr <= 4_500_000 + 1);
  }],
  ["Oversized CSS viewports can use a sub-1 DPR", () => {
    const dpr = pixelBudgetedDpr(3840, 2160, 2, 1.75, 4_500_000);
    assert.ok(dpr < 1);
    assert.ok(dpr >= MIN_PIXEL_BUDGET_DPR);
    assert.ok(3840 * dpr * 2160 * dpr <= 4_500_000 + 1);
  }],
  ["Animated tiers stay inside their fill-rate budgets", () => {
    assert.ok(QUALITY_PIXEL_BUDGETS.high * TARGET_FPS_BY_TIER.high <= 270_000_000);
    assert.ok(QUALITY_PIXEL_BUDGETS.balanced * TARGET_FPS_BY_TIER.balanced <= 90_000_000);
    assert.ok(QUALITY_PIXEL_BUDGETS.low * TARGET_FPS_BY_TIER.low <= 45_000_000);
  }],
  ["Fluid framebuffers fail closed and support non-float targets", () => {
    assert.match(fluidRendererSource, /checkFramebufferStatus\(gl\.FRAMEBUFFER\)/);
    assert.match(fluidRendererSource, /supportsRenderTarget\(gl, gl\.RGBA16F, gl\.RGBA, gl\.HALF_FLOAT\)/);
    assert.match(fluidRendererSource, /OES_texture_float_linear/);
    assert.match(fluidRendererSource, /supportsFloatTargets \? gl\.RGBA16F : gl\.RGBA8/);
    assert.match(fluidRendererSource, /supportsFloatTargets \? gl\.HALF_FLOAT : gl\.UNSIGNED_BYTE/);
    assert.match(fluidRendererSource, /encodeHeight\(next\)/);
    assert.match(fluidRendererSource, /u_packedHeight \? decodeHeight\(value\.rg\) : value\.r/);
    assert.match(fluidRendererSource, /u_packedHeight \? decodeHeight\(value\.ba\) : value\.g/);
    assert.match(fluidRendererSource, /if \(!supportsFloatTargets\)/);
    assert.match(fluidRendererSource, /TEXTURE_MIN_FILTER, gl\.NEAREST/);
    assert.match(fluidRendererSource, /clearBuffer\(heightField\.readFbo, 0, 0, 0, 1\)/);
  }],
  ["The title keeps a stable silhouette and a live fluid material", () => {
    assert.match(liquidCompositeSource, /uniform vec2 u_textResolution/);
    assert.match(liquidCompositeSource, /vec2 titleMaskWarp = lensOffset \* 0\.12/);
    assert.match(liquidCompositeSource, /vec2 titleUv = uv \+ titleMaskWarp/);
    assert.match(liquidCompositeSource, /1\.0 \/ max\(u_textResolution, vec2\(1\.0\)\)/);
    assert.match(liquidCompositeSource, /uniform sampler2D u_velocityField/);
    assert.match(liquidCompositeSource, /vec2 sampleFluidVelocity/);
    assert.match(liquidCompositeSource, /fluidVelocity \* vec2\(0\.010, -0\.008\)/);
    assert.match(liquidCompositeSource, /ripple\.z \* vec2\(0\.62, 0\.29\)/);
    assert.match(liquidCompositeSource, /lensOffset \* 0\.50/);
    assert.match(liquidCompositeSource, /float titleCaustic/);
    assert.match(liquidCompositeSource, /float shallowDepthField/);
    assert.match(liquidCompositeSource, /float midDepthField/);
    assert.match(liquidCompositeSource, /float deepDepthField/);
    assert.match(liquidCompositeSource, /float internalDepth/);
    assert.match(fluidRendererSource, /gl\.uniform2f\(textResolutionLocation, textWidth, textHeight\)/);
    assert.match(fluidRendererSource, /bindTexture\(8, velocityField\?\.read \?\? null, velocityLocation\)/);
  }],
  ["The background keeps organic motion without exposing simulation texels", () => {
    assert.match(liquidCompositeSource, /vec4 sampleSmoothField/);
    assert.match(liquidCompositeSource, /texture\(field, position\) \* 0\.28/);
    assert.match(liquidCompositeSource, /physicalRipple \+ rippleField\(uv, pointer, time\)/);
    assert.match(liquidCompositeSource, /baseUv = uv \+ lensOffset \+ simulationNormal/);
    assert.match(liquidCompositeSource, /simulationNormal\.xy \* \(0\.011 \+ faceDepth \* 0\.010\)/);
    assert.match(liquidCompositeSource, /surfaceSpecular/);
    assert.match(liquidCompositeSource, /focusedCaustic/);
    assert.match(liquidCompositeSource, /float crestUnderside/);
    assert.match(liquidCompositeSource, /float submergedTransition/);
    assert.match(fluidRendererSource, /gl\.getUniformLocation\(program, `u_ripples\[\$\{i\}\]`\)/);
    assert.match(liquidCompositeSource, /vec3 samplePearlSurface/);
    assert.match(liquidCompositeSource, /vec3 sampleTransportedLight/);
    assert.match(fluidRendererSource, /nextDyeField = createDoubleBuffer\(gl, simWidth, simHeight, renderInternalFormat/);
    assert.match(fluidRendererSource, /drawSim\(1, velocityField\.writeFbo\)/);
    assert.match(fluidRendererSource, /drawSim\(2, divergence\.fbo\)/);
    assert.match(fluidRendererSource, /drawSim\(4, velocityField\.writeFbo\)/);
    assert.match(fluidRendererSource, /drawSim\(5, dyeField\.writeFbo\)/);
  }],
  ["WebGL loss recovers through a fresh single renderer owner", () => {
    assert.match(fluidRendererSource, /webglcontextlost/);
    assert.match(fluidRendererSource, /webglcontextrestored/);
    assert.match(fluidRendererSource, /event\.preventDefault\(\)/);
    assert.match(fluidRendererSource, /onRecover\?\.\(\)/);
  }],
  ["Hero title rasterization stays in document space across offscreen resizes", () => {
    assert.match(fluidRendererSource, /rect\.left \+ window\.scrollX/);
    assert.match(fluidRendererSource, /rect\.top \+ window\.scrollY/);
    assert.match(fluidRendererSource, /window\.visualViewport\?\.addEventListener\("resize", onResize/);
    assert.match(fluidRendererSource, /window\.devicePixelRatio - observedDevicePixelRatio/);
  }],
  ["A fine-pointer four-core desktop is not forced low", () => {
    assert.equal(resolveQualityTier({
      coarsePointer: false,
      saveData: false,
      deviceMemory: 8,
      hardwareConcurrency: 4,
      viewportWidth: 1280,
    }), "high");
    assert.equal(resolveQualityTier({
      coarsePointer: false,
      saveData: false,
      deviceMemory: 4,
      hardwareConcurrency: 4,
      viewportWidth: 1280,
    }), "balanced");
  }],
  ["Coarse and save-data signals use static/low paths", () => {
    assert.equal(resolveQualityTier({
      coarsePointer: true,
      saveData: false,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 390,
    }), "low");
    assert.equal(resolveQualityTier({
      coarsePointer: false,
      saveData: true,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
    }), "static");
  }],
  ["Adaptive downgrade is monotonic", () => {
    assert.equal(downgradeQualityTier("high"), "balanced");
    assert.equal(downgradeQualityTier("balanced"), "low");
    assert.equal(downgradeQualityTier("low"), "low");
  }],
  ["Movement wakes stay responsive, throttled, and clamped", () => {
    assert.equal(resolveMovementSplat({ distance: 10, now: 1000, lastAt: 0 }), null);
    assert.equal(resolveMovementSplat({ distance: 180, now: 1000, lastAt: 0 }), 0.34);
    assert.equal(resolveMovementSplat({ distance: 180, now: 1080, lastAt: 1000 }), null);
    assert.ok(Math.abs(resolveMovementSplat({ distance: 20, now: 1200, lastAt: 1000 }) - 0.1576190476190476) < 1e-12);
  }],
  ["Every ordered project has one media presentation", () => {
    const presentationBlock = contentSource.match(/export const projectMediaPresentation = \{([\s\S]*?)\n\} satisfies Record/)?.[1] ?? "";
    const orderBlock = contentSource.match(/export const projectOrder: ProjectSlug\[\] = \[([^\]]+)\]/)?.[1] ?? "";
    const presentationSlugs = [...presentationBlock.matchAll(/^\s{2}(\w+): \{/gm)].map((match) => match[1]);
    const orderedSlugs = [...orderBlock.matchAll(/"(\w+)"/g)].map((match) => match[1]);
    assert.match(contentSource, /satisfies Record<ProjectSlug, ProjectMediaPresentation>/);
    assert.equal(new Set(orderedSlugs).size, orderedSlugs.length);
    assert.deepEqual([...presentationSlugs].sort(), [...orderedSlugs].sort());
  }],
];

for (const [name, run] of tests) {
  run();
  console.log(`PASS ${name}`);
}

console.log(`${tests.length} portfolio regression tests passed`);
