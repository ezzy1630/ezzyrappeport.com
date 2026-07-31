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
  createGlyphImpulseBudget,
  holdPressureResponse,
  pressureProbeApproach,
  rechargeGlyphImpulseBudget,
  tryConsumeGlyphImpulse,
} from "../src/features/kinetic-canvas/physics/glyphImpulseBudget.ts";
import {
  createGlyphInteractionState,
  scheduleGlyphReleaseDroplets,
  settleCancelledGlyph,
  transitionGlyphInteraction,
} from "../src/features/kinetic-canvas/interaction/glyphInteractionState.ts";
import { validateHeroManifest } from "../src/features/kinetic-canvas/renderer/underwater/heroManifest.ts";
import {
  opticalTierPolicy,
  relativeRefractionEta,
  resolveGlyphAuthorship,
  schlickF0,
  WATER_IOR,
} from "../src/features/kinetic-canvas/renderer/underwater/glyphAuthorship.ts";

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
const caseEvidenceRailSource = readFileSync(
  new URL("../src/components/portfolio/CaseEvidenceRail.tsx", import.meta.url),
  "utf8",
);
const systemDiagramSource = readFileSync(
  new URL("../src/components/portfolio/diagrams/SystemDiagram.tsx", import.meta.url),
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
    assert.match(underwaterRendererSource, /applyCameraRig/);
    assert.match(underwaterRendererSource, /staggeredGlyphRelease/);
    assert.match(underwaterRendererSource, /breachExposureBoost/);
    assert.match(underwaterRendererSource, /scheduledWater/);
    assert.match(liquidInteractionSource, /addEventListener\("blur"/);
    assert.match(liquidInteractionSource, /present: boolean/);
    assert.match(kineticCanvasSource, /liquid-renderer-ready/);
    assert.match(kineticCanvasSource, /hero-breach-complete/);
    assert.match(kineticCanvasSource, /breachMsForVisit/);
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
    // Structural shader contracts (symbols), not comment prose.
    assert.match(underwaterShaderSource, /marineSnowLayer/);
    assert.match(underwaterShaderSource, /uQualityTier/);
    assert.match(underwaterShaderSource, /shaftCount/);
    assert.match(underwaterShaderSource, /calmRayBoost/);
    assert.match(underwaterShaderSource, /opticalCenter - opticalLow/);
    assert.match(underwaterShaderSource, /sampleOpticalDetail/);
    assert.match(underwaterShaderSource, /abyssMix/);
    assert.match(underwaterShaderSource, /bioSpark|biolum/);
    assert.match(underwaterShaderSource, /pow\(max\(0\.0,\s*1\.0 - abs\(vUv\.x - center\)/);
    // The authored plates may be warped and blended, but the background must
    // never become a raw, unmodulated texture paste.
    assert.doesNotMatch(underwaterShaderSource, /color\s*=\s*texture2D\(uOptical/);
    assert.match(underwaterRendererSource, /source\.geometry\.clone\(\)/);
    assert.match(underwaterRendererSource, /authored inflated Inter Tight mesh/);
    assert.doesNotMatch(underwaterRendererSource, /canvas\.clientWidth > 768/);
    assert.match(kineticCanvasSource, /renderHeroGlyphs: heroNameRef\.current/);
    assert.doesNotMatch(kineticCanvasSource, /webglFluidRenderer/);
  }],
  ["One continuous world drives depth, plates, calm; hero journey owns glyph release", () => {
    // The renderer consumes the shared world curve, not section presets.
    assert.match(underwaterRendererSource, /getPhysics\(\)\.world/);
    assert.match(underwaterRendererSource, /world\?\.depth \?\? 0/);
    assert.match(underwaterRendererSource, /world\?\.calm \?\? 0/);
    assert.match(underwaterRendererSource, /plateForDepth/);
    assert.match(underwaterRendererSource, /canvas\.dataset\.worldDepth/);
    assert.doesNotMatch(underwaterRendererSource, /WATER_SECTION_THEME/);
    // Milestone 2: glyph release rides the approved hero journey from the
    // sole ScrollDirector — never a second DOM-derived depth mapping.
    assert.doesNotMatch(underwaterRendererSource, /glyphExitForDepth/);
    assert.match(underwaterRendererSource, /heroProgressForJourney/);
    assert.match(underwaterRendererSource, /heroPhaseState/);
    // The hero name exits by rising and dissolving, never by observer hide.
    assert.match(underwaterRendererSource, /glyphGroup\.visible = glyphsPresent/);
    assert.match(underwaterRendererSource, /staggeredGlyphRelease/);
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
    assert.match(liquidInteractionSource, /export function emitLiquidShockwave/);
    assert.match(liquidInteractionSource, /kind: "shockwave"/);
    assert.match(liquidInteractionSource, /POINTER_ENERGY_TAU_DECAY/);
    // Heightfield accepts anisotropic + annular ring splat modes.
    assert.match(underwaterRendererSource, /eccentricity/);
    assert.match(underwaterRendererSource, /uShockwave/);
    const heightfieldShaders = readFileSync(
      new URL("../src/features/kinetic-canvas/renderer/underwater/shaders.ts", import.meta.url),
      "utf8",
    );
    assert.match(heightfieldShaders, /eccentricity < -0\.5/);
    assert.match(heightfieldShaders, /uShockwave/);
    assert.match(
      readFileSync(new URL("../src/features/kinetic-canvas/physics/glyphRigidBodies.ts", import.meta.url), "utf8"),
      /kind: "wake" \| "press" \| "release" \| "feedback" \| "shockwave"/,
    );
  }],
  ["Reduced motion renders one frame and stops the loop", () => {
    assert.match(underwaterRendererSource, /motionLoop = "stopped"/);
    assert.match(underwaterRendererSource, /renderOneStaticFrame/);
    assert.match(underwaterRendererSource, /subscribeJourneyScroll\(onViewportMove\)/);
    assert.match(underwaterRendererSource, /unsubscribeJourneyScroll/);
    assert.match(underwaterRendererSource, /reducedMotionRef\.current\) onStaticScroll/);
  }],
  ["Portfolio runtime shares one unified frame clock", async () => {
    const frameClockSource = readFileSync(
      new URL("../src/lib/portfolio/frame-clock.ts", import.meta.url),
      "utf8",
    );
    const smoothScrollSource = readFileSync(
      new URL("../src/components/portfolio/SmoothScrollProvider.tsx", import.meta.url),
      "utf8",
    );
    const scrollChoreographySource = readFileSync(
      new URL("../src/lib/portfolio/scroll-choreography.ts", import.meta.url),
      "utf8",
    );
    assert.match(frameClockSource, /export function subscribeFrameClock/);
    assert.match(frameClockSource, /export function bindGsapToFrameClock/);
    assert.match(frameClockSource, /export function unbindGsapFromFrameClock/);
    assert.match(frameClockSource, /gsap\.ticker\.remove\(gsap\.updateRoot\)/);
    // Milestone 0: subscriber isolation + finally-scheduled next frame.
    assert.match(frameClockSource, /faultPolicy\.noteFailure/);
    assert.match(frameClockSource, /finally\s*\{/);
    assert.match(frameClockSource, /scheduleNextFrame/);
    assert.match(frameClockSource, /export function frameClockFaults/);
    assert.match(
      readFileSync(
        new URL("../src/features/ocean-experience/runtime/frame-fault-policy.ts", import.meta.url),
        "utf8",
      ),
      /export class FrameFaultPolicy/,
    );

    // Behavioral pump isolation: one throwing subscriber cannot freeze others.
    const {
      subscribeFrameClock,
      unsubscribeFrameClock,
      frameClockIsSubscriberDisabled,
      resetFrameClockFaults,
      frameClockSubscriberCount,
    } = await import("../src/lib/portfolio/frame-clock.ts");
    resetFrameClockFaults();
    const previousRaf = globalThis.requestAnimationFrame;
    const previousCancel = globalThis.cancelAnimationFrame;
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    let rafCb = null;
    const fakeWindow = {
      requestAnimationFrame: (cb) => {
        rafCb = cb;
        return 1;
      },
      cancelAnimationFrame: () => {
        rafCb = null;
      },
    };
    globalThis.window = fakeWindow;
    globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
    globalThis.requestAnimationFrame = fakeWindow.requestAnimationFrame;
    globalThis.cancelAnimationFrame = fakeWindow.cancelAnimationFrame;
    let healthy = 0;
    try {
      subscribeFrameClock("test.healthy", () => {
        healthy += 1;
      });
      subscribeFrameClock("test.boom", () => {
        throw new Error("boom");
      });
      for (let i = 0; i < 4; i += 1) {
        const cb = rafCb;
        assert.ok(cb, "clock must schedule next frame");
        rafCb = null;
        cb(16 * (i + 1));
      }
      assert.equal(frameClockIsSubscriberDisabled("test.boom"), true);
      assert.ok(healthy >= 3, "healthy subscriber must keep receiving frames");
      assert.ok(frameClockSubscriberCount() >= 2);
    } finally {
      unsubscribeFrameClock("test.healthy");
      unsubscribeFrameClock("test.boom");
      resetFrameClockFaults();
      globalThis.requestAnimationFrame = previousRaf;
      globalThis.cancelAnimationFrame = previousCancel;
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    }
    // Continuous loops subscribe to the clock instead of owning requestAnimationFrame.
    assert.match(liquidInteractionSource, /subscribeFrameClock\(LIQUID_CLOCK_ID/);
    assert.doesNotMatch(liquidInteractionSource, /requestAnimationFrame/);
    assert.match(underwaterRendererSource, /subscribeFrameClock\(renderClockId/);
    assert.doesNotMatch(underwaterRendererSource, /requestAnimationFrame\(render/);
    assert.match(smoothScrollSource, /new Lenis\(/);
    assert.match(smoothScrollSource, /autoRaf:\s*false/);
    assert.match(smoothScrollSource, /syncTouch:\s*false/);
    assert.match(smoothScrollSource, /lenis\?\.raf\(timeMs\)/);
    assert.match(scrollChoreographySource, /export function initScrollChoreography/);
    assert.match(scrollChoreographySource, /export function createPinnedBeat/);
    assert.match(scrollChoreographySource, /export function createScrubBeat/);
    assert.match(scrollChoreographySource, /ScrollTrigger/);
    // Phase 3 descent beats: shared projects scrub + section reveals (no long pins).
    const descentBeatsSource = readFileSync(
      new URL("../src/components/portfolio/DescentBeats.tsx", import.meta.url),
      "utf8",
    );
    assert.match(descentBeatsSource, /createScrubBeat/);
    assert.match(descentBeatsSource, /data-section-reveal|sectionReveal/);
    assert.match(descentBeatsSource, /abyssArrived|abyss-arrived/);
    assert.match(descentBeatsSource, /unbindGsapFromFrameClock/);
    assert.match(descentBeatsSource, /descent choreography init failed|revealInstant/);
    assert.doesNotMatch(descentBeatsSource, /pin:\s*true/);
    assert.match(revampCssSource, /\[data-section-reveal="out"\]/);
    assert.match(revampCssSource, /--abyss-biolum/);
    assert.match(worldStateSource, /aboutCalm/);
    // Authored camera rig lives outside the 2k-line renderer.
    const cameraRigSource = readFileSync(
      new URL("../src/features/kinetic-canvas/renderer/underwater/cameraRig.ts", import.meta.url),
      "utf8",
    );
    assert.match(cameraRigSource, /export function applyCameraRig/);
    assert.match(cameraRigSource, /introProgress/);
    assert.match(cameraRigSource, /worldDepth/);
    assert.match(cameraRigSource, /CAMERA_RIG/);
    assert.match(cameraRigSource, /deviceTilt/);
    assert.match(cameraRigSource, /tiltX/);
    const deviceTiltSource = readFileSync(
      new URL("../src/lib/portfolio/device-tilt.ts", import.meta.url),
      "utf8",
    );
    assert.match(deviceTiltSource, /export async function enableDeviceTiltFromGesture/);
    assert.match(deviceTiltSource, /requestPermission/);
    assert.match(deviceTiltSource, /setDeviceTiltAllowed/);
    assert.match(deviceTiltSource, /ensureLifecycleListeners/);
    assert.match(deviceTiltSource, /tearDownLifecycleListeners/);
    assert.match(deviceTiltSource, /const LIVE: DeviceTiltSample/);
    assert.match(portfolioShellSource, /enableDeviceTiltFromGesture/);
    assert.match(liquidInteractionSource, /TOUCH_PRESS_RADIUS|SHOCKWAVE_TOUCH_STRENGTH/);
    assert.match(revampCssSource, /\(pointer: coarse\)/);
    assert.match(revampCssSource, /--device-tilt-x/);
  }],
  ["Mobile contact slab stays inside the viewport bounds", () => {
    // The desktop composition offsets are explicitly reset on small screens.
    assert.match(revampCssSource, /clipped the arrow/);
    assert.match(revampCssSource, /\.contact-basin__copy,\s*\n\s*\.contact-section__email,\s*\n\s*\.contact-section__location \{ transform: none; \}/);
    // The address never breaks mid-domain on phones.
    assert.match(revampCssSource, /white-space: nowrap;\s*\n\s*overflow-wrap: normal;/);
  }],
  ["Project identity marks stay scene-native without white media wells", () => {
    assert.match(projectsSectionCssSource, /data-project-identity="mathpilot"/);
    assert.match(projectsSectionCssSource, /\.identityStage/);
    assert.match(projectsSectionCssSource, /\.media \{\s*\n[\s\S]*?background: transparent;/);
    assert.doesNotMatch(projectsSectionCssSource, /data-artifact=/);
    assert.match(revampCssSource, /\.site-nav-actions > \* \{\s*\n\s*flex-shrink: 0;/);
    assert.match(revampCssSource, /\.site-nav-ripple/);
  }],
  ["Contact CTA uses a friendly label while mailto stays canonical", () => {
    assert.match(identitySource, /email: "ezzyrappeport@gmail\.com"/);
    assert.match(identitySource, /emailLabel: "Email Ezzy"/);
    assert.doesNotMatch(identitySource, /gmaill\.com/);
  }],
  ["Hero glyph memory exits before the projects band", () => {
    // Milestone 2: release completes with the descent chapter (journey 0.22
    // desktop / 0.24 mobile), never lingering as a watermark behind projects.
    assert.match(underwaterRendererSource, /heroProgressForJourney/);
    assert.match(underwaterRendererSource, /glyphGroup\.visible = glyphsPresent/);
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
    const dpr = pixelBudgetedDpr(2560, 1440, 2, 2, 6_000_000);
    assert.ok(dpr <= 1.28);
    assert.ok(2560 * dpr * 1440 * dpr <= 6_000_000 + 1);
  }],
  ["Oversized CSS viewports can use a sub-1 DPR", () => {
    const dpr = pixelBudgetedDpr(3840, 2160, 2, 2, 6_000_000);
    assert.ok(dpr < 1);
    assert.ok(dpr >= MIN_PIXEL_BUDGET_DPR);
    assert.ok(3840 * dpr * 2160 * dpr <= 6_000_000 + 1);
  }],
  ["Animated tiers stay inside their fill-rate budgets", () => {
    assert.ok(QUALITY_PIXEL_BUDGETS.high * TARGET_FPS_BY_TIER.high <= 384_000_000);
    assert.ok(QUALITY_PIXEL_BUDGETS.balanced * TARGET_FPS_BY_TIER.balanced <= 200_000_000);
    assert.ok(QUALITY_PIXEL_BUDGETS.low * TARGET_FPS_BY_TIER.low <= 96_000_000);
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
    const assetUrlsSource = readFileSync(
      new URL("../src/features/kinetic-canvas/renderer/underwater/assetUrls.ts", import.meta.url),
      "utf8",
    );
    assert.match(underwaterConfigSource, /absorptionDistance: 0\.82/);
    {
      const distortionMatch = underwaterConfigSource.match(/surfaceDistortion:\s*([0-9.]+)/);
      assert.ok(distortionMatch, "surfaceDistortion must be declared");
      const distortion = Number.parseFloat(distortionMatch[1]);
      assert.ok(Number.isFinite(distortion) && distortion > 0.04 && distortion < 0.2,
        `surfaceDistortion ${distortion} out of expected optical range`);
    }
    assert.match(assetUrlsSource, /MAX_DESKTOP_RENDER_DPR = 2/);
    assert.match(assetUrlsSource, /export function exposureForDepth/);
    assert.match(underwaterConfigSource, /exposureForDepth/);
    assert.doesNotMatch(underwaterConfigSource, /from ["']three["']/);
    assert.doesNotMatch(underwaterConfigSource, /TONE_MAPPER_NAMES/);
    assert.doesNotMatch(assetUrlsSource, /from ["']three["']/);
    assert.match(underwaterShaderSource, /uLetterEnergy/);
    assert.match(underwaterShaderSource, /rimBoost/);
    assert.match(underwaterRendererSource, /dataset\.warmup/);
    assert.match(underwaterRendererSource, /userData\.renderScale/);
    assert.match(underwaterRendererSource, /source\.scale\.x/);
    assert.match(underwaterRendererSource, /if \(glyphsPresent\)/);
    assert.match(underwaterRendererSource, /offHero/);
    assert.match(underwaterRendererSource, /backdropScene/);
    assert.match(underwaterRendererSource, /renderer\.resetState\(\)/);
    assert.match(underwaterRendererSource, /scene\.background = null/);
    assert.match(underwaterRendererSource, /renderer\.autoClear = false/);
    assert.match(underwaterRendererSource, /renderer\.clearDepth\(\)/);
    assert.match(underwaterRendererSource, /refreshCanvasRect/);
    assert.match(underwaterRendererSource, /heroMetrics/);
    assert.match(bootStateSource, /poster/);
    assert.match(kineticCanvasSource, /shouldEarlyFetchGlb/);
    assert.match(kineticCanvasSource, /--boot-crossfade-ms/);
    assert.match(kineticCanvasSource, /startInFlight/);
    assert.match(kineticCanvasSource, /breachTimer/);
    assert.match(kineticCanvasSource, /resolveEffectiveReducedMotion/);
    assert.match(kineticCanvasSource, /from "\.\/renderer\/underwater\/assetUrls"/);
    assert.match(projectDetailSource, /CaseEvidenceRail|evidenceRail|railSticky|case-system/);
    assert.match(caseEvidenceRailSource, /evidenceRail|railSticky|case-system/);
    assert.match(projectDetailSource, /SystemDiagram/);
    assert.match(systemDiagramSource, /prefers-reduced-motion|useReducedMotion|data-drawn/);
    assert.match(contentSource, /projectDiagrams/);
    assert.match(transitionLinkSource, /playWaterWipe|data-water-wipe|waterWipe/);
    assert.match(transitionLinkSource, /navigateWithDive|startViewTransition|canStartViewTransition/);
    assert.match(transitionLinkSource, /transition\?\.ready\.catch/);
    assert.match(transitionLinkSource, /transition\?\.finished\.catch/);
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
    // Phone-class coarse stays on a *live* low tier — never static from coarse alone.
    assert.equal(resolveQualityTier({
      coarsePointer: true,
      anyFinePointer: false,
      saveData: false,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 390,
    }), "low");
    // Hybrid touch laptop with a fine pointer keeps the desktop ladder.
    assert.equal(resolveQualityTier({
      coarsePointer: true,
      anyFinePointer: true,
      saveData: false,
      deviceMemory: 8,
      hardwareConcurrency: 8,
      viewportWidth: 1440,
    }), "balanced");
    // Narrow coarse viewport stays low even if any-pointer:fine is misreported.
    assert.equal(resolveQualityTier({
      coarsePointer: true,
      anyFinePointer: true,
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

  ["General Sans is self-hosted and VeloxMark is retired into ProjectIdentity", () => {
    assert.equal(existsSync(new URL("../public/fonts/general-sans/GeneralSans-Regular.woff2", import.meta.url)), true);
    assert.equal(existsSync(new URL("../public/fonts/general-sans/GeneralSans-Medium.woff2", import.meta.url)), true);
    assert.equal(existsSync(new URL("../public/fonts/general-sans/GeneralSans-Semibold.woff2", import.meta.url)), true);
    assert.match(readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8"), /next\/font\/local/);
    assert.equal(existsSync(new URL("../src/components/portfolio/VeloxMark.tsx", import.meta.url)), false);
    assert.match(readFileSync(new URL("../src/components/portfolio/ProjectIdentity.tsx", import.meta.url), "utf8"), /function VeloxMark/);
    assert.match(underwaterRendererSource, /MeshoptDecoder/);
    assert.ok(statSync(new URL("../public/assets/hero/ezzy-rappeport-glyphs.glb", import.meta.url)).size < 250_000);
    assert.match(readFileSync(new URL("../src/components/portfolio/ProjectsSection.module.css", import.meta.url), "utf8"), /data-layout="immersive"[\s\S]*padding-left/);
    assert.doesNotMatch(readFileSync(new URL("../src/components/portfolio/ProjectsSection.module.css", import.meta.url), "utf8"), /\.heading \{[\s\S]*filter: blur\(5px\)/);
  }],

  ["Meshopt glyph world extents stay within 15% of manifest physics extents", async () => {
    const { pathToFileURL } = await import("node:url");
    const path = await import("node:path");
    const { readFile } = await import("node:fs/promises");
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const { MeshoptDecoder } = await import("three/examples/jsm/libs/meshopt_decoder.module.js");
    const { FileLoader } = await import("three");
    const root = new URL("..", import.meta.url).pathname;
    const previous = FileLoader.prototype.load;
    FileLoader.prototype.load = function loadLocal(url, onLoad, onProgress, onError) {
      const filePath = String(url).startsWith("file:")
        ? new URL(url).pathname
        : path.resolve(root, String(url).replace(/^\//, ""));
      readFile(filePath).then((buf) => onLoad(buf.buffer)).catch(onError);
    };
    try {
      await MeshoptDecoder.ready;
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const glbUrl = pathToFileURL(path.join(root, "public/assets/hero/ezzy-rappeport-glyphs.glb")).href;
      const gltf = await loader.loadAsync(glbUrl);
      const glyph = heroManifest.glyphs.find((entry) => entry.object_node_name === "line1_E_00");
      assert.ok(glyph);
      const mesh = gltf.scene.getObjectByName(glyph.object_node_name);
      assert.ok(mesh);
      mesh.geometry.computeBoundingBox();
      const bb = mesh.geometry.boundingBox;
      const geomSize = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z];
      const worldGlb = geomSize.map((value, index) => value * mesh.scale.getComponent(index)).sort((a, b) => a - b);
      const local = glyph.local_bounding_box;
      const manifestSize = [
        local.max[0] - local.min[0],
        local.max[1] - local.min[1],
        local.max[2] - local.min[2],
      ];
      const worldManifest = manifestSize
        .map((value, index) => value * glyph.rest_transform.scale[index])
        .sort((a, b) => a - b);
      for (let index = 0; index < 3; index += 1) {
        const ratio = worldGlb[index] / Math.max(worldManifest[index], 1e-6);
        assert.ok(ratio > 0.85 && ratio < 1.15, `extent[${index}] ratio ${ratio}`);
      }
      // Guard the bug class: applying manifest scale to quantized local geom oversizes by ~3.6x.
      const wrong = geomSize.map((value, index) => value * glyph.rest_transform.scale[index]);
      assert.ok(Math.max(...wrong) > Math.max(...worldGlb) * 2);
    } finally {
      FileLoader.prototype.load = previous;
    }
  }],

  ["Depth-band design system and Phase 5 extras stay wired", () => {
    assert.match(revampCssSource, /\[data-depth-band="surface"\]/);
    assert.match(revampCssSource, /\[data-depth-band="deep"\]/);
    assert.match(revampCssSource, /--rv-ease|cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
    assert.doesNotMatch(readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8"), /Inter_Tight/);
    assert.doesNotMatch(readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8"), /next\/font\/google|Geist_Mono/);
    assert.match(readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8"), /fonts\/geist-mono/);
    assert.match(readFileSync(new URL("../src/lib/portfolio/sound.ts", import.meta.url), "utf8"), /setSoundEnabled/);
    assert.equal(existsSync(new URL("../src/app/resume/page.tsx", import.meta.url)), true);
    assert.equal(existsSync(new URL("../src/app/sitemap.ts", import.meta.url)), true);
    assert.equal(existsSync(new URL("../src/components/portfolio/AbyssEasterEgg.tsx", import.meta.url)), true);
    assert.doesNotMatch(contentSource, /\u2014|—/);
    assert.doesNotMatch(contentSource, /\u2013|–/);
    assert.doesNotMatch(contentSource, /claims_ledger\.json/);
    assert.doesNotMatch(contentSource, /eleven-panel|eleven panels/i);
    assert.doesNotMatch(contentSource, /1,?080\+?\s*(curated|problem)/i);
    assert.match(contentSource, /613 curated problems/);
    assert.match(contentSource, /~246 unit tests/);
    assert.match(contentSource, /~26 end-to-end tests/);
    assert.match(contentSource, /Live tab takeover is still listed as future work/);
    assert.match(contentSource, /Yosys 0\.66/);
  }],
  ["Phase 5–6 mobile, tilt, and optimization invariants stay locked", () => {
    // Coarse phone-class → live low, never static from coarse alone.
    assert.equal(resolveQualityTier({
      coarsePointer: true,
      anyFinePointer: false,
      saveData: false,
      deviceMemory: 4,
      hardwareConcurrency: 4,
      viewportWidth: 390,
    }), "low");
    assert.notEqual(resolveQualityTier({
      coarsePointer: true,
      anyFinePointer: false,
      saveData: false,
      deviceMemory: 4,
      hardwareConcurrency: 4,
      viewportWidth: 390,
    }), "static");
    // Device tilt is gesture-gated (iOS requestPermission never on load).
    const deviceTiltSource = readFileSync(
      new URL("../src/lib/portfolio/device-tilt.ts", import.meta.url),
      "utf8",
    );
    assert.match(deviceTiltSource, /enableDeviceTiltFromGesture/);
    assert.match(deviceTiltSource, /requestPermission/);
    assert.match(deviceTiltSource, /Call from a user gesture/);
    assert.match(portfolioShellSource, /enableDeviceTiltFromGesture/);
    assert.match(portfolioShellSource, /pointerdown/);
    assert.match(portfolioShellSource, /setDeviceTiltAllowed\(motionEnabled && coarse\)/);
    // Content stays free of em/en dashes (editorial voice).
    assert.doesNotMatch(contentSource, /\u2014|\u2013|—|–/);
    // Nav section ownership shares world geometry (contact anticipation).
    // Milestone 0: ScrollDirector publishes water-section; shell mounts the bridge.
    assert.match(worldStateSource, /resolveDocumentWaterSection/);
    assert.match(worldStateSource, /contact\.top <= scrollY \+ viewportHeight \* 0\.62/);
    assert.match(worldStateSource, /portfolio-root\[data-route='case'\]/);
    assert.match(portfolioShellSource, /OceanExperienceBridge/);
    assert.match(
      readFileSync(
        new URL("../src/features/ocean-experience/scroll/ScrollDirector.ts", import.meta.url),
        "utf8",
      ),
      /resolveDocumentWaterSection/,
    );
    assert.match(
      readFileSync(
        new URL("../src/features/ocean-experience/scroll/ScrollDirector.ts", import.meta.url),
        "utf8",
      ),
      /dataset\.waterSection/,
    );
    assert.doesNotMatch(liquidInteractionSource, /dataset\.waterSection\s*=/);
    assert.match(liquidInteractionSource, /setAmbientDepth/);
    // Half-res depth + tighter adaptive floor for large canvases.
    assert.match(underwaterRendererSource, /depthScale/);
    assert.match(underwaterRendererSource, /MIN_RUNTIME_SCALE = 0\.68/);
    assert.match(underwaterShaderSource, /Click shockwave/);
    assert.match(underwaterShaderSource, /uShockwave/);
    // Frame clock still pauses when the tab is hidden.
    assert.match(
      readFileSync(new URL("../src/lib/portfolio/frame-clock.ts", import.meta.url), "utf8"),
      /document\.hidden/,
    );
    assert.match(underwaterRendererSource, /offHero/);
    assert.match(
      readFileSync(new URL("../src/lib/portfolio/sound.ts", import.meta.url), "utf8"),
      /export function setAmbientDepth/,
    );
    // Raster-backed identities lazy-mount via LazyProjectIdentity (SVG loading=lazy is ineffective).
    const projectIdentitySource = readFileSync(
      new URL("../src/components/portfolio/ProjectIdentity.tsx", import.meta.url),
      "utf8",
    );
    const lazyIdentitySource = readFileSync(
      new URL("../src/components/portfolio/LazyProjectIdentity.tsx", import.meta.url),
      "utf8",
    );
    assert.match(projectIdentitySource, /function IdentityAssetImage/);
    assert.doesNotMatch(projectIdentitySource, /loading:\s*"lazy"/);
    assert.equal(
      [...projectIdentitySource.matchAll(/<IdentityAssetImage\b/g)].length,
      5,
    );
    assert.match(lazyIdentitySource, /IntersectionObserver/);
    assert.match(lazyIdentitySource, /RASTER_SLUGS/);
    assert.match(
      readFileSync(new URL("../src/components/portfolio/ChartedWork.tsx", import.meta.url), "utf8"),
      /LazyProjectIdentity/,
    );
    // WebGL boot still yields to idle before the heavy chunk (TBT hygiene).
    assert.match(kineticCanvasSource, /requestIdleCallback/);
    assert.match(kineticCanvasSource, /timeout:\s*quality\.tier === "high" \? 900 : 1400/);
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
  ["Application audit: landmarks, modal, motion policy, timers, metadata, dead assets", async () => {
    const { createMotionPolicy } = await import("../src/lib/portfolio/motion-policy.ts");
    const off = createMotionPolicy({ osReducedMotion: true, siteMotionEnabled: true });
    assert.equal(off.effectsAllowed, false);
    assert.equal(off.liquidAllowed, false);
    assert.equal(off.soundAllowed, true);
    assert.equal(off.choreographyAllowed, false);
    const siteOff = createMotionPolicy({ osReducedMotion: false, siteMotionEnabled: false });
    assert.equal(siteOff.effectsAllowed, false);
    const on = createMotionPolicy({ osReducedMotion: false, siteMotionEnabled: true });
    assert.equal(on.effectsAllowed, true);

    const abyssSource = readFileSync(new URL("../src/components/portfolio/AbyssEasterEgg.tsx", import.meta.url), "utf8");
    assert.match(abyssSource, /aria-modal/);
    assert.match(abyssSource, /restoreFocusRef|restore\?\.focus/);
    assert.match(abyssSource, /HOLD_MS|1400/);
    assert.match(abyssSource, /onKeyUp/);
    assert.match(abyssSource, /Escape/);

    assert.match(projectDetailSource, /<main[\s\S]*id="main-content"/);
    assert.match(projectDetailSource, /<article>/);

    const heroIntroSource = readFileSync(new URL("../src/components/portfolio/HeroIntro.tsx", import.meta.url), "utf8");
    // §8.9 / §19: CTA and copy must never be inert or focus-blocked waiting on WebGL.
    assert.doesNotMatch(heroIntroSource, /liquid-renderer-ready/);
    assert.doesNotMatch(heroIntroSource, /setAttribute\("inert"/);
    assert.doesNotMatch(heroIntroSource, /tabIndex=\{revealed/);
    assert.doesNotMatch(heroIntroSource, /aria-hidden=\{.*revealed/);
    assert.match(heroIntroSource, /setRevealStep\(1\)/);

    const aboutDepthSource = readFileSync(new URL("../src/components/portfolio/AboutDepthPlanes.tsx", import.meta.url), "utf8");
    assert.match(aboutDepthSource, /createGeometryCache/);
    assert.doesNotMatch(aboutDepthSource, /getBoundingClientRect\(\)/);
    const contactSlabSource = readFileSync(new URL("../src/components/portfolio/ContactEmailSlab.tsx", import.meta.url), "utf8");
    assert.match(contactSlabSource, /createGeometryCache/);
    assert.match(contactSlabSource, /copiedTimerRef|clearTimeout/);

    assert.match(transitionLinkSource, /activeWipeTimer|clearTimeout/);
    const caseArrivalSource = readFileSync(new URL("../src/components/portfolio/CaseArrivalWater.tsx", import.meta.url), "utf8");
    assert.match(caseArrivalSource, /snapshot/);
    assert.match(caseArrivalSource, /removeProperty\("--world-depth"\)|setProperty\("--world-depth"/);

    const navSource = readFileSync(new URL("../src/components/portfolio/Navigation.tsx", import.meta.url), "utf8");
    assert.match(navSource, /depthMarkRef/);
    assert.match(navSource, /style\.getPropertyValue\("--world-depth"\)/);
    assert.doesNotMatch(navSource, /getComputedStyle/);

    const projectsInteractionSource = readFileSync(
      new URL("../src/components/portfolio/ProjectsInteraction.tsx", import.meta.url),
      "utf8",
    );
    assert.match(projectsInteractionSource, /stopFloatClockIfIdle|unregisterFloat/);
    assert.match(projectsInteractionSource, /readMotionPolicy/);

    const projectsCss = readFileSync(new URL("../src/components/portfolio/ProjectsSection.module.css", import.meta.url), "utf8");
    assert.match(projectsCss, /content-visibility:\s*auto/);
    assert.match(projectsCss, /contain-intrinsic-size/);

    const layoutSource = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
    assert.match(layoutSource, /email:\s*portfolioIdentity\.email/);
    assert.doesNotMatch(layoutSource, /mailto:\$\{portfolioIdentity\.email\}|email:\s*`mailto:/);
    assert.match(layoutSource, /creator:\s*"@ezzy1630"/);

    const projectPageSource = readFileSync(new URL("../src/app/project/[slug]/page.tsx", import.meta.url), "utf8");
    assert.match(projectPageSource, /twitter:\s*\{/);
    assert.match(projectPageSource, /offers:/);

    const sitemapSource = readFileSync(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");
    assert.match(sitemapSource, /SITE_LAST_MODIFIED/);
    assert.doesNotMatch(sitemapSource, /new Date\(\)/);

    const resumeSource = readFileSync(new URL("../src/app/resume/page.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(resumeSource, /\.replace\("https:\/\/", "https:\/\/"\)/);

    const nextConfigSource = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
    assert.match(nextConfigSource, /Content-Security-Policy/);
    assert.match(nextConfigSource, /X-Frame-Options/);

    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.match(String(pkg.packageManager ?? ""), /^npm@/);
    assert.equal(existsSync(new URL("../bun.lock", import.meta.url)), false);
    assert.equal(existsSync(new URL("../package-lock.json", import.meta.url)), true);

    assert.equal(existsSync(new URL("../public/projects/velox/velox-icon.png", import.meta.url)), false);
    assert.equal(existsSync(new URL("../public/projects/mathpilot/mathpilot-icon-512.png", import.meta.url)), false);
    assert.equal(existsSync(new URL("../public/assets/pearl-liquid-background.webp", import.meta.url)), false);
    assert.equal(existsSync(new URL("../public/assets/pearl-liquid-background-poster.webp", import.meta.url)), false);
    assert.doesNotMatch(contentSource, /mathpilot-icon-512\.png/);
    assert.doesNotMatch(revampCssSource, /\.liquid-glass-card|\.location-capsule|\.project-buttons-row|\.hero-section-anchors|\.work-item\b/);

    const navWillChange = readFileSync(new URL("../src/components/portfolio/Navigation.tsx", import.meta.url), "utf8");
    assert.match(navWillChange, /willChange = "transform, width"/);
    const rippleTick = navWillChange.match(/const tick = \([^)]*\) => \{[\s\S]*?\n    \};/);
    assert.ok(rippleTick, "nav ripple tick must exist");
    assert.doesNotMatch(rippleTick[0], /willChange/);

    const smoothScrollSource = readFileSync(
      new URL("../src/components/portfolio/SmoothScrollProvider.tsx", import.meta.url),
      "utf8",
    );
    assert.match(smoothScrollSource, /bindNativeScrollFallback|smooth scroll init failed/);

    const errorBoundarySource = readFileSync(
      new URL("../src/components/portfolio/ErrorBoundary.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(errorBoundarySource, /LiquidGlassCard/);
    assert.match(errorBoundarySource, /console\.error/);

    assert.equal(existsSync(new URL("../scripts/lib/chrome.mjs", import.meta.url)), true);
    assert.equal(existsSync(new URL("../public/fonts/geist-mono/GeistMono-Latin.woff2", import.meta.url)), true);

    const {
      isCasePathname,
      isNavTheme,
      navThemeFromSection,
    } = await import("../src/lib/portfolio/nav-theme.ts");
    assert.equal(navThemeFromSection("about"), "white-on-deep");
    assert.equal(navThemeFromSection("contact"), "white-on-deep");
    assert.equal(navThemeFromSection("hero"), "ink-on-light");
    assert.equal(navThemeFromSection("projects"), "ink-on-light");
    assert.equal(navThemeFromSection("case"), "ink-on-light");
    assert.equal(navThemeFromSection("unknown", 0.7), "white-on-deep");
    assert.equal(navThemeFromSection("unknown", 0.2), "ink-on-light");
    assert.equal(isCasePathname("/project/monkeyclaw"), true);
    assert.equal(isCasePathname("/"), false);
    assert.equal(isNavTheme("white-on-deep"), true);
    assert.equal(isNavTheme("nope"), false);
  }],
  ["Ocean experience Milestone 0: chapter schema, mappings, and ownership", async () => {
    const {
      CHAPTER_ORDER,
      DESKTOP_CHAPTER_RANGES,
      MOBILE_CHAPTER_RANGES,
      isChapterId,
      waterSectionForChapter,
      chapterIdFromHash,
    } = await import("../src/features/ocean-experience/contracts/chapter.ts");
    const {
      mapProgressToChapter,
      progressForChapterStart,
      progressForChapterMid,
      scrollYForRootProgress,
      progressFromRootScroll,
      validateChapterRanges,
      clamp01,
    } = await import("../src/features/ocean-experience/scroll/scroll-mapping.ts");
    const {
      createScrollDirector,
    } = await import("../src/features/ocean-experience/scroll/ScrollDirector.ts");
    const {
      applyScrollSample,
      getExperienceSnapshot,
      resetExperienceStore,
      subscribeExperience,
      setSceneStatus,
    } = await import("../src/features/ocean-experience/state/experience-store.ts");
    const {
      createFrameFaultPolicy,
    } = await import("../src/features/ocean-experience/runtime/frame-fault-policy.ts");
    const {
      createResourceRegistry,
    } = await import("../src/features/ocean-experience/runtime/resource-registry.ts");
    const {
      createExperienceRuntime,
    } = await import("../src/features/ocean-experience/runtime/ExperienceRuntime.ts");
    const {
      createNullSceneDirector,
    } = await import("../src/features/ocean-experience/runtime/NullSceneDirector.ts");
    const {
      shouldInterceptChapterHashClick,
    } = await import("../src/features/ocean-experience/navigation/chapter-hash-click.ts");
    const {
      resolveInputShaping,
      shapeScrollDelta,
    } = await import("../src/features/ocean-experience/scroll/input-shaping-policy.ts");
    const {
      FrameMsRingBuffer,
    } = await import("../src/features/ocean-experience/diagnostics/frame-stats.ts");
    const {
      resolveInitialPreferences,
      applyOsReducedMotionCeiling,
      sanitizePreferences,
      shouldUseSimpleStory,
      DEFAULT_PREFERENCES,
    } = await import("../src/features/ocean-experience/state/preferences-store.ts");

    assert.deepEqual(CHAPTER_ORDER, [
      "surface",
      "descent",
      "monkeyclaw",
      "etch",
      "flowe",
      "argyph",
      "charted-work",
      "about",
      "contact",
    ]);
    assert.equal(isChapterId("method"), false);
    assert.equal(isChapterId("observatory"), false);
    assert.equal(isChapterId("monkeyclaw"), true);
    validateChapterRanges(DESKTOP_CHAPTER_RANGES);
    validateChapterRanges(MOBILE_CHAPTER_RANGES);
    assert.equal(waterSectionForChapter("surface"), "hero");
    assert.equal(waterSectionForChapter("etch"), "projects");
    assert.equal(waterSectionForChapter("about"), "about");
    assert.equal(chapterIdFromHash("#contact"), "contact");
    assert.equal(chapterIdFromHash("#project-argyph"), "argyph");

    const midEtch = progressForChapterMid("etch", DESKTOP_CHAPTER_RANGES);
    const mapped = mapProgressToChapter(midEtch, DESKTOP_CHAPTER_RANGES);
    assert.equal(mapped.activeChapter, "etch");
    assert.ok(mapped.chapterProgress > 0.4 && mapped.chapterProgress < 0.6);

    // Inverse seek: progress → scrollY → progress reconstructs.
    const travel = 2000;
    const y = scrollYForRootProgress(0.57, 10, travel);
    const reconstructed = progressFromRootScroll({
      scrollY: y,
      rootOffsetTop: 10,
      authoredTravelPx: travel,
    });
    assert.ok(Math.abs(reconstructed - 0.57) < 1e-9);
    assert.equal(clamp01(2), 1);
    assert.equal(progressForChapterStart("surface", DESKTOP_CHAPTER_RANGES), 0);

    // Experience store notifies only on discrete fields.
    resetExperienceStore();
    let notifications = 0;
    const unsubscribe = subscribeExperience(() => {
      notifications += 1;
    });
    applyScrollSample({
      progress: 0.1,
      activeChapter: "surface",
      chapterProgress: 0.5,
      direction: 0,
      velocity: 12,
    });
    assert.equal(notifications, 0);
    applyScrollSample({
      progress: 0.25,
      activeChapter: "monkeyclaw",
      chapterProgress: 0.1,
      direction: 1,
      velocity: 20,
    });
    assert.equal(notifications, 1);
    setSceneStatus("ready");
    assert.equal(notifications, 2);
    assert.equal(getExperienceSnapshot().activeChapter, "monkeyclaw");
    unsubscribe();
    resetExperienceStore();

    // ScrollDirector: one listener, coalesced sample, exact seek.
    const cssRoot = {
      style: new Map(),
      dataset: {},
      offsetTop: 0,
      offsetParent: null,
      setProperty(key, value) {
        this.style.set(key, value);
      },
    };
    // Minimal HTMLElement-like root for CSS writes.
    const root = {
      style: {
        setProperty(key, value) {
          cssRoot.style.set(key, value);
        },
      },
      dataset: cssRoot.dataset,
      offsetTop: 0,
      offsetParent: null,
    };
    let scrollY = 0;
    const listeners = new Map();
    const fakeWindow = {
      innerWidth: 1440,
      innerHeight: 900,
      devicePixelRatio: 1,
      get scrollY() {
        return scrollY;
      },
      addEventListener(type, handler) {
        const list = listeners.get(type) ?? [];
        list.push(handler);
        listeners.set(type, list);
      },
      removeEventListener(type, handler) {
        const list = listeners.get(type) ?? [];
        listeners.set(type, list.filter((entry) => entry !== handler));
      },
      requestAnimationFrame(cb) {
        return setTimeout(() => cb(performance.now()), 0);
      },
      cancelAnimationFrame(id) {
        clearTimeout(id);
      },
      scrollTo({ top }) {
        scrollY = top;
      },
    };
    const previousWindow = globalThis.window;
    globalThis.window = fakeWindow;
    try {
      const director = createScrollDirector({
        root,
        publishWaterSection: false,
        getLayout: () => "desktop",
        getViewport: () => ({ width: 1440, height: 900, dpr: 1 }),
        getScrollMetrics: () => ({
          scrollY,
          rootOffsetTop: 0,
          authoredTravelPx: 1000,
        }),
        setScrollY: (yValue) => {
          scrollY = yValue;
        },
      });
      director.attach();
      assert.equal((listeners.get("scroll") ?? []).length, 1);
      assert.equal((listeners.get("resize") ?? []).length, 1);
      director.seekChapter("about");
      assert.equal(getExperienceSnapshot().activeChapter, "about");
      assert.ok(Math.abs(getExperienceSnapshot().progress - progressForChapterStart("about", DESKTOP_CHAPTER_RANGES)) < 1e-9);
      director.dispose();
      assert.equal((listeners.get("scroll") ?? []).length, 0);
    } finally {
      globalThis.window = previousWindow;
      resetExperienceStore();
    }

    // Frame fault policy disables after bounded failures.
    const policy = createFrameFaultPolicy({ disableAfter: 2 });
    policy.noteFailure("a", new Error("boom"), 1);
    assert.equal(policy.isDisabled("a"), false);
    policy.noteFailure("a", new Error("boom"), 2);
    assert.equal(policy.isDisabled("a"), true);
    policy.clear("a");
    assert.equal(policy.isDisabled("a"), false);

    // Resource registry retain/release + abortable load.
    const registry = createResourceRegistry();
    let disposed = 0;
    const releaseA = registry.acquire("mesh-a", () => ({
      dispose: () => {
        disposed += 1;
      },
    }));
    const releaseA2 = registry.acquire("mesh-a", () => ({
      dispose: () => {
        disposed += 1;
      },
    }));
    assert.equal(registry.retainCount("mesh-a"), 2);
    releaseA();
    assert.equal(disposed, 0);
    releaseA2();
    assert.equal(disposed, 1);
    const load = registry.beginLoad();
    assert.equal(load.isCurrent(), true);
    const stale = registry.beginLoad();
    assert.equal(load.isCurrent(), false);
    assert.equal(stale.isCurrent(), true);
    stale.abort();
    assert.equal(stale.signal.aborted, true);

    // ExperienceRuntime load/start/stop/dispose lifecycle.
    let clockCallbacks = 0;
    const runtime = createExperienceRuntime({
      createDirector: () => createNullSceneDirector(),
      mode: "animated",
      clock: {
        subscribe(_id, callback) {
          clockCallbacks += 1;
          callback(16, 16);
          return () => {
            clockCallbacks -= 1;
          };
        },
      },
      registry,
    });
    await runtime.load();
    assert.equal(runtime.getStatus(), "ready");
    runtime.start();
    assert.equal(clockCallbacks, 1);
    runtime.seek(0.4, 0);
    assert.ok(Math.abs(runtime.getDirector().getState().progress - 0.4) < 1e-9);
    runtime.dispose();
    assert.equal(runtime.getStatus(), "disposed");
    assert.equal(clockCallbacks, 0);

    // Preferences: OS reduced motion is a hard ceiling; sound independent.
    assert.equal(applyOsReducedMotionCeiling("full", true), "reduced");
    assert.equal(applyOsReducedMotionCeiling("full", false), "full");
    const resolved = resolveInitialPreferences({
      stored: { version: 1, motion: "full", sound: true },
      osReducedMotion: true,
    });
    assert.equal(resolved.motion, "reduced");
    assert.equal(resolved.sound, true);
    assert.equal(shouldUseSimpleStory({ ...DEFAULT_PREFERENCES, motion: "off" }), true);
    assert.equal(sanitizePreferences({ motion: "nope" }).motion, "full");

    // Input shaping default identity; hash click guard.
    assert.equal(resolveInputShaping(0.5).allowShaping, false);
    assert.equal(shapeScrollDelta(12), 12);
    assert.equal(
      shouldInterceptChapterHashClick(
        { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false },
        { target: "", download: "" },
      ),
      true,
    );
    assert.equal(
      shouldInterceptChapterHashClick(
        { button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false },
        { target: "", download: "" },
      ),
      false,
    );

    const ring = new FrameMsRingBuffer(8);
    for (let i = 0; i < 12; i += 1) ring.push(16 + (i % 3));
    assert.ok(ring.sampleCount <= 8);

    // Ownership: repo-wide sole document scroll owner is ScrollDirector.
    // SmoothScrollProvider may attach a temporary boot listener that detaches.
    const shellSource = readFileSync(
      new URL("../src/components/portfolio/PortfolioShell.tsx", import.meta.url),
      "utf8",
    );
    const navSource = readFileSync(
      new URL("../src/components/portfolio/Navigation.tsx", import.meta.url),
      "utf8",
    );
    const smoothSource = readFileSync(
      new URL("../src/components/portfolio/SmoothScrollProvider.tsx", import.meta.url),
      "utf8",
    );
    const directorSource = readFileSync(
      new URL("../src/features/ocean-experience/scroll/ScrollDirector.ts", import.meta.url),
      "utf8",
    );
    const geometryCacheSource = readFileSync(
      new URL("../src/lib/portfolio/geometry-cache.ts", import.meta.url),
      "utf8",
    );
    const dialogueSource = readFileSync(
      new URL("../src/hooks/portfolio/use-liquid-dialogue.ts", import.meta.url),
      "utf8",
    );
    const liquidSource = readFileSync(
      new URL("../src/lib/portfolio/liquid-interaction.ts", import.meta.url),
      "utf8",
    );
    assert.match(shellSource, /OceanExperienceBridge/);
    assert.doesNotMatch(shellSource, /useWaterSection/);
    assert.doesNotMatch(shellSource, /addEventListener\("scroll"/);
    assert.doesNotMatch(navSource, /addEventListener\("scroll"/);
    assert.match(smoothSource, /detachTemporaryScroll|getActiveScrollDirector/);
    assert.match(directorSource, /addEventListener\("scroll"/);
    assert.match(directorSource, /notifyJourneyScroll/);
    assert.match(geometryCacheSource, /subscribeJourneyScroll/);
    assert.doesNotMatch(geometryCacheSource, /addEventListener\("scroll"/);
    assert.match(dialogueSource, /subscribeJourneyScroll/);
    assert.doesNotMatch(dialogueSource, /addEventListener\("scroll"/);
    assert.doesNotMatch(underwaterRendererSource, /window\.addEventListener\(\s*"scroll"/);
    assert.match(underwaterRendererSource, /visualViewport\?\.addEventListener\("scroll"/);
    assert.doesNotMatch(liquidSource, /dataset\.waterSection\s*=/);
    assert.match(liquidSource, /subscribeJourneyResize/);
    assert.match(liquidSource, /detachTemporaryResize|getActiveScrollDirector/);
    assert.match(directorSource, /dataset\.waterSection/);
    assert.match(shellSource, /setPreferences\(\{\s*motion:/);
    // Force sample notifies only after committed sample fields update.
    assert.match(
      directorSource,
      /this\.lastProgress = progress;\s*[\s\S]*?if \(force\) \{\s*notifyJourneyScroll\(\);/,
    );

    // Repo inventory: only ScrollDirector + SmoothScroll temporary boot may
    // attach window document scroll listeners in src/.
    const { readdirSync, statSync: fsStat } = await import("node:fs");
    const { join } = await import("node:path");
    const scrollOwners = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        const st = fsStat(full);
        if (st.isDirectory()) {
          if (name === "node_modules" || name === ".next") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|mjs|js)$/.test(name)) continue;
        const text = readFileSync(full, "utf8");
        // Document journey scroll attachment: window.* or runtimeWindow alias.
        if (
          /window\.addEventListener\(\s*["']scroll["']/.test(text)
          || /\bwin\.addEventListener\(\s*["']scroll["']/.test(text)
        ) {
          scrollOwners.push(full.replace(/\\/g, "/"));
        }
      }
    };
    walk(new URL("../src", import.meta.url).pathname);
    const relativeOwners = [...new Set(scrollOwners.map((path) => path.split("/src/").pop()))];
    assert.deepEqual(
      relativeOwners.sort(),
      [
        "components/portfolio/SmoothScrollProvider.tsx",
        "features/ocean-experience/scroll/ScrollDirector.ts",
      ].sort(),
    );

    // ExperienceRuntime must not double-dispose after dispose-during-load.
    {
      let disposeCount = 0;
      const slowDirector = {
        async load() {
          await new Promise((resolve) => setTimeout(resolve, 20));
        },
        resize() {},
        seek() {},
        render() {},
        setPreferences() {},
        dispose() {
          disposeCount += 1;
        },
      };
      const runtime = createExperienceRuntime({
        createDirector: () => slowDirector,
        mode: "static",
        clock: { subscribe: () => () => undefined },
        registry: createResourceRegistry(),
      });
      const loadPromise = runtime.load();
      runtime.dispose();
      await loadPromise;
      assert.equal(disposeCount, 1);
      assert.equal(runtime.getStatus(), "disposed");
    }

    assert.equal(existsSync(new URL("../docs/design/SALVAGE_MANIFEST.md", import.meta.url)), true);
    assert.equal(
      existsSync(new URL("../.verification/milestone-0/main/baseline/capture-report.json", import.meta.url)),
      true,
    );
    assert.equal(
      existsSync(new URL("../.verification/milestone-0/post-m0/baseline/capture-report.json", import.meta.url)),
      true,
    );
    {
      const mainReport = JSON.parse(readFileSync(
        new URL("../.verification/milestone-0/main/baseline/capture-report.json", import.meta.url),
        "utf8",
      ));
      const postReport = JSON.parse(readFileSync(
        new URL("../.verification/milestone-0/post-m0/baseline/capture-report.json", import.meta.url),
        "utf8",
      ));
      assert.equal(mainReport.commit, "216e38d", "main baseline must be clean main tip");
      assert.equal(mainReport.idle[0].metrics.oceanBridge, false);
      assert.equal(postReport.idle[0].metrics.oceanBridge, true);
      for (const report of [mainReport, postReport]) {
        const m = report.idle[0].metrics;
        assert.ok(m.drawCalls, "drawCalls required");
        assert.ok(m.triangles, "triangles required");
        assert.ok(m.textureMemoryEstimateMb, "RT memory required");
        assert.ok(m.workMsP95, "workMsP95 required");
        assert.ok(m.fps, "fps required");
        assert.ok(Array.isArray(report.frameTraces) && report.frameTraces.length > 0, "frame trace required");
      }

      // Visually-unchanged gate: idle envelopes must stay within tight tolerance.
      const envelopeKeys = ["desktop-1728x1117", "desktop-1440x900", "mobile-390x844"];
      for (const name of envelopeKeys) {
        const mainIdle = mainReport.idle.find((entry) => entry.name === name);
        const postIdle = postReport.idle.find((entry) => entry.name === name);
        assert.ok(mainIdle, `main idle missing ${name}`);
        assert.ok(postIdle, `post-m0 idle missing ${name}`);
        const mainDraw = Number(mainIdle.metrics.drawCalls);
        const postDraw = Number(postIdle.metrics.drawCalls);
        const mainTris = Number(mainIdle.metrics.triangles);
        const postTris = Number(postIdle.metrics.triangles);
        const mainRt = Number(mainIdle.metrics.textureMemoryEstimateMb);
        const postRt = Number(postIdle.metrics.textureMemoryEstimateMb);
        assert.ok(
          Math.abs(postDraw - mainDraw) <= 2,
          `${name} drawCalls drifted beyond ±2 (${mainDraw} → ${postDraw})`,
        );
        assert.ok(
          Math.abs(postTris - mainTris) <= 16,
          `${name} triangles drifted beyond ±16 (${mainTris} → ${postTris})`,
        );
        assert.ok(
          Math.abs(postRt - mainRt) <= 0.5,
          `${name} RT memory drifted beyond ±0.5MB (${mainRt} → ${postRt})`,
        );
      }
    }
    assert.doesNotMatch(
      readFileSync(new URL("../src/features/ocean-experience/index.ts", import.meta.url), "utf8"),
      /cinematic-home|experience-lab|UnderwaterObservatory/,
    );
  }],
  ["Milestone 1: hero glyph authorship, submerged optics, and pressure probe", () => {
    const rawManifest = JSON.parse(readFileSync(
      new URL("../public/assets/hero/ezzy-rappeport-glyphs.json", import.meta.url),
      "utf8",
    ));
    assert.equal(rawManifest.version, 2, "on-disk manifest must be version 2");
    assert.equal(rawManifest.medium?.ior, 1.333);
    assert.ok(rawManifest.glyphs.every((glyph) => glyph.physics && glyph.optics),
      "on-disk glyphs must include physics and optics blocks");

    assert.equal(heroManifest.version, 2);
    assert.equal(heroManifest.glyphs.length, 13);
    const masses = new Set();
    const iors = new Set();
    for (const glyph of heroManifest.glyphs) {
      assert.ok(glyph.physics, `${glyph.object_node_name} missing physics`);
      assert.ok(glyph.optics, `${glyph.object_node_name} missing optics`);
      assert.ok(glyph.physics.mass > 0.5 && glyph.physics.mass < 1.8);
      assert.ok(glyph.physics.drag > 10 && glyph.physics.angular_drag > 8);
      assert.ok(glyph.physics.buoyancy > 0.7 && glyph.physics.buoyancy < 1.15);
      assert.ok(glyph.optics.ior > WATER_IOR);
      assert.ok(glyph.optics.ior < 1.55);
      // Ix∝(h²+d²), Iy∝(w²+d²), Iz∝(w²+h²) — Y/Z must not be swapped.
      const { width, height, depth } = (() => {
        const b = glyph.local_bounding_box;
        const s = glyph.rest_transform.scale;
        return {
          width: (b.max[0] - b.min[0]) * s[0],
          height: (b.max[1] - b.min[1]) * s[1],
          depth: (b.max[2] - b.min[2]) * s[2],
        };
      })();
      const ix = glyph.physics.mass * (height * height + depth * depth) / 12;
      const iy = glyph.physics.mass * (width * width + depth * depth) / 12;
      const iz = glyph.physics.mass * (width * width + height * height) / 12;
      assert.ok(Math.abs(glyph.physics.inertia[0] - ix) / ix < 0.08);
      assert.ok(Math.abs(glyph.physics.inertia[1] - iy) / iy < 0.08);
      assert.ok(Math.abs(glyph.physics.inertia[2] - iz) / iz < 0.08);
      masses.add(glyph.physics.mass);
      iors.add(glyph.optics.ior);
      const authored = resolveGlyphAuthorship({
        glyphIndex: glyph.glyph_index,
        character: glyph.character,
        objectNodeName: glyph.object_node_name,
        localBoundingBox: glyph.local_bounding_box,
        scale: glyph.rest_transform.scale,
      });
      assert.equal(glyph.physics.mass, authored.physics.mass);
      assert.equal(glyph.optics.ior, authored.optics.ior);
    }
    assert.ok(masses.size >= 8, "per-letter masses must vary across the name");
    assert.ok(iors.size >= 8, "per-letter IORs must vary across the name");

    const etaAirStyle = (1.492 - 1) / 1.492;
    const etaWater = relativeRefractionEta(1.492, WATER_IOR);
    assert.ok(etaWater < etaAirStyle * 0.5, "water/glyph bending must be subtler than air/glass");
    assert.ok(schlickF0(1.492, WATER_IOR) < schlickF0(1.492, 1.0));

    const high = opticalTierPolicy("high");
    const balanced = opticalTierPolicy("balanced");
    const low = opticalTierPolicy("low");
    assert.equal(high.refractionTaps, 3);
    assert.equal(balanced.refractionTaps, 2);
    assert.equal(low.refractionTaps, 1);
    assert.equal(high.dispersionStrength, 1);
    assert.ok(balanced.dispersionStrength > 0 && balanced.dispersionStrength < 1);
    assert.equal(low.dispersionStrength, 0);
    assert.match(underwaterShaderSource, /uRefractionTaps <= 2/);
    assert.match(underwaterShaderSource, /uDispersionStrength > 0\.75/);

    assert.match(underwaterShaderSource, /uMediumIor/);
    assert.match(underwaterShaderSource, /uDispersionStrength/);
    assert.match(underwaterShaderSource, /uBubbleSeed/);
    assert.match(underwaterShaderSource, /Beer-Lambert/);
    assert.match(underwaterShaderSource, /safeGlyphIor - uMediumIor/);
    assert.match(underwaterShaderSource, /surfaceCoupling/);
    assert.match(underwaterConfigSource, /mediumIor:\s*1\.333/);
    assert.match(underwaterRendererSource, /opticalTierPolicy/);
    assert.match(underwaterRendererSource, /applyGlyphOptics/);
    assert.match(underwaterRendererSource, /SRGBColorSpace/);
    assert.match(underwaterRendererSource, /pressureProbeApproach/);
    assert.match(underwaterRendererSource, /stormScale/);
    assert.match(underwaterRendererSource, /pressStrength/);
    assert.match(underwaterRendererSource, /tryConsumeGlyphImpulse\(impulseBudget/);
    assert.match(underwaterRendererSource, /holdPressureResponse/);
    assert.match(underwaterRendererSource, /glyphInstanceMaterials/);

    const heroIntroSource = readFileSync(
      new URL("../src/components/portfolio/HeroIntro.tsx", import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(heroIntroSource, /liquid-renderer-ready/);
    assert.doesNotMatch(heroIntroSource, /\binert\b/);
    assert.doesNotMatch(heroIntroSource, /tabIndex=\{revealed/);
    assert.doesNotMatch(heroIntroSource, /aria-hidden=\{revealed/);

    const material = new MeshBasicMaterial();
    const bodies = createGlyphBodies(heroManifest.glyphs.map((manifest) => ({
      manifest,
      object: new Mesh(new BufferGeometry(), material),
    })));
    assert.equal(bodies.length, 13);
    assert.ok(bodies.every((body) => body.drag === body.glyph.manifest.physics.drag));
    const derived = deriveMassAndInertia(bodies[0].glyph, 1);
    assert.equal(derived.mass, heroManifest.glyphs[0].physics.mass);

    const budget = createGlyphImpulseBudget(1, 0.5);
    const first = tryConsumeGlyphImpulse(budget, 1, 0.4);
    tryConsumeGlyphImpulse(budget, 1.05, 0.4);
    tryConsumeGlyphImpulse(budget, 1.1, 0.4);
    const drained = tryConsumeGlyphImpulse(budget, 1.15, 0.4);
    assert.equal(first.allowed, true);
    assert.equal(drained.allowed, true);
    assert.ok(drained.scale < first.scale, "exhausted budget must scale down, not drop");
    assert.ok(drained.scale >= 0.08, "scaled presses remain allowed at floor");
    rechargeGlyphImpulseBudget(budget, 5);
    assert.ok(budget.energy > 0.9);
    assert.ok(holdPressureResponse(0.1) < holdPressureResponse(0.8));
    assert.ok(holdPressureResponse(10) > 0.999);
    assert.ok(pressureProbeApproach(0, 20, 40) === 1);
    assert.ok(pressureProbeApproach(30, 20, 40) > 0);
    assert.equal(pressureProbeApproach(50, 20, 40), 0);

    // Pointer cancel leaves no held glyph.
    let transition = createGlyphInteractionState();
    transition = transitionGlyphInteraction(transition, {
      type: "pointer-down",
      glyphIndex: 3,
      pointerId: 7,
      pressPoint: [10, 10],
      now: 1,
    });
    assert.equal(transition.state.kind, "holding");
    transition = transitionGlyphInteraction(transition, {
      type: "cancel",
      pointerId: 7,
      now: 1.2,
      reason: "pointer-cancel",
    });
    assert.equal(transition.state.kind, "cancelled");
    assert.equal(settleCancelledGlyph(transition, null).state.kind, "idle");

    // Below-fold DOM sections must remain present — M1 is hero-only.
    assert.match(readFileSync(new URL("../src/components/portfolio/ProjectsSection.tsx", import.meta.url), "utf8"), /id=["']projects["']/);
    assert.match(readFileSync(new URL("../src/components/portfolio/AboutSection.tsx", import.meta.url), "utf8"), /id=["']about["']/);
    assert.match(readFileSync(new URL("../src/components/portfolio/ContactSection.tsx", import.meta.url), "utf8"), /id=["']contact["']/);
  }],
  ["Milestone 2: hero release phases, deterministic descent, and reversal", async () => {
    const {
      HERO_PHASE_ARRIVAL_END,
      HERO_PHASE_LIVING_END,
      HERO_PHASE_RELEASE_END,
      heroJourneyEndForLayout,
      heroProgressForJourney,
      heroPhaseState,
      staggeredGlyphRelease,
      glyphFadeForRelease,
    } = await import("../src/features/ocean-experience/scroll/hero-journey.ts");

    // Hero journey spans surface + descent chapters exactly.
    assert.equal(heroJourneyEndForLayout("desktop"), 0.22);
    assert.equal(heroJourneyEndForLayout("mobile"), 0.24);
    assert.equal(heroProgressForJourney(0, "desktop"), 0);
    assert.equal(heroProgressForJourney(0.11, "desktop"), 0.5);
    assert.equal(heroProgressForJourney(0.22, "desktop"), 1);
    assert.equal(heroProgressForJourney(0.57, "desktop"), 1, "clamps past descent");
    assert.equal(heroProgressForJourney(-0.4, "desktop"), 0);

    // Phase edges match the approved §8.7 contract.
    assert.equal(HERO_PHASE_ARRIVAL_END, 0.18);
    assert.equal(HERO_PHASE_LIVING_END, 0.52);
    assert.equal(HERO_PHASE_RELEASE_END, 0.82);
    assert.equal(heroPhaseState(0).phase, "arrival");
    assert.equal(heroPhaseState(0.3).phase, "living");
    assert.equal(heroPhaseState(0.6).phase, "release");
    assert.equal(heroPhaseState(0.9).phase, "pass-under");
    assert.equal(heroPhaseState(1).phase, "pass-under");

    // Living phase adds tension without departure; release commits it away.
    assert.equal(heroPhaseState(0).tension, 0);
    assert.ok(heroPhaseState(0.4).tension > 0.5, "living tension builds");
    assert.equal(heroPhaseState(1).tension, 0, "tension resolves after release");
    assert.equal(heroPhaseState(0.4).release, 0, "no departure during living");
    assert.equal(heroPhaseState(0.4).gone, 0);

    // Masters are monotonic and exact at both ends (reversible contract).
    let previousGone = -1;
    for (let step = 0; step <= 100; step += 1) {
      const state = heroPhaseState(step / 100);
      assert.ok(state.gone >= previousGone, "gone must be monotonic");
      previousGone = state.gone;
      assert.ok(state.release >= 0 && state.release <= 1);
      assert.ok(state.passUnder >= 0 && state.passUnder <= 1);
    }
    assert.equal(heroPhaseState(HERO_PHASE_LIVING_END).release, 0);
    assert.equal(heroPhaseState(HERO_PHASE_RELEASE_END).release, 1);
    assert.equal(heroPhaseState(1).passUnder, 1);
    assert.equal(heroPhaseState(1).gone, 1);
    assert.equal(heroPhaseState(0.52).gone, 0);
    // Pass-under never leads the release.
    assert.ok(heroPhaseState(0.7).passUnder === 0);
    assert.ok(heroPhaseState(0.9).passUnder > 0);
    // Descent beam only turns on near the pass-under handoff.
    assert.equal(heroPhaseState(0.5).descentBeam, 0);
    assert.ok(heroPhaseState(0.95).descentBeam > 0.9);

    // Pure mapping: identical progress yields identical state (reversal).
    assert.deepEqual(heroPhaseState(0.68), heroPhaseState(0.68));

    // Per-glyph stagger: later indices trail, all complete exactly at 1.
    assert.ok(staggeredGlyphRelease(0.5, 0) > staggeredGlyphRelease(0.5, 12));
    for (let index = 0; index < 13; index += 1) {
      assert.equal(staggeredGlyphRelease(1, index), 1);
      assert.equal(staggeredGlyphRelease(0, index), 0);
    }
    // Dissolve trails the rise so letters keep refracting in the pass-under.
    assert.equal(glyphFadeForRelease(0), 0);
    assert.ok(glyphFadeForRelease(0.5) < 0.65, "dissolve must lag the rise");
    assert.equal(glyphFadeForRelease(1), 1);

    // Renderer wiring: journey-driven release, camera inputs, beam, snap.
    assert.match(underwaterRendererSource, /getExperienceSnapshot\(\)/);
    assert.match(underwaterRendererSource, /heroProgressForJourney\(experience\.progress, experience\.layout, experience\.ranges\)/);
    assert.match(underwaterRendererSource, /heroRelease: heroState\.release/);
    assert.match(underwaterRendererSource, /heroPassUnder: heroState\.passUnder/);
    assert.match(underwaterRendererSource, /uDescentBeam/);
    assert.match(underwaterRendererSource, /heroSnap/);
    assert.match(underwaterRendererSource, /dataset\.heroPhase/);
    assert.match(underwaterRendererSource, /releaseLift/);
    assert.match(underwaterRendererSource, /releaseTorque/);
    assert.match(underwaterRendererSource, /glyphFadeForRelease/);
    assert.doesNotMatch(underwaterRendererSource, /staggeredGlyphExit/);

    // Camera rig owns the authored descent path parameters.
    const cameraRigSource = readFileSync(
      new URL("../src/features/kinetic-canvas/renderer/underwater/cameraRig.ts", import.meta.url),
      "utf8",
    );
    assert.match(cameraRigSource, /heroReleaseDropZ/);
    assert.match(cameraRigSource, /heroPassDropZ/);
    assert.match(cameraRigSource, /heroPassPitch/);
    assert.match(cameraRigSource, /heroPassFovTighten/);
    assert.doesNotMatch(cameraRigSource, /staggeredGlyphExit/);

    // Physics exposes the bounded scroll-current release response.
    const glyphPhysicsSource = readFileSync(
      new URL("../src/features/kinetic-canvas/physics/glyphRigidBodies.ts", import.meta.url),
      "utf8",
    );
    assert.match(glyphPhysicsSource, /releaseLift: number/);
    assert.match(glyphPhysicsSource, /releaseTorque: number/);

    // Shader owns the descent beam light path.
    assert.match(underwaterShaderSource, /uniform float uDescentBeam/);
    assert.match(underwaterShaderSource, /beamZone/);
  }],
  ["Milestone 3: MonkeyClaw encounter contract, lifecycle, and DOM surface", async () => {
    const {
      ENCOUNTER_CHAPTERS,
      encounterWindowFor,
      encounterWindowsForLayout,
      visibilityForWindow,
      visibilityTable,
    } = await import("../src/features/ocean-experience/render/encounter-visibility.ts");
    const {
      DESKTOP_CHAPTER_RANGES,
    } = await import("../src/features/ocean-experience/contracts/chapter.ts");
    const {
      MONKEYCLAW_COUNTS,
      MONKEYCLAW_LOOP,
      findingRankForVector,
      vectorBecomesFinding,
      vectorSpawnDirection,
      vectorTiming,
    } = await import("../src/features/ocean-experience/render/projects/monkeyclaw/monkeyclawConfig.ts");

    // Encounter chapters match the approved anchor set.
    assert.deepEqual(ENCOUNTER_CHAPTERS, ["monkeyclaw", "etch", "flowe", "argyph"]);

    // Window geometry: fade wraps the chapter, preload leads, eviction trails.
    const window = encounterWindowFor("monkeyclaw", DESKTOP_CHAPTER_RANGES);
    assert.equal(window.rangeStart, 0.22);
    assert.equal(window.rangeEnd, 0.39);
    assert.ok(window.fadeInStart < window.rangeStart);
    assert.ok(window.fadeInEnd > window.rangeStart);
    assert.ok(window.fadeOutEnd > window.rangeEnd);
    assert.ok(window.preloadStart < window.fadeInStart);
    assert.ok(window.evictAfter >= 0.56, "evicts after two chapter boundaries");

    // Swept visibility is exact at every sample and reversible.
    assert.equal(visibilityForWindow(window, 0).fade, 0);
    assert.equal(visibilityForWindow(window, 0.3).fade, 1);
    assert.equal(visibilityForWindow(window, 0.3).chapterProgress,
      Math.abs((0.3 - 0.22) / 0.17 - (0.3 - 0.22) / 0.17) < 1e-9 ? (0.3 - 0.22) / 0.17 : 0);
    assert.ok(visibilityForWindow(window, 0.21).fade > 0, "fades in during descent");
    assert.ok(visibilityForWindow(window, 0.41).fade < 1, "fades out toward etch");
    assert.equal(visibilityForWindow(window, 0.6).fade, 0);
    assert.equal(visibilityForWindow(window, 0.6).shouldEvict, false,
      "still resident one chapter behind");
    assert.equal(visibilityForWindow(window, 0.75).shouldEvict, true,
      "evicts two chapters behind");
    assert.equal(visibilityForWindow(window, 0.1).shouldEvict, true);
    assert.equal(visibilityForWindow(window, 0.3).shouldPreload, true);
    // chapterProgress sweeps the full range monotonically.
    let lastCp = -1;
    for (let step = 0; step <= 50; step += 1) {
      const cp = visibilityForWindow(window, 0.22 + (step / 50) * 0.17).chapterProgress;
      assert.ok(cp >= lastCp && cp >= 0 && cp <= 1);
      lastCp = cp;
    }
    // Table reuse is allocation-free and complete for both layouts.
    const desktopTable = visibilityTable(encounterWindowsForLayout("desktop"), 0.3);
    const mobileTable = visibilityTable(encounterWindowsForLayout("mobile"), 0.3);
    assert.equal(desktopTable.length, 4);
    assert.equal(mobileTable.length, 4);
    const reused = [];
    visibilityTable(encounterWindowsForLayout("desktop"), 0.31, reused);
    assert.equal(reused.length, 4);

    // Facts from content.ts are structurally encoded in the scene.
    assert.equal(MONKEYCLAW_COUNTS.vectors, 18);
    assert.equal(MONKEYCLAW_COUNTS.confirmedFindings, 3);
    assert.equal(MONKEYCLAW_COUNTS.verifierGates, 8);
    let findingCount = 0;
    for (let index = 0; index < 18; index += 1) {
      if (vectorBecomesFinding(index)) findingCount += 1;
    }
    assert.equal(findingCount, 3);
    for (let index = 0; index < 18; index += 1) {
      const rank = findingRankForVector(index);
      if (index < 15) assert.equal(rank, -1);
      else assert.equal(rank, index - 15);
    }
    // Deterministic spawn paths and monotonic per-vector timing.
    const first = [0, 0, 0];
    const second = [0, 0, 0];
    vectorSpawnDirection(3, first);
    vectorSpawnDirection(3, second);
    assert.deepEqual(first, second);
    for (let index = 0; index < 18; index += 1) {
      const timing = vectorTiming(index);
      assert.ok(timing.startT < timing.arriveT);
      assert.ok(timing.startT >= MONKEYCLAW_LOOP.redStart - 1e-9);
      if (vectorBecomesFinding(index)) assert.ok(timing.judgeT > timing.arriveT);
    }

    // Renderer integration: one host, encounter layer pass, probe, disposal.
    assert.match(underwaterRendererSource, /EncounterHost/);
    assert.match(underwaterRendererSource, /ENCOUNTER_LAYER/);
    assert.match(underwaterRendererSource, /encounterHost\.frame\(experience, deltaSeconds, time/);
    assert.match(underwaterRendererSource, /encounterHost\.probeFromViewport/);
    assert.match(underwaterRendererSource, /encounterHost\.dispose\(\)/);
    assert.match(underwaterRendererSource, /dataset\.encounterScene/);

    const hostSource = readFileSync(
      new URL("../src/features/ocean-experience/render/EncounterHost.ts", import.meta.url),
      "utf8",
    );
    assert.match(hostSource, /AbortController/);
    assert.match(hostSource, /shouldPreload/);
    assert.match(hostSource, /shouldEvict/);
    assert.match(hostSource, /visibilityTable/);
    assert.match(hostSource, /state\.stage\.clear\(\)/);
    assert.match(hostSource, /getObjectByName\(stage\.name\)/);
    // No competing scroll owner: the host only reads the director snapshot.
    assert.doesNotMatch(hostSource, /addEventListener\("scroll"/);

    const sceneSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/monkeyclaw/MonkeyClawScene.ts", import.meta.url),
      "utf8",
    );
    assert.match(sceneSource, /chapterProgress/);
    assert.match(sceneSource, /dispose\(\)/);
    assert.match(sceneSource, /probe/);
    assert.match(sceneSource, /monkeyclaw-red-judge-repro-blue-purple/);
    assert.match(sceneSource, /monkeyclaw-brand-decal/);
    assert.match(sceneSource, /perimeter/);
    assert.match(sceneSource, /monkeyclaw-containment-shield/);
    assert.match(sceneSource, /monkeyclaw-defense-patch-lattice/);
    assert.doesNotMatch(sceneSource, /addEventListener/);
    assert.doesNotMatch(sceneSource, /Math\.random\(/);

    // DOM surface: semantic encounter wired into the projects list.
    const projectsSectionSource = readFileSync(
      new URL("../src/components/portfolio/ProjectsSection.tsx", import.meta.url),
      "utf8",
    );
    assert.match(projectsSectionSource, /ProjectEncounter/);
    const encounterSource = readFileSync(
      new URL("../src/components/portfolio/ProjectEncounter.tsx", import.meta.url),
      "utf8",
    );
    assert.match(encounterSource, /data-encounter=\{project\.slug\}/);
    assert.match(encounterSource, /project\.proof/);
    assert.match(encounterSource, /<dl className=\{styles\.facts\}>/);
    assert.match(encounterSource, /ProjectTransitionLink/);
    assert.match(encounterSource, /ENCOUNTER_BEATS/);
    assert.match(encounterSource, /Live system model/);
    assert.match(encounterSource, /Scroll-linked \/ \{String\(beats\.length\)/);
    assert.match(encounterSource, /6 checks \+ ensemble/);
    assert.match(encounterSource, /blocked \+ observed/);
    assert.match(encounterSource, /patch · 8 gates/);
    assert.doesNotMatch(encounterSource, /IntersectionObserver/);

    // Sticky staging depends on the global overflow-x: clip (not hidden).
    assert.match(globalsCssSource, /overflow-x: clip;/);
    assert.doesNotMatch(globalsCssSource, /overflow-x: hidden;/);
  }],
  ["Milestone 4: Etch + FlowE encounters and measured chapter knots", async () => {
    const {
      ETCH_COUNTS,
      ETCH_CANDIDATES,
      ETCH_GATES,
      ETCH_LOOP,
      candidateClearance,
      gateStationX,
    } = await import("../src/features/ocean-experience/render/projects/etch/etchConfig.ts");
    const {
      FLOWE_COUNTS,
      FLOWE_LOOP,
      clusterForFragment,
      fragmentDriftAnchor,
      moteSeed,
    } = await import("../src/features/ocean-experience/render/projects/flowe/floweConfig.ts");
    const {
      chapterRangesFromKnots,
    } = await import("../src/features/ocean-experience/scroll/scroll-mapping.ts");
    const {
      CHAPTER_ANCHOR_SELECTORS,
    } = await import("../src/features/ocean-experience/scroll/ScrollDirector.ts");
    const {
      CHAPTER_ORDER,
      DESKTOP_CHAPTER_RANGES,
    } = await import("../src/features/ocean-experience/contracts/chapter.ts");
    const {
      getExperienceSnapshot,
      resetExperienceStore,
      setExperienceRanges,
      subscribeExperience,
    } = await import("../src/features/ocean-experience/state/experience-store.ts");

    // Etch: exact saved-run evidence, including falsification and honest gaps.
    assert.equal(ETCH_COUNTS.gates, 4);
    assert.equal(ETCH_GATES.length, 4);
    assert.equal(ETCH_GATES[0].label, "50-cycle oracle");
    assert.equal(ETCH_GATES[1].label, "BMC depth 32");
    assert.equal(ETCH_GATES[2].label, "Yosys 0.66");
    assert.equal(ETCH_GATES[3].id, "physical");
    assert.equal(ETCH_GATES[3].passed, false, "no false completion");
    assert.ok(ETCH_GATES.slice(0, 3).every((gate) => gate.passed));
    assert.equal(ETCH_CANDIDATES[0].verdict, "PROVEN");
    assert.match(ETCH_CANDIDATES[0].metric, /5485\.2608/);
    assert.equal(ETCH_CANDIDATES[1].verdict, "FALSIFIED");
    assert.match(ETCH_CANDIDATES[1].metric, /cycle 1/);
    assert.equal(ETCH_CANDIDATES[2].verdict, "PROVEN");
    assert.equal(candidateClearance(0), 3);
    assert.equal(candidateClearance(1), 3);
    assert.equal(candidateClearance(2), 3);
    assert.ok(gateStationX(1, -1.75, 0.46) > gateStationX(0, -1.75, 0.46));
    assert.ok(ETCH_LOOP.gatesStart < ETCH_LOOP.gatesFull);
    assert.ok(ETCH_LOOP.relaxStart >= ETCH_LOOP.gatesStart);

    // FlowE: stable plan structure and deterministic anchors.
    assert.equal(FLOWE_COUNTS.fragments, 26);
    assert.equal(FLOWE_COUNTS.clusters, 4);
    const anchorA = [0, 0, 0];
    const anchorB = [0, 0, 0];
    fragmentDriftAnchor(7, anchorA);
    fragmentDriftAnchor(7, anchorB);
    assert.deepEqual(anchorA, anchorB);
    moteSeed(4, anchorA);
    moteSeed(4, anchorB);
    const fragmentClusters = new Set();
    for (let index = 0; index < FLOWE_COUNTS.fragments; index += 1) {
      fragmentClusters.add(clusterForFragment(index));
    }
    assert.equal(fragmentClusters.size, FLOWE_COUNTS.clusters);
    assert.ok(FLOWE_LOOP.groupStart < FLOWE_LOOP.focusStart);
    assert.ok(FLOWE_LOOP.contractStart >= FLOWE_LOOP.focusStart);

    // Measured knots: valid physical ranges accepted, broken ones rejected.
    const hashes = DESKTOP_CHAPTER_RANGES.map((range) => range.hash);
    const good = chapterRangesFromKnots(
      [0, 0.08, 0.14, 0.3, 0.46, 0.62, 0.7, 0.78, 0.9, 1],
      hashes,
    );
    assert.ok(good !== null);
    assert.equal(good[0].id, "surface");
    assert.equal(good[2].id, "monkeyclaw");
    assert.equal(good[8].end, 1);
    assert.equal(chapterRangesFromKnots([0, 0.3, 0.2, 0.4, 0.46, 0.62, 0.7, 0.78, 0.9, 1], hashes), null,
      "non-monotonic knots rejected");
    assert.equal(chapterRangesFromKnots([0, 0.08, 0.14, 0.3, 0.46, 0.62, 0.7, 0.78, 0.9, 0.9], hashes), null,
      "terminal coverage enforced");
    assert.equal(chapterRangesFromKnots([0, 0.08], hashes), null);
    // Every chapter has a DOM anchor and offsets keep the table complete.
    for (const id of CHAPTER_ORDER) {
      assert.ok(CHAPTER_ANCHOR_SELECTORS[id], `anchor for ${id}`);
    }

    // Experience store publishes ranges discretely (identity-compared).
    resetExperienceStore();
    let rangeNotifications = 0;
    const unsubscribeRanges = subscribeExperience(() => {
      rangeNotifications += 1;
    });
    setExperienceRanges(DESKTOP_CHAPTER_RANGES);
    assert.equal(rangeNotifications, 1);
    setExperienceRanges(DESKTOP_CHAPTER_RANGES);
    assert.equal(rangeNotifications, 1, "same identity does not re-notify");
    assert.equal(getExperienceSnapshot().ranges, DESKTOP_CHAPTER_RANGES);
    unsubscribeRanges();
    resetExperienceStore();

    // Renderer registers all anchor factories.
    assert.match(underwaterRendererSource, /monkeyclaw: \(\) => import/);
    assert.match(underwaterRendererSource, /etch: \(\) => import/);
    assert.match(underwaterRendererSource, /flowe: \(\) => import/);

    // ScrollDirector owns measured knots with authored fallback.
    const directorSource = readFileSync(
      new URL("../src/features/ocean-experience/scroll/ScrollDirector.ts", import.meta.url),
      "utf8",
    );
    assert.match(directorSource, /CHAPTER_ANCHOR_SELECTORS/);
    assert.match(directorSource, /chapterRangesFromKnots/);
    assert.match(directorSource, /measureChapterKnots/);
    assert.match(directorSource, /setExperienceRanges/);

    // Scenes stay pure-mapping owners: no listeners, no randomness.
    for (const scenePath of [
      "../src/features/ocean-experience/render/projects/etch/EtchScene.ts",
      "../src/features/ocean-experience/render/projects/flowe/FloweScene.ts",
    ]) {
      const sceneSource = readFileSync(new URL(scenePath, import.meta.url), "utf8");
      assert.doesNotMatch(sceneSource, /addEventListener/);
      assert.doesNotMatch(sceneSource, /Math\.random\(/);
      assert.match(sceneSource, /chapterProgress/);
      assert.match(sceneSource, /dispose\(\)/);
    }
    const etchSceneSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/etch/EtchScene.ts", import.meta.url),
      "utf8",
    );
    const floweSceneSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/flowe/FloweScene.ts", import.meta.url),
      "utf8",
    );
    const argyphSceneSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/argyph/ArgyphScene.ts", import.meta.url),
      "utf8",
    );
    const monkeyclawSceneSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/monkeyclaw/MonkeyClawScene.ts", import.meta.url),
      "utf8",
    );
    const productGeometrySource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/shared/productGeometry.ts", import.meta.url),
      "utf8",
    );
    const instrumentLabelSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/shared/instrumentLabel.ts", import.meta.url),
      "utf8",
    );
    assert.match(etchSceneSource, /etch-verified-fifo-die/);
    assert.match(etchSceneSource, /dieDetails/);
    assert.match(etchSceneSource, /diePins/);
    assert.doesNotMatch(etchSceneSource, /resultBezel/);
    assert.match(etchSceneSource, /dieScrews/);
    assert.match(etchSceneSource, /etch-nib-surface-engraving/);
    assert.match(etchSceneSource, /projects\/etch\/logo\.svg/);
    assert.match(etchSceneSource, /etch-gate-/);
    assert.match(etchSceneSource, /physical-signoff/);
    assert.match(etchSceneSource, /const dossierScene = scenePresence\(t, 0\.88, 1, stateFeather\)/);
    assert.match(etchSceneSource, /dossierAssembly\.visible = dossierScene > 0\.001/);
    assert.match(etchSceneSource, /MeshPhysicalMaterial/);
    assert.doesNotMatch(floweSceneSource, /plannerBody/);
    assert.match(floweSceneSource, /TubeGeometry/);
    assert.match(floweSceneSource, /CatmullRomCurve3/);
    assert.match(floweSceneSource, /flowe-logo-draw-system/);
    assert.match(floweSceneSource, /geometry\.setDrawRange/);
    assert.match(floweSceneSource, /BRAIN DUMP/);
    assert.match(floweSceneSource, /OFFLINE QUEUE/);
    assert.match(floweSceneSource, /MORNING BRIEF/);
    assert.match(floweSceneSource, /flowe-brand-mark-plane/);
    assert.match(floweSceneSource, /projects\/flowe\/app-icon\.webp/);
    assert.match(floweSceneSource, /uniform sampler2D uIdentity/);
    assert.match(floweSceneSource, /uReveal/);
    assert.match(floweSceneSource, /Focus block/);
    assert.match(floweSceneSource, /flowe-task-/);
    assert.doesNotMatch(floweSceneSource, /plannerInset/);
    assert.match(floweSceneSource, /const primaryTask = index < 9/);
    assert.match(argyphSceneSource, /argyph-local-index-stack/);
    assert.match(argyphSceneSource, /argyph-angular-mark/);
    assert.match(argyphSceneSource, /projects\/argyph\/argyph-identity\.webp/);
    assert.match(argyphSceneSource, /argyph-flat-identity-mark/);
    assert.doesNotMatch(argyphSceneSource, /objects = \[lightingRig, indexStack/);
    assert.doesNotMatch(argyphSceneSource, /stackSlabs/);
    assert.match(argyphSceneSource, /uniform sampler2D uIdentity/);
    assert.match(argyphSceneSource, /argyph-tier-/);
    assert.match(argyphSceneSource, /definitions \+ refs/);
    assert.match(monkeyclawSceneSource, /monkeyclaw-brand-decal/);
    assert.match(monkeyclawSceneSource, /projects\/monkeyclaw\/logo\.webp/);
    assert.match(monkeyclawSceneSource, /monkeyclaw-red-judge-repro-blue-purple/);
    assert.doesNotMatch(monkeyclawSceneSource, /sandboxBody/);
    assert.match(monkeyclawSceneSource, /const productLoopRadius = 0\.48/);
    assert.match(monkeyclawSceneSource, /monkeyclaw-stage-/);
    assert.match(monkeyclawSceneSource, /tiered analysis/);
    assert.match(monkeyclawSceneSource, /monkeyclaw-replay-minimize-cold-verify/);
    assert.match(monkeyclawSceneSource, /monkeyclaw-detection-as-pass/);
    assert.match(monkeyclawSceneSource, /six deterministic programmatic checks/);
    assert.match(monkeyclawSceneSource, /Blue's eight verifier gates/);
    assert.match(productGeometrySource, /createRoundedPanelGeometry/);
    assert.match(productGeometrySource, /bevelEnabled: bevelSize > 0/);
    assert.match(instrumentLabelSource, /CanvasTexture/);
    assert.match(instrumentLabelSource, /context\.roundRect/);
    // No per-frame allocation regressions in configs.
    const etchConfigSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/etch/etchConfig.ts", import.meta.url),
      "utf8",
    );
    assert.match(etchConfigSource, /CANDIDATE_CLEARANCE: readonly number\[\]/);
    const monkeyclawConfigSource = readFileSync(
      new URL("../src/features/ocean-experience/render/projects/monkeyclaw/monkeyclawConfig.ts", import.meta.url),
      "utf8",
    );
    assert.match(monkeyclawConfigSource, /VECTOR_TIMINGS/);
    assert.match(monkeyclawConfigSource, /targetStart: 0/);
    assert.match(monkeyclawConfigSource, /reproStart: 0\.41/);

    // Homepage order: anchors as encounters, then the Charted Work catalog.
    const projectsSectionSource = readFileSync(
      new URL("../src/components/portfolio/ProjectsSection.tsx", import.meta.url),
      "utf8",
    );
    assert.match(projectsSectionSource, /HOMEPAGE_ROW_ORDER = \["monkeyclaw", "etch", "flowe", "argyph"\]/);
    assert.match(projectsSectionSource, /ChartedWork/);
  }],
];

for (const [name, run] of tests) {
  await run();
  console.log(`PASS ${name}`);
}

console.log(`${tests.length} portfolio regression tests passed`);
