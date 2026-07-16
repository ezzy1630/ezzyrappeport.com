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
import {
  GLYPH_STATE_RANGES,
  packGlyphSigned16,
  unpackGlyphSigned16,
} from "../src/features/kinetic-canvas/shaders/glyphStateCodec.ts";
import {
  resolveGlyphImpulse,
  stepGlyphPlanarState,
} from "../src/features/kinetic-canvas/physics/glyphImpulseModel.ts";

const contentSource = readFileSync(new URL("../src/lib/portfolio/content.ts", import.meta.url), "utf8");
const fluidRendererSource = readFileSync(
  new URL("../src/features/kinetic-canvas/renderer/webglFluidRenderer.ts", import.meta.url),
  "utf8",
);
const liquidCompositeSource = readFileSync(
  new URL("../src/features/kinetic-canvas/shaders/liquidComposite.ts", import.meta.url),
  "utf8",
);
const heroTextMaskSource = readFileSync(
  new URL("../src/features/kinetic-canvas/materials/heroTextMask.ts", import.meta.url),
  "utf8",
);
const glyphPhysicsSource = readFileSync(
  new URL("../src/features/kinetic-canvas/shaders/glyphPhysics.ts", import.meta.url),
  "utf8",
);
const glyphStateCodecSource = readFileSync(
  new URL("../src/features/kinetic-canvas/shaders/glyphStateCodec.ts", import.meta.url),
  "utf8",
);
const heroNameSource = readFileSync(
  new URL("../src/components/portfolio/HeroName.tsx", import.meta.url),
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
  ["Every visible title glyph retains isolated identity and GPU state", () => {
    assert.match(heroTextMaskSource, /HERO_GLYPH_COUNT = HERO_LINE_1\.length \+ HERO_LINE_2\.length/);
    assert.match(heroTextMaskSource, /querySelectorAll<HTMLElement>\("\.hero-name-fallback__glyph"\)/);
    assert.match(heroTextMaskSource, /index,\s*glyph,\s*rest:/);
    assert.match(heroTextMaskSource, /atlas:/);
    assert.match(heroTextMaskSource, /physics:/);
    assert.match(heroTextMaskSource, /material:/);
    assert.match(heroTextMaskSource, /Math\.round\(rangeOverride\)/);
    assert.match(heroTextMaskSource, /squaredDistanceTransform1D/);
    assert.match(heroTextMaskSource, /Math\.sqrt\(target\[y\]\)/);
    assert.match(heroTextMaskSource, /function localStrokeRadii/);
    assert.match(heroTextMaskSource, /distanceIn \/ Math\.max\(strokeRadii\[cropIndex\], 1\)/);
    assert.doesNotMatch(heroTextMaskSource, /distanceIn \/ maximumInteriorDistance/);
    assert.match(heroTextMaskSource, /context\.strokeText\(glyph, x, baseline\)/);
    assert.match(heroNameSource, /key={`\$\{glyph\}-\$\{index\}`}/);
    assert.match(fluidRendererSource, /glyphStateHeight = supportsFloatTargets \? 4 : 8/);
    assert.match(fluidRendererSource, /createDoubleBuffer\(\s*gl,\s*HERO_GLYPH_COUNT,\s*glyphStateHeight,/);
    assert.match(glyphPhysicsSource, /row 0: planar position, depth, buoyancy/);
    assert.match(glyphPhysicsSource, /row 2: X tilt, Y tilt, screen rotation/);
    assert.match(fluidRendererSource, /gl\.texParameteri\(gl\.TEXTURE_2D, gl\.TEXTURE_MIN_FILTER, gl\.NEAREST\)/);
    assert.match(fluidRendererSource, /const glyphDebugEnabled = isGlyphDebugEnabled\(\)/);
    assert.match(fluidRendererSource, /if \(!glyphDebugEnabled \|\| !glyphState/);
    assert.doesNotMatch(heroTextMaskSource, /rect\.left \+ rect\.width \* 0\.5 \+ window\.scrollX/);
    assert.doesNotMatch(heroTextMaskSource, /rect\.top \+ rect\.height \* 0\.5 \+ window\.scrollY/);
  }],
  ["Packed glyph state preserves subpixel physics without float color targets", () => {
    assert.match(fluidRendererSource, /get\("glyphState"\) === "packed"/);
    assert.match(fluidRendererSource, /createProgram\(gl, VERTEX_SOURCE, GLYPH_PHYSICS_FRAGMENT_SOURCE\)/);
    assert.doesNotMatch(fluidRendererSource, /supportsFloatTargets\s*\?\s*createProgram\(gl, VERTEX_SOURCE, GLYPH_PHYSICS_FRAGMENT_SOURCE\)/);
    assert.match(fluidRendererSource, /canvas\.dataset\.glyphState = supportsFloatTargets \? "float16" : "packed16"/);
    assert.match(fluidRendererSource, /gl\.clearColor\(128 \/ 255, 0, 128 \/ 255, 0\)/);
    assert.match(fluidRendererSource, /gl\.uniform1i\(glyphPackedStateLocation, supportsFloatTargets \? 0 : 1\)/);
    assert.match(fluidRendererSource, /if \(!supportsFloatTargets\) quality = applyPackedTargetProfile\(quality\)/);
    assert.match(fluidRendererSource, /simWidth: 256, pressureIterations: 6/);
    assert.match(glyphStateCodecSource, /packGlyphUnit16/);
    assert.match(glyphStateCodecSource, /readGlyphState/);
    assert.match(glyphStateCodecSource, /writeGlyphState/);
    assert.match(glyphPhysicsSource, /physicalRow \/ 2 : physicalRow/);

    for (let row = 0; row < GLYPH_STATE_RANGES.length; row++) {
      for (let component = 0; component < 4; component++) {
        const range = GLYPH_STATE_RANGES[row][component];
        for (const fraction of [-1, -0.73, -0.09, 0, 0.11, 0.68, 1]) {
          const value = range * fraction;
          const decoded = unpackGlyphSigned16(
            packGlyphSigned16(value, row, component),
            row,
            component,
          );
          assert.ok(Math.abs(decoded - value) <= range / 32_767 + Number.EPSILON);
        }
      }
    }
  }],
  ["Glyph physics samples the live solver locally and returns to rest", () => {
    assert.match(glyphPhysicsSource, /vec2 left = center/);
    assert.match(glyphPhysicsSource, /vec2 right = center/);
    assert.match(glyphPhysicsSource, /vec2 upper = center/);
    assert.match(glyphPhysicsSource, /vec2 lower = center/);
    assert.match(glyphPhysicsSource, /texture\(u_velocity, center\)/);
    assert.match(glyphPhysicsSource, /texture\(u_normal, upper\)/);
    assert.match(glyphPhysicsSource, /texture\(u_pressure, left\)/);
    assert.match(glyphPhysicsSource, /displacementForce = -transform\.xy \* physical\.y/);
    assert.match(glyphPhysicsSource, /angularVelocity\.xyz \+= angularAcceleration \* dt/);
    assert.match(glyphPhysicsSource, /vec3 rotationLimit/);
    assert.match(glyphPhysicsSource, /maxTranslation = physical\.w/);
    assert.match(glyphPhysicsSource, /float immediate = exp/);
    assert.match(glyphPhysicsSource, /float ringRadius = 22\.0 \+ age \* 185\.0/);
    assert.match(glyphPhysicsSource, /float arrivalTime = surfaceDistance \/ 185\.0/);
    assert.match(glyphPhysicsSource, /smoothstep\(arrivalTime, arrivalTime \+ 0\.12, age\)/);
    assert.match(glyphPhysicsSource, /vec2 localHit = \(ripple\.xy - centerTop\)/);
    assert.match(glyphPhysicsSource, /cross2\(localHit, impulseDirection\)/);
  }],
  ["Deterministic local impulses translate, torque, rank, and settle glyphs", () => {
    const viewport = [1440, 900];
    const directBody = { index: 0, center: [0.2, 0.3], halfSize: [0.05, 0.11], mass: 1 };
    const distantBody = { ...directBody, index: 1, center: [0.82, 0.74] };
    const centerEvent = { point: [0.2, 0.3], direction: [1, 0], strength: 1 };
    const direct = resolveGlyphImpulse(directBody, centerEvent, viewport);
    const distant = resolveGlyphImpulse(distantBody, centerEvent, viewport);
    assert.ok(Math.hypot(...direct.force) > Math.hypot(...distant.force) * 50);
    assert.equal(direct.torque, 0);
    assert.ok(direct.arrivalDelayMs < distant.arrivalDelayMs);

    const left = resolveGlyphImpulse(directBody, {
      point: [0.16, 0.3], direction: [0, -1], strength: 1,
    }, viewport);
    const right = resolveGlyphImpulse(directBody, {
      point: [0.24, 0.3], direction: [0, -1], strength: 1,
    }, viewport);
    assert.ok(Math.abs(left.torque) > 0.05);
    assert.ok(Math.abs(right.torque) > 0.05);
    assert.equal(Math.sign(left.torque), -Math.sign(right.torque));

    const atRest = {
      displacement: [0, 0], velocity: [0, 0], angle: 0, angularVelocity: 0,
    };
    let state = stepGlyphPlanarState(atRest, left, 1 / 60);
    assert.ok(Math.hypot(...state.displacement) > 0);
    assert.ok(Math.abs(state.angle) > 0);
    const peak = Math.hypot(...state.displacement) + Math.abs(state.angle);
    for (let frame = 0; frame < 240; frame += 1) {
      state = stepGlyphPlanarState(state, { force: [0, 0], torque: 0 }, 1 / 60);
    }
    assert.ok(Math.hypot(...state.displacement) + Math.abs(state.angle) < peak * 0.05);
  }],
  ["The transformed glyph field drives both obstacles and volumetric rendering", () => {
    assert.match(liquidCompositeSource, /uniform vec2 u_textResolution/);
    assert.match(liquidCompositeSource, /uniform sampler2D u_glyphState/);
    assert.match(liquidCompositeSource, /readGlyphState\(u_glyphState, glyphIndex, 0\)/);
    assert.match(liquidCompositeSource, /sampleGlyphField\(glyphIndex, local\)/);
    assert.match(liquidCompositeSource, /readGlyphState\(u_glyphState, glyphIndex, 2\)/);
    assert.match(liquidCompositeSource, /orientGlyphNormal/);
    assert.match(liquidCompositeSource, /float opticalPath/);
    assert.match(liquidCompositeSource, /vec3 refractedBack/);
    assert.match(liquidCompositeSource, /max\(abs\(local\.x\), abs\(local\.y\)\) >= 0\.995/);
    assert.match(liquidCompositeSource, /tileUv = clamp/);
    assert.match(liquidCompositeSource, /uniform sampler2D u_velocityField/);
    assert.match(liquidCompositeSource, /vec2 sampleFluidVelocity/);
    assert.match(liquidCompositeSource, /ripple\.z \* vec2\(0\.62, 0\.29\)/);
    assert.match(liquidCompositeSource, /lensOffset \* 0\.50/);
    assert.match(liquidCompositeSource, /float titleCaustic/);
    assert.match(liquidCompositeSource, /for \(int volumeStep = 0; volumeStep < 9; volumeStep\+\+\)/);
    assert.match(liquidCompositeSource, /float volumeDistance = min\(raySignedDistance, rayDome - abs\(depth\)\)/);
    assert.match(liquidCompositeSource, /float sideVolume = max\(letterMask - frontFaceMask, 0\.0\)/);
    assert.doesNotMatch(liquidCompositeSource, /shallowDepthField|midDepthField|deepDepthField/);
    assert.match(liquidCompositeSource, /float internalDepth/);
    assert.match(fluidRendererSource, /vec3 glyphBoundary\(vec2 solverUv\)/);
    assert.match(fluidRendererSource, /texture\(u_obstacle, uv \+ vec2\(e\.x, 0\.0\)\)\.r/);
    assert.doesNotMatch(fluidRendererSource, /glyphObstacle\(uv \+ vec2/);
    assert.match(fluidRendererSource, /vec2 tangential = angularVelocity\.z \* vec2\(-screenOffset\.y, screenOffset\.x\)/);
    assert.match(fluidRendererSource, /for \(int volumeStep = 0; volumeStep < 9; volumeStep\+\+\)/);
    assert.match(fluidRendererSource, /glyphDome\(field\.g\) - abs\(depth\)/);
    assert.match(fluidRendererSource, /local \+= vec2\(orientation\.y \* local\.y, -orientation\.x \* local\.x\) \* 0\.16/);
    assert.match(fluidRendererSource, /vel = mix\(vel, boundaryVelocity, obstacle/);
    assert.match(fluidRendererSource, /bindTexture\(9, glyphState\?\.read \?\? null, simGlyphStateLocation\)/);
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
  ["Hero title, pointer, ripple, and framebuffer transforms share viewport space", () => {
    assert.match(heroTextMaskSource, /\(rect\.left \+ rect\.width \* 0\.5\) \/ Math\.max\(viewportWidth, 1\)/);
    assert.match(heroTextMaskSource, /\(rect\.top \+ rect\.height \* 0\.5\) \/ Math\.max\(viewportHeight, 1\)/);
    assert.match(fluidRendererSource, /pointer\.x \/ Math\.max\(width, 1\)/);
    assert.match(fluidRendererSource, /ripple\.x \* dpr/);
    assert.match(glyphPhysicsSource, /rest\.y -= u_glyphScrollOffset/);
    assert.match(liquidCompositeSource, /rest\.y -= u_glyphScrollOffset/);
    assert.match(fluidRendererSource, /rest\.y -= u_glyphScrollOffset/);
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
