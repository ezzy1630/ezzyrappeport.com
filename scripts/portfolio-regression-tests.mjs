/* eslint-disable no-console -- this script is a CLI regression reporter */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { BufferGeometry, Mesh, MeshBasicMaterial } from "three";
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
  decayScrollVelocity,
  liquidEmissionAllowed,
  scrollWakeStrength,
} from "../src/lib/portfolio/liquid-interaction.ts";
import { accumulateFixedSteps } from "../src/features/kinetic-canvas/physics/fixedStep.ts";
import {
  WORLD_DEPTH_ANCHORS,
  worldDepthForScroll,
} from "../src/lib/portfolio/world-state.ts";
import {
  canvasPointToUv,
  clientToCanvasPoint,
  clientToWaterUv,
  pointSegmentDistance,
  softLimitForce,
} from "../src/features/kinetic-canvas/physics/waterCoordinates.ts";
import {
  clickPressureFalloff,
  createGlyphBodies,
  deriveMassAndInertia,
  glyphHoverStrength,
  glyphPhaseForIdentity,
  hasFiniteGlyphBodyState,
  hoverFalloff,
  neighborArrivalDelay,
  nearestGlyphIndex,
  offCenterTorque,
  pairwiseSeparationImpulse,
  reducedMotionScale,
  wakeFalloff,
} from "../src/features/kinetic-canvas/physics/glyphRigidBodies.ts";
import {
  createGlyphInteractionState,
  scheduleGlyphReleaseDroplets,
  settleCancelledGlyph,
  transitionGlyphInteraction,
} from "../src/features/kinetic-canvas/interaction/glyphInteractionState.ts";
import { validateHeroManifest } from "../src/features/kinetic-canvas/renderer/underwater/heroManifest.ts";

const contentSource = readFileSync(new URL("../src/lib/portfolio/content.ts", import.meta.url), "utf8");
const underwaterRendererSource = readFileSync(
  new URL("../src/features/kinetic-canvas/renderer/underwater/underwaterHeroRenderer.ts", import.meta.url),
  "utf8",
);
const underwaterConfigSource = readFileSync(
  new URL("../src/features/kinetic-canvas/renderer/underwater/config.ts", import.meta.url),
  "utf8",
);
const bootStateSource = readFileSync(
  new URL("../src/features/kinetic-canvas/boot/heroBootState.ts", import.meta.url),
  "utf8",
);
const projectDetailSource = readFileSync(
  new URL("../src/app/project/[slug]/ProjectDetail.tsx", import.meta.url),
  "utf8",
);
const transitionLinkSource = readFileSync(
  new URL("../src/components/portfolio/ProjectTransitionLink.tsx", import.meta.url),
  "utf8",
);
const portfolioShellSource = readFileSync(
  new URL("../src/components/portfolio/PortfolioShell.tsx", import.meta.url),
  "utf8",
);
const worldStateSource = readFileSync(
  new URL("../src/lib/portfolio/world-state.ts", import.meta.url),
  "utf8",
);
const underwaterShaderSource = readFileSync(
  new URL("../src/features/kinetic-canvas/renderer/underwater/shaders.ts", import.meta.url),
  "utf8",
);
const liquidInteractionSource = readFileSync(
  new URL("../src/lib/portfolio/liquid-interaction.ts", import.meta.url),
  "utf8",
);
const kineticCanvasSource = readFileSync(
  new URL("../src/features/kinetic-canvas/KineticCanvas.tsx", import.meta.url),
  "utf8",
);
const revampCssSource = readFileSync(new URL("../src/app/revamp.css", import.meta.url), "utf8");
const globalsCssSource = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const projectsSectionCssSource = readFileSync(
  new URL("../src/components/portfolio/ProjectsSection.module.css", import.meta.url),
  "utf8",
);
const identitySource = readFileSync(
  new URL("../src/lib/portfolio/identity.ts", import.meta.url),
  "utf8",
);
const heroManifest = validateHeroManifest(JSON.parse(readFileSync(
  new URL("../public/assets/hero/ezzy-rappeport-glyphs.json", import.meta.url),
  "utf8",
)));

const tests = [
  ["Underwater coordinates stay canvas-local and preserve solver orientation", () => {
    const rect = { left: 100, top: 40, width: 800, height: 400 };
    assert.deepEqual(clientToCanvasPoint({ x: 300, y: 140 }, rect), { x: 200, y: 100 });
    assert.deepEqual(canvasPointToUv({ x: 200, y: 100 }, rect), { x: 0.25, y: 0.25 });
    assert.deepEqual(clientToWaterUv({ x: 300, y: 140 }, rect), { x: 0.25, y: 0.75 });
  }],
  ["Fixed-step accumulation is frame-rate independent and caps catch-up", () => {
    const at60 = accumulateFixedSteps(0, 1 / 60, 1 / 120, 4);
    const at30 = accumulateFixedSteps(0, 1 / 30, 1 / 120, 4);
    const paused = accumulateFixedSteps(0, 2, 1 / 120, 4);
    assert.equal(at60.steps, 2);
    assert.equal(at30.steps, 4);
    assert.equal(paused.steps, 4);
    assert.equal(paused.accumulator, 0);
  }],
  ["Pointer segment, wake, and click falloffs are local and monotonic", () => {
    assert.equal(pointSegmentDistance({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 }), 4);
    assert.ok(wakeFalloff(8, 40) > wakeFalloff(80, 40));
    assert.ok(clickPressureFalloff(8, 40) > clickPressureFalloff(80, 40));
    assert.ok(clickPressureFalloff(80, 40) < wakeFalloff(80, 40));
  }],
  ["Torque, mass, inertia, limits, neighbor delay, separation, and motion scaling are deterministic", () => {
    assert.equal(Math.sign(offCenterTorque([0, 0], [-1, 0], [0, -1])), 1);
    assert.equal(Math.sign(offCenterTorque([0, 0], [1, 0], [0, -1])), -1);
    const runtime = {
      manifest: heroManifest.glyphs[0],
      object: new Mesh(new BufferGeometry(), new MeshBasicMaterial()),
    };
    const derived = deriveMassAndInertia(runtime, 1);
    assert.ok(derived.mass > 0);
    assert.ok(derived.inertia.x > 0 && derived.inertia.y > 0 && derived.inertia.z > 0);
    assert.equal(softLimitForce(0.5, 1, 10), 0);
    assert.ok(softLimitForce(0.9, 1, 10) < 0);
    assert.ok(softLimitForce(-0.9, 1, 10) > 0);
    assert.ok(neighborArrivalDelay(110) < neighborArrivalDelay(220));
    assert.ok(pairwiseSeparationImpulse(20, 100) > pairwiseSeparationImpulse(80, 100));
    assert.equal(pairwiseSeparationImpulse(100, 100), 0);
    assert.equal(reducedMotionScale(false), 1);
    assert.equal(reducedMotionScale(true), 0.08);
  }],
  ["Glyph phases and hover ownership are deterministic and bounded", () => {
    const first = glyphPhaseForIdentity(3, "line1_Z");
    assert.equal(first, glyphPhaseForIdentity(3, "line1_Z"));
    assert.notEqual(first, glyphPhaseForIdentity(4, "line1_Z"));
    assert.ok(hoverFalloff(0, 100) > hoverFalloff(140, 100));
    const material = new MeshBasicMaterial();
    const glyphs = heroManifest.glyphs.slice(0, 2).map((manifest) => ({
      manifest,
      object: new Mesh(new BufferGeometry(), material),
    }));
    const bodies = createGlyphBodies(glyphs);
    bodies[0].projectedState.center.set(100, 100);
    bodies[0].projectedState.halfSize.set(20, 20);
    bodies[1].projectedState.center.set(200, 100);
    bodies[1].projectedState.halfSize.set(20, 20);
    assert.equal(nearestGlyphIndex(bodies, [102, 101]), bodies[0].glyph.manifest.glyph_index);
    assert.equal(nearestGlyphIndex(bodies, [500, 500]), -1);
    assert.ok(glyphHoverStrength(bodies[0], [100, 100]) > 0.9);
    bodies[0].position.x = Number.NaN;
    assert.equal(hasFiniteGlyphBodyState(bodies[0]), false);
  }],
  ["Glyph hold, cancellation, release, and droplet scheduling are explicit", () => {
    let transition = createGlyphInteractionState();
    transition = transitionGlyphInteraction(transition, { type: "hover", glyphIndex: 4 });
    assert.deepEqual(transition.state, { kind: "hovering", glyphIndex: 4 });
    transition = transitionGlyphInteraction(transition, {
      type: "pointer-down",
      glyphIndex: 4,
      pointerId: 9,
      pressPoint: [20, 10],
      now: 1,
    });
    assert.equal(transition.state.kind, "holding");
    transition = transitionGlyphInteraction(transition, { type: "pointer-up", pointerId: 9, now: 2 });
    assert.equal(transition.state.kind, "releasing");
    const releaseId = transition.state.releaseId;
    transition = transitionGlyphInteraction(transition, { type: "release-complete", releaseId });
    assert.equal(transition.state.kind, "idle");
    transition = transitionGlyphInteraction(transition, {
      type: "pointer-down",
      glyphIndex: 2,
      pointerId: 10,
      pressPoint: [0, 0],
      now: 3,
    });
    transition = transitionGlyphInteraction(transition, {
      type: "cancel",
      pointerId: 10,
      now: 3.2,
      reason: "blur",
    });
    assert.equal(transition.state.kind, "cancelled");
    assert.equal(settleCancelledGlyph(transition, null).state.kind, "idle");
    const droplets = scheduleGlyphReleaseDroplets(10);
    assert.equal(droplets.length, 5);
    assert.equal(droplets[0].dueAt, 10.032);
    assert.equal(droplets[4].dueAt, 10.08);
  }],
  ["Scroll currents are monotonic, directional, and lifecycle-gated", () => {
    assert.equal(scrollWakeStrength(0.1), 0);
    assert.ok(scrollWakeStrength(0.7) > scrollWakeStrength(0.3));
    assert.equal(scrollWakeStrength(-0.7), scrollWakeStrength(0.7));
    assert.ok(Math.abs(decayScrollVelocity(1, 1)) < Math.abs(decayScrollVelocity(1, 0.1)));
    assert.equal(liquidEmissionAllowed({ visible: true, pageVisible: true, reducedMotion: false, rendererReady: true }), true);
    assert.equal(liquidEmissionAllowed({ visible: false, pageVisible: true, reducedMotion: false, rendererReady: true }), false);
    assert.equal(liquidEmissionAllowed({ visible: true, pageVisible: false, reducedMotion: false, rendererReady: true }), false);
    assert.equal(liquidEmissionAllowed({ visible: true, pageVisible: true, reducedMotion: true, rendererReady: true }), false);
    assert.equal(liquidEmissionAllowed({ visible: true, pageVisible: true, reducedMotion: false, rendererReady: false }), false);
  }],
  ["All 13 manifest glyphs become independent GLB body states", () => {
    const material = new MeshBasicMaterial();
    const geometryByIdentity = new Map();
    const glyphs = heroManifest.glyphs.map((manifest) => {
      const geometry = geometryByIdentity.get(manifest.shared_geometry_identifier) ?? new BufferGeometry();
      geometryByIdentity.set(manifest.shared_geometry_identifier, geometry);
      const object = new Mesh(geometry, material);
      object.position.fromArray(manifest.rest_transform.translation);
      object.quaternion.fromArray(manifest.rest_transform.rotation_xyzw);
      object.scale.fromArray(manifest.rest_transform.scale);
      return { manifest, object };
    });
    const bodies = createGlyphBodies(glyphs);
    assert.equal(bodies.length, 13);
    assert.equal(new Set(bodies.map((body) => body.position)).size, 13);
    assert.ok(glyphs[1].object.geometry === glyphs[2].object.geometry);
  }],
  ["Default underwater render graph wires persistent water, GLB transforms, linear depth, fallback, resize, and cleanup", () => {
    assert.match(underwaterShaderSource, /uniform sampler2D uPrevious/);
    assert.match(underwaterShaderSource, /velocity \+= laplacian/);
    assert.match(underwaterRendererSource, /accumulateFixedSteps/);
    assert.match(underwaterRendererSource, /stepGlyphBodies/);
    assert.ok(underwaterRendererSource.indexOf("stepGlyphBodies(") < underwaterRendererSource.indexOf("renderDepth(backDepthTarget"));
    assert.match(underwaterShaderSource, /linearViewDepth/);
    assert.doesNotMatch(underwaterShaderSource, /backDepth - frontDepth\) \* 155/);
    assert.match(liquidInteractionSource, /getCoalescedEvents/);
    assert.match(liquidInteractionSource, /kind: "wake"/);
    assert.match(liquidInteractionSource, /kind: "press"/);
    assert.match(underwaterRendererSource, /physics\.interactions/);
    assert.match(underwaterRendererSource, /heroGlb.*missing/s);
    assert.match(underwaterRendererSource, /clientToWaterUv/);
    assert.match(underwaterRendererSource, /ResizeObserver/);
    assert.match(underwaterRendererSource, /document\.hidden/);
    assert.match(underwaterRendererSource, /addEventListener\("visibilitychange"/);
    assert.match(underwaterRendererSource, /removeEventListener\("visibilitychange"/);
    assert.match(underwaterRendererSource, /lostpointercapture/);
    assert.match(underwaterRendererSource, /pointercancel/);
    assert.match(underwaterRendererSource, /surface-breach/);
    assert.match(underwaterRendererSource, /scheduledWater/);
    assert.match(liquidInteractionSource, /addEventListener\("blur"/);
    assert.match(liquidInteractionSource, /present: boolean/);
    assert.match(kineticCanvasSource, /liquid-renderer-ready/);
    assert.match(underwaterRendererSource, /heightRead\.dispose\(\)/);
    assert.match(underwaterRendererSource, /glyphDebug\?\.remove\(\)/);
    assert.doesNotMatch(underwaterShaderSource, /smoothstep\(width,\s*0\.0/);
    for (const match of underwaterShaderSource.matchAll(/smoothstep\((\d*\.?\d+),\s*(\d*\.?\d+),/g)) {
      assert.ok(Number(match[1]) < Number(match[2]), `smoothstep edges must ascend: ${match[0]}`);
    }
  }],
  ["Procedural volume owns production water while posters fail closed", () => {
    for (const asset of [
      "shallow-desktop-v1.webp",
      "shallow-portrait-v1.webp",
      "mid-depth-v1.webp",
      "deep-basin-v1.webp",
    ]) {
      const url = new URL(`../public/assets/water/${asset}`, import.meta.url);
      assert.ok(existsSync(url), `${asset} must exist`);
      assert.ok(statSync(url).size > 10_000, `${asset} must contain a fallback poster`);
    }
    assert.match(underwaterRendererSource, /authored-radiance-live-volume-v4/);
    assert.match(underwaterRendererSource, /authored-high-pass-v2/);
    assert.match(underwaterShaderSource, /Perspective floor projection/);
    assert.match(underwaterShaderSource, /Volumetric shafts/);
    assert.match(underwaterShaderSource, /marineSnowLayer/);
    assert.match(underwaterShaderSource, /uQualityTier/);
    assert.match(underwaterShaderSource, /Beer-Lambert-style blue absorption/);
    assert.match(underwaterShaderSource, /high-pass recovery restores subpixel caustic filaments/);
    assert.match(underwaterShaderSource, /opticalCenter - opticalLow/);
    assert.match(underwaterShaderSource, /sampleOpticalDetail/);
    // The authored plates may be warped and blended, but the background must
    // never become a raw, unmodulated texture paste.
    assert.doesNotMatch(underwaterShaderSource, /color\s*=\s*texture2D\(uOptical/);
    assert.match(underwaterRendererSource, /source\.geometry\.clone\(\)/);
    assert.match(underwaterRendererSource, /authored inflated Inter Tight mesh/);
    assert.doesNotMatch(underwaterRendererSource, /canvas\.clientWidth > 768/);
    assert.match(kineticCanvasSource, /renderHeroGlyphs: heroNameRef\.current/);
    assert.doesNotMatch(kineticCanvasSource, /webglFluidRenderer/);
  }],
  ["One continuous world drives depth, glyph exit, plates, and calm", () => {
    // The renderer consumes the shared world curve, not section presets.
    assert.match(underwaterRendererSource, /getPhysics\(\)\.world/);
    assert.match(underwaterRendererSource, /world\?\.depth \?\? 0/);
    assert.match(underwaterRendererSource, /world\?\.calm \?\? 0/);
    assert.match(underwaterRendererSource, /glyphExitForDepth/);
    assert.match(underwaterRendererSource, /plateForDepth/);
    assert.match(underwaterRendererSource, /canvas\.dataset\.worldDepth/);
    assert.doesNotMatch(underwaterRendererSource, /WATER_SECTION_THEME/);
    // The hero name exits by rising and dissolving, never by observer hide.
    assert.match(underwaterRendererSource, /glyphGroup\.visible = glyphsPresent/);
    assert.match(underwaterShaderSource, /uExitFade/);
    assert.doesNotMatch(underwaterRendererSource, /IntersectionObserver/);
    // Calm pocket and continuous plates reach the shaders.
    assert.match(underwaterShaderSource, /uniform float uCalm/);
    assert.match(underwaterShaderSource, /uniform float uPlate/);
  }],
  ["World depth is continuous, monotonic, reversible, and reaches the floor", () => {
    const ranges = [
      { id: "hero", top: 0, bottom: 900 },
      { id: "projects", top: 900, bottom: 5109 },
      { id: "about", top: 5109, bottom: 6318 },
      { id: "contact", top: 6318, bottom: 7218 },
    ];
    const vh = 900;
    const scrollHeight = 7218;
    // Endpoints: surface at rest, floor at page bottom.
    assert.equal(worldDepthForScroll(0, ranges, vh, scrollHeight), 0);
    assert.equal(worldDepthForScroll(6318, ranges, vh, scrollHeight), 1);
    // Monotonic non-decreasing across the whole document, and the upward
    // journey retraces the identical values (pure function of scrollY).
    let previous = -1;
    for (let y = 0; y <= 6318; y += 37) {
      const depth = worldDepthForScroll(y, ranges, vh, scrollHeight);
      assert.ok(depth >= previous, `depth must be monotonic at ${y}: ${depth} < ${previous}`);
      assert.ok(depth >= 0 && depth <= 1, `depth must stay normalized at ${y}`);
      previous = depth;
    }
    // The hero exit window and the basin descent both own real scroll room.
    assert.ok(worldDepthForScroll(450, ranges, vh, scrollHeight) > 0.03);
    assert.ok(worldDepthForScroll(6317, ranges, vh, scrollHeight) > 0.66);
    assert.equal(worldDepthForScroll(5418, ranges, vh, scrollHeight), WORLD_DEPTH_ANCHORS.contactApproach);
    // Sampling the same scroll positions in reverse must reproduce the same
    // curve. This guards against hidden direction state or hysteresis.
    const forward = [0, 450, 900, 2700, 5109, 5418, 6000, 6318]
      .map((y) => worldDepthForScroll(y, ranges, vh, scrollHeight));
    const reverse = [6318, 6000, 5418, 5109, 2700, 900, 450, 0]
      .map((y) => worldDepthForScroll(y, ranges, vh, scrollHeight));
    assert.deepEqual(reverse.reverse(), forward);
  }],
  ["Water interaction is global across every section", () => {
    // No hero-only gate remains on wakes or presses.
    assert.doesNotMatch(liquidInteractionSource, /insideHero/);
    assert.doesNotMatch(liquidInteractionSource, /heroRect/);
    // The physics loop suspends only for hidden tabs, never for leaving the
    // hero viewport.
    assert.doesNotMatch(liquidInteractionSource, /visibilityObserver/);
    assert.doesNotMatch(liquidInteractionSource, /setRuntimeVisible/);
    // World state is computed into the shared physics object and published
    // as CSS vars for DOM consumers (navigation, sections).
    assert.match(liquidInteractionSource, /computeWorldState/);
    assert.match(liquidInteractionSource, /--world-depth/);
    assert.match(liquidInteractionSource, /--world-light/);
    // Suspended objects can displace and redirect the shared water.
    assert.match(liquidInteractionSource, /export function emitLiquidWake/);
    assert.match(liquidInteractionSource, /export function emitLiquidPress/);
  }],
  ["Reduced motion renders one frame and stops the loop", () => {
    assert.match(underwaterRendererSource, /motionLoop = "stopped"/);
    assert.match(underwaterRendererSource, /renderOneStaticFrame/);
    assert.match(underwaterRendererSource, /addEventListener\("scroll", onStaticScroll/);
    assert.match(underwaterRendererSource, /removeEventListener\("scroll", onStaticScroll/);
  }],
  ["Mobile contact slab stays inside the viewport bounds", () => {
    // The desktop composition offsets are explicitly reset on small screens.
    assert.match(revampCssSource, /clipped the arrow/);
    assert.match(revampCssSource, /\.contact-basin__copy,\s*\n\s*\.contact-section__email,\s*\n\s*\.contact-section__location \{ transform: none; \}/);
    // The address never breaks mid-domain on phones.
    assert.match(revampCssSource, /white-space: nowrap;\s*\n\s*overflow-wrap: normal;/);
  }],
  ["MathPilot media clipping and nav/action collision guards stay in place", () => {
    assert.match(projectsSectionCssSource, /data-artifact="mathpilot"/);
    assert.match(projectsSectionCssSource, /contain: paint/);
    assert.match(revampCssSource, /nav CTA \+ motion toggle must not collide/);
    assert.match(revampCssSource, /\.site-nav-actions > \* \{\s*\n\s*flex-shrink: 0;/);
  }],
  ["Contact CTA uses a friendly label while mailto stays canonical", () => {
    assert.match(identitySource, /email: "ezzyrappeport@gmail\.com"/);
    assert.match(identitySource, /emailLabel: "contact ezzy"/);
    assert.doesNotMatch(identitySource, /gmaill\.com/);
  }],
  ["Hero glyph memory exits before the projects band", () => {
    assert.match(underwaterRendererSource, /GLYPH_EXIT_START_DEPTH = 0\.018/);
    assert.match(underwaterRendererSource, /GLYPH_EXIT_SPAN = 0\.062/);
    assert.match(worldStateSource, /projectsCalm/);
    assert.match(underwaterShaderSource, /Reading pockets/);
  }],
  ["Revamp stylesheet is the single owner for canvas and hero geometry", () => {
    assert.match(revampCssSource, /\.fluid-canvas\s*\{/);
    assert.match(revampCssSource, /\.hero-shell\s*\{/);
    assert.doesNotMatch(globalsCssSource, /\.fluid-canvas\s*\{/);
    assert.doesNotMatch(globalsCssSource, /\.hero-shell\s*\{/);
    assert.match(revampCssSource, /--world-depth/);
    assert.doesNotMatch(revampCssSource, /html\[data-water-section="(?:about|contact|case)"\]\s+\.fluid-canvas/);
    assert.doesNotMatch(revampCssSource, /background-image:\s*url\("\/assets\/water\/(?:mid-depth|deep-basin)/);
  }],
  ["Case-study routes use the shared water grammar", () => {
    assert.match(projectDetailSource, /CaseArrivalWater/);
    assert.match(projectDetailSource, /routeMode="case"/);
    assert.match(projectDetailSource, /data-liquid-hover/);
    assert.match(transitionLinkSource, /emitLiquidWake/);
    assert.match(transitionLinkSource, /transitionDirection/);
    assert.match(portfolioShellSource, /data-route=\{routeMode\}/);
    assert.match(revampCssSource, /portfolio-root\[data-route="case"\]/);
    assert.match(worldStateSource, /CASE_MOORING_DEPTH/);
    assert.match(worldStateSource, /lightForDepth\(CASE_MOORING_DEPTH\)/);
    assert.doesNotMatch(worldStateSource, /light: 0\.16/);
  }],
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


  ["Legacy fluid renderer path is gone", () => {
    assert.equal(existsSync(new URL("../src/features/kinetic-canvas/renderer/webglFluidRenderer.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../src/features/kinetic-canvas/shaders/liquidComposite.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../src/features/kinetic-canvas/shaders/glyphPhysics.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../src/features/kinetic-canvas/shaders/glyphStateCodec.ts", import.meta.url)), false);
    assert.equal(existsSync(new URL("../src/features/kinetic-canvas/physics/glyphImpulseModel.ts", import.meta.url)), false);
    assert.doesNotMatch(kineticCanvasSource, /webglFluidRenderer/);
  }],
  ["Underwater glass and boot contracts stay locked", () => {
    assert.match(underwaterConfigSource, /absorptionDistance: 1\.15/);
    assert.match(underwaterShaderSource, /uLetterEnergy/);
    assert.match(underwaterShaderSource, /Analytic capillary rings/);
    assert.match(bootStateSource, /poster/);
    assert.match(bootStateSource, /crossfade/);
    assert.match(kineticCanvasSource, /shouldEarlyFetchGlb/);
    assert.match(kineticCanvasSource, /--boot-crossfade-ms/);
    assert.match(projectDetailSource, /evidenceRail|railSticky|case-system/);
    assert.match(transitionLinkSource, /playWaterWipe|data-water-wipe|waterWipe/);
    assert.match(contentSource, /system:/);
    assert.match(contentSource, /argyph-identity\.webp/);
    assert.match(contentSource, /flowe\/app-icon\.webp/);
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
    assert.equal(resolveQualityTier({
      coarsePointer: false,
      saveData: false,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
      reducedMotion: true,
    }), "low");
  }],
  ["Adaptive downgrade is monotonic", () => {
    assert.equal(downgradeQualityTier("high"), "balanced");
    assert.equal(downgradeQualityTier("balanced"), "low");
    assert.equal(downgradeQualityTier("low"), "low");
  }],
  ["Movement wakes stay responsive, throttled, and clamped", () => {
    assert.equal(resolveMovementSplat({ distance: 3, now: 1000, lastAt: 0 }), null);
    assert.equal(resolveMovementSplat({ distance: 180, now: 1000, lastAt: 0 }), 0.28);
    assert.equal(resolveMovementSplat({ distance: 180, now: 1030, lastAt: 1000 }), null);
    assert.ok(Math.abs(resolveMovementSplat({ distance: 20, now: 1200, lastAt: 1000 }) - 0.10846153846153847) < 1e-12);
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
