"use client";

import { subscribeFrameClock, unsubscribeFrameClock } from "./frame-clock.ts";
import { resolveMovementSplat } from "./interaction-policy.ts";
import { setAmbientDepth } from "./sound.ts";
import {
  computeWorldState,
  invalidateWorldMeasurement,
  stillWorld,
  type WorldState,
} from "./world-state.ts";

export type LiquidPointerState = {
  x: number;
  y: number;
  present: boolean;
  active: boolean;
  pointerType: "mouse" | "pen" | "touch" | "unknown";
  speed: number;
  /** Velocity in pixels per second. */
  vx: number;
  vy: number;
  /** 0..1+ energy carried by the pointer. */
  energy: number;
  time: number;
};

export type LiquidRippleState = {
  x: number;
  y: number;
  intensity: number;
  time: number;
  /** Age in seconds, computed on demand. */
  age: number;
};

export type LiquidScrollState = {
  progress: number;
  velocity: number;
  direction: -1 | 0 | 1;
  depth: number;
  section: number;
  time: number;
};

export type LiquidPhysics = {
  pointer: LiquidPointerState;
  ripples: LiquidRippleState[];
  interactions: LiquidInteractionEvent[];
  scroll: LiquidScrollState;
  /** Continuous underwater world: depth, light, calm. One curve for the
      renderer, the DOM, and the navigation. */
  world: WorldState;
  time: number;
};

export type LiquidInteractionEvent = {
  id: number;
  kind: "wake" | "press" | "shockwave" | "suction" | "release-wave";
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  vx: number;
  vy: number;
  strength: number;
  radius: number;
  time: number;
  pointerType: string;
};

export type LiquidFieldSample = {
  x: number;
  y: number;
  intensity: number;
  pointerForce: number;
};

export function decayScrollVelocity(velocity: number, deltaSeconds: number) {
  return velocity * Math.exp(-7.5 * Math.max(0, deltaSeconds));
}

export function scrollWakeStrength(velocity: number) {
  const normalized = Math.max(0, Math.min(1, (Math.abs(velocity) - 0.12) / 0.7));
  return normalized * normalized * (3 - normalized * 2);
}

export function liquidEmissionAllowed({
  visible,
  pageVisible,
  reducedMotion,
  rendererReady,
}: Readonly<{
  visible: boolean;
  pageVisible: boolean;
  reducedMotion: boolean;
  rendererReady: boolean;
}>) {
  return visible && pageVisible && !reducedMotion && rendererReady;
}

type PointerSubscriber = (state: LiquidPointerState) => void;
type RippleSubscriber = (state: LiquidRippleState) => void;
type PhysicsSubscriber = (state: LiquidPhysics) => void;

const RIPPLE_LIFETIME = 3.2;
const MAX_RIPPLES = 16;
const MAX_INTERACTIONS = 48;
const POINTER_WAKE_RADIUS = 260;
const RIPPLE_SPEED = 155;
/** Pointer energy charges with travel and decays with ~0.5s time constant. */
const POINTER_ENERGY_TAU_CHARGE = 0.22;
const POINTER_ENERGY_TAU_DECAY = 0.45;
const SHOCKWAVE_DEFAULT_STRENGTH = 1;
const SHOCKWAVE_RELEASE_STRENGTH = 0.28;
/** Clearer tap plunk on finger — still capped in emitLiquidShockwave. */
const SHOCKWAVE_TOUCH_STRENGTH = 1.18;
/** Finger press footprint — larger than mouse so a tap reads on low-tier water. */
const TOUCH_PRESS_RADIUS = 118;
const MOUSE_PRESS_RADIUS = 88;
/** Broad soft wakes — water displacement, not plastic creases. */
const TOUCH_WAKE_RADIUS_MAX = 148;
const MOUSE_WAKE_RADIUS_MAX = 124;

const defaultX = typeof window !== "undefined" ? window.innerWidth * 0.62 : 0;
const defaultY = typeof window !== "undefined" ? window.innerHeight * 0.54 : 0;

const state: LiquidPhysics = {
  pointer: {
    x: defaultX,
    y: defaultY,
    present: false,
    active: false,
    pointerType: "unknown",
    speed: 0,
    vx: 0,
    vy: 0,
    energy: 0,
    time: 0,
  },
  ripples: [],
  interactions: [],
  scroll: {
    progress: 0,
    velocity: 0,
    direction: 0,
    depth: 0,
    section: 0,
    time: 0,
  },
  world: stillWorld(),
  time: 0,
};

const pointerSubscribers = new Set<PointerSubscriber>();
const rippleSubscribers = new Set<RippleSubscriber>();
const physicsSubscribers = new Set<PhysicsSubscriber>();

let started = false;
const LIQUID_CLOCK_ID = "liquid-interaction";
let nextIdleRipple = 8;
let lastInputTime = 0;
let lastTickAt = 0;
let lastMovementSplatAt = 0;
let rootVarsKey = "";
let pendingPointer: {
  x: number;
  y: number;
  time: number;
  pointerType: string;
} | null = null;
let pendingPointerSamples: Array<{ x: number; y: number; time: number; pointerType: string }> = [];
let interactionId = 0;
/** Seconds since the current press began; 0 when the pointer is up. */
let pressHoldStartedAt = 0;
let lastSuctionEmitAt = 0;
let reducedMotionCached: boolean | null = null;
let coarsePointerCached: boolean | null = null;

const PHYSICS_INTERVAL_MS = 1000 / 30;

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  if (reducedMotionCached === null) {
    reducedMotionCached = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return reducedMotionCached;
}

function isCoarsePointerMedia() {
  if (typeof window === "undefined") return false;
  if (coarsePointerCached === null) {
    coarsePointerCached = window.matchMedia("(pointer: coarse)").matches;
  }
  return coarsePointerCached;
}

/** Touch events or a coarse primary pointer — finger-tuned splat radii. */
function isTouchLikePointer(pointerType: string) {
  return pointerType === "touch" || isCoarsePointerMedia();
}

function setRootVars() {
  if (typeof document === "undefined") return;
  const nextKey = [
    Math.round(state.pointer.x),
    Math.round(state.pointer.y),
    state.pointer.speed.toFixed(2),
    state.pointer.energy.toFixed(2),
    state.pointer.active ? 1 : 0,
    state.scroll.progress.toFixed(3),
    state.scroll.velocity.toFixed(2),
    state.scroll.depth.toFixed(2),
    state.world.depth.toFixed(3),
    state.world.light.toFixed(3),
    state.world.calm.toFixed(3),
    state.world.section,
    state.world.moored ? 1 : 0,
  ].join("|");
  if (nextKey === rootVarsKey) return;
  rootVarsKey = nextKey;
  const root = document.documentElement;
  root.style.setProperty("--liquid-x", `${state.pointer.x}px`);
  root.style.setProperty("--liquid-y", `${state.pointer.y}px`);
  root.style.setProperty("--liquid-speed", state.pointer.speed.toFixed(3));
  root.style.setProperty("--liquid-energy", state.pointer.energy.toFixed(3));
  root.style.setProperty("--liquid-active", state.pointer.active ? "1" : "0");
  root.style.setProperty("--liquid-present", state.pointer.present ? "1" : "0");
  root.style.setProperty("--liquid-scroll", state.scroll.progress.toFixed(4));
  root.style.setProperty("--liquid-scroll-velocity", state.scroll.velocity.toFixed(3));
  root.style.setProperty("--liquid-depth", state.scroll.depth.toFixed(3));
  // The shared world curve. Every layer -  renderer, sections, navigation -
  // reads the same depth so the descent stays physically coherent.
  root.style.setProperty("--world-depth", state.world.depth.toFixed(4));
  root.style.setProperty("--world-light", state.world.light.toFixed(4));
  root.style.setProperty("--world-calm", state.world.calm.toFixed(4));
  // Navigation foreground: stay ink-dark through the bright shallows / mid
  // caustics, then lift toward pearl only as the basin really darkens.
  // Previous linear mix hit ~0.5 lightness by mid-projects and washed out.
  const navLightness = (
    0.2
    + state.world.light * 0.04
    + Math.pow(1 - state.world.light, 1.55) * 0.74
  ).toFixed(3);
  root.style.setProperty("--nav-l", navLightness);
  root.dataset.navTheme = state.world.depth >= 0.62 ? "white-on-deep" : "ink-on-light";
  // One owner for active section: world geometry (with contact anticipation).
  root.dataset.waterSection = state.world.moored ? "case" : state.world.section;
  // Depth-band ambient bed (no-op when sound is off / unavailable).
  setAmbientDepth(state.world.depth);
}

function emitPointer() {
  setRootVars();
  pointerSubscribers.forEach((subscriber) => subscriber(state.pointer));
}

function emitRipple(ripple: LiquidRippleState) {
  rippleSubscribers.forEach((subscriber) => subscriber(ripple));
}

function emitPhysics() {
  physicsSubscribers.forEach((subscriber) => subscriber(state));
}

function pushRipple(x: number, y: number, intensity: number, now: number) {
  const ripple: LiquidRippleState = { x, y, intensity, time: now, age: 0 };
  state.ripples.push(ripple);
  if (state.ripples.length > MAX_RIPPLES) state.ripples.shift();
  emitRipple(ripple);
  emitPhysics();
}

function pushInteraction(event: Omit<LiquidInteractionEvent, "id">) {
  state.interactions.push({ ...event, id: ++interactionId });
  if (state.interactions.length > MAX_INTERACTIONS) state.interactions.shift();
}

function onPointerMove(e: PointerEvent) {
  const now = performance.now();
  lastInputTime = now;
  const samples = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
  pendingPointerSamples.push(...samples.map((sample) => ({
    x: sample.clientX,
    y: sample.clientY,
    time: sample.timeStamp || now,
    pointerType: sample.pointerType || e.pointerType || "mouse",
  })));
  if (pendingPointerSamples.length > 24) {
    pendingPointerSamples.splice(0, pendingPointerSamples.length - 24);
  }
  const latest = pendingPointerSamples[pendingPointerSamples.length - 1];
  pendingPointer = latest
    ? { x: latest.x, y: latest.y, time: now, pointerType: latest.pointerType }
    : null;
}

function applyPendingPointer() {
  if (!pendingPointer) return;
  const samples = pendingPointerSamples.length > 0
    ? pendingPointerSamples
    : [pendingPointer];
  pendingPointerSamples = [];
  const { x, y, time: now } = pendingPointer;
  pendingPointer = null;
  const hadPointerSample = state.pointer.time > 0;
  const initialSample = samples[0] ?? { x, y, time: now, pointerType: "mouse" };
  const prevTime = state.pointer.time || now;
  const dt = Math.max((now - prevTime) / 1000, 0.001);
  const dx = hadPointerSample ? x - state.pointer.x : 0;
  const dy = hadPointerSample ? y - state.pointer.y : 0;
  const speed = Math.hypot(dx, dy) / Math.max(window.innerWidth, window.innerHeight) / dt;

  state.pointer.x = x;
  state.pointer.y = y;
  state.pointer.present = true;
  state.pointer.pointerType = initialSample.pointerType === "touch"
    ? "touch"
    : initialSample.pointerType === "pen"
      ? "pen"
      : "mouse";
  const velocityResponse = 1 - Math.exp(-10 * dt);
  state.pointer.vx += (dx / dt - state.pointer.vx) * velocityResponse;
  state.pointer.vy += (dy / dt - state.pointer.vy) * velocityResponse;
  state.pointer.speed = speed;
  state.pointer.active = true;
  // Charge energy with sustained travel; slow glide stays glassy, fast churn peaks.
  const travelCharge = Math.min(1, Math.max(0, 0.12 + speed * 0.55 + Math.min(0.35, travelEnergyBoost(dx, dy))));
  const chargeResponse = 1 - Math.exp(-dt / POINTER_ENERGY_TAU_CHARGE);
  state.pointer.energy += (Math.max(state.pointer.energy, travelCharge) - state.pointer.energy) * chargeResponse;
  state.pointer.energy = Math.min(1, state.pointer.energy);
  state.pointer.time = now;

  emitPointer();
  emitPhysics();

  // The water is one continuous body: pointer travel disturbs it everywhere,
  // in every section -  not only inside the hero. Zones decide which objects
  // receive forces; the shared heightfield always responds.
  // Gate wakes: require meaningful travel so idle hover does not smear the field.
  let previous = hadPointerSample
    ? { x: x - dx, y: y - dy, time: prevTime, pointerType: initialSample.pointerType }
    : initialSample;
  for (const sample of samples) {
    const sampleDt = Math.max((sample.time - previous.time) / 1000, 1 / 240);
    const sampleDx = sample.x - previous.x;
    const sampleDy = sample.y - previous.y;
    const sampleSpeed = Math.hypot(sampleDx, sampleDy) / sampleDt;
    const travel = Math.hypot(sampleDx, sampleDy);
    if (travel > 2.5 && sampleSpeed > 70) {
      const speedNorm = Math.min(1, sampleSpeed / 1800);
      const touchLike = isTouchLikePointer(sample.pointerType);
      pushInteraction({
        kind: "wake",
        startX: previous.x,
        startY: previous.y,
        endX: sample.x,
        endY: sample.y,
        vx: sampleDx / sampleDt,
        vy: sampleDy / sampleDt,
        // Readable push without knife-edge carving.
        strength: Math.min(0.78, 0.06 + sampleSpeed / 2400 + speedNorm * 0.2),
        radius: touchLike
          ? Math.min(TOUCH_WAKE_RADIUS_MAX, 52 + sampleSpeed * 0.03 + speedNorm * 26)
          : Math.min(MOUSE_WAKE_RADIUS_MAX, 42 + sampleSpeed * 0.026 + speedNorm * 22),
        time: now / 1000,
        pointerType: sample.pointerType,
      });
    }
    previous = sample;
  }

  // Occasional soft splat on sustained travel — distance + time gates keep it
  // from becoming a continuous particle trail. Touch uses a slightly wider gate
  // so finger jitter does not smear, with a clearer intensity when it fires.
  const touchLike = isTouchLikePointer(state.pointer.pointerType);
  const movementDistance = Math.hypot(dx, dy);
  const movementIntensity = resolveMovementSplat({
    distance: movementDistance,
    now,
    lastAt: lastMovementSplatAt,
    minDistance: touchLike ? 18 : 14,
    minInterval: touchLike ? 90 : 72,
  });
  if (movementIntensity !== null) {
    pushRipple(x, y, movementIntensity * (touchLike ? 0.88 : 0.72), now);
    lastMovementSplatAt = now;
  }

}

function travelEnergyBoost(dx: number, dy: number) {
  return Math.hypot(dx, dy) / Math.max(window.innerWidth, window.innerHeight, 1) * 4;
}

function onPointerDown(e: PointerEvent) {
  const now = performance.now();
  lastInputTime = now;
  pendingPointer = null;
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.present = true;
  state.pointer.pointerType = e.pointerType === "touch"
    ? "touch"
    : e.pointerType === "pen"
      ? "pen"
      : "mouse";
  // Preserve the incoming sweep as the initial water momentum. Zeroing it on
  // pointer-down made a click feel detached from the motion that caused it.
  state.pointer.vx *= 0.62;
  state.pointer.vy *= 0.62;
  state.pointer.active = true;
  pressHoldStartedAt = now / 1000;
  lastSuctionEmitAt = 0;
  const incomingSpeed = Math.hypot(state.pointer.vx, state.pointer.vy);
  state.pointer.energy = Math.max(
    state.pointer.energy,
    Math.min(1, 0.48 + incomingSpeed * 0.14),
  );
  state.pointer.time = now;
  emitPointer();
  emitPhysics();
  // A press is a droplet landing in the shared water, wherever it falls.
  // Kept for sound/glyph bus compatibility; the marquee visual is the shockwave.
  const inheritedLength = Math.max(incomingSpeed, 1);
  const touchLike = isTouchLikePointer(e.pointerType || "mouse");
  pushInteraction({
    kind: "press",
    startX: e.clientX,
    startY: e.clientY,
    endX: e.clientX,
    endY: e.clientY,
    vx: state.pointer.vx,
    vy: state.pointer.vy,
    strength: Math.min(1, 0.92 + inheritedLength / 2200),
    radius: touchLike ? TOUCH_PRESS_RADIUS : MOUSE_PRESS_RADIUS,
    time: now / 1000,
    pointerType: e.pointerType || "mouse",
  });
  pushRipple(
    e.clientX,
    e.clientY,
    Math.min(1, (touchLike ? 0.98 : 0.9) + incomingSpeed / 4000),
    now,
  );
  // Touch gets a clearer plunk; mouse keeps the authored desktop strength.
  emitLiquidShockwave(e.clientX, e.clientY, {
    strength: touchLike ? SHOCKWAVE_TOUCH_STRENGTH : SHOCKWAVE_DEFAULT_STRENGTH,
    radius: touchLike ? 148 : undefined,
    pointerType: e.pointerType || "mouse",
  });
}

function onPointerEnd(e: PointerEvent) {
  const wasActive = state.pointer.active;
  const holdAge = pressHoldStartedAt > 0
    ? Math.max(0, performance.now() / 1000 - pressHoldStartedAt)
    : 0;
  pendingPointer = null;
  state.pointer.active = false;
  if (e.type === "pointercancel") state.pointer.present = false;
  state.pointer.vx *= 0.35;
  state.pointer.vy *= 0.35;
  // Soft micro-ring on release; stronger rebound after a sustained suction hold.
  if (wasActive && e.type === "pointerup" && !prefersReducedMotion()) {
    const releaseStrength = holdAge > 0.18
      ? Math.min(0.72, SHOCKWAVE_RELEASE_STRENGTH + holdAge * 0.35)
      : SHOCKWAVE_RELEASE_STRENGTH;
    if (holdAge > 0.18) {
      pushInteraction({
        kind: "release-wave",
        startX: state.pointer.x,
        startY: state.pointer.y,
        endX: state.pointer.x,
        endY: state.pointer.y,
        vx: state.pointer.vx,
        vy: state.pointer.vy,
        strength: releaseStrength,
        radius: 72 + holdAge * 40,
        time: performance.now() / 1000,
        pointerType: state.pointer.pointerType,
      });
    } else {
      emitLiquidShockwave(state.pointer.x, state.pointer.y, { strength: releaseStrength });
    }
  }
  pressHoldStartedAt = 0;
  lastSuctionEmitAt = 0;
  emitPointer();
  emitPhysics();
}

function onPointerLeave() {
  pendingPointer = null;
  pendingPointerSamples = [];
  state.pointer.present = false;
  state.pointer.active = false;
  state.pointer.vx = 0;
  state.pointer.vy = 0;
  pressHoldStartedAt = 0;
  lastSuctionEmitAt = 0;
  emitPointer();
  emitPhysics();
}

function onWindowBlur() {
  onPointerLeave();
}

function tick(now: number) {
  if (document.hidden) return;
  // Cadence is enforced by the unified frame clock (~30 Hz); keep the delta
  // path identical to the previous self-managed rAF publisher.
  const tickDelta = lastTickAt > 0 ? Math.min(0.1, (now - lastTickAt) / 1000) : 1 / 30;
  lastTickAt = now;
  applyPendingPointer();
  const t = now / 1000;
  state.time = t;
  state.world = computeWorldState(state.scroll.velocity);

  if (state.pointer.active && now - lastInputTime > 620) {
    state.pointer.active = false;
    pressHoldStartedAt = 0;
  }
  // Energy breathes with exploration: charge while moving, decay at rest (~0.5s).
  const speedEnergy = Math.min(1, state.pointer.speed * 0.9);
  const holdBoost = state.pointer.active && pressHoldStartedAt > 0
    ? Math.min(0.22, (t - pressHoldStartedAt) * 0.12)
    : 0;
  const targetEnergy = Math.max(speedEnergy, state.pointer.active ? 0.08 + holdBoost : 0);
  const energyTau = targetEnergy > state.pointer.energy
    ? POINTER_ENERGY_TAU_CHARGE
    : POINTER_ENERGY_TAU_DECAY;
  const energyResponse = 1 - Math.exp(-tickDelta / energyTau);
  state.pointer.energy += (targetEnergy - state.pointer.energy) * energyResponse;
  if (state.pointer.energy < 0.001) state.pointer.energy = 0;
  state.pointer.speed *= Math.exp(-(state.pointer.active ? 5.5 : 8.5) * tickDelta);
  state.pointer.vx *= Math.exp(-6.5 * tickDelta);
  state.pointer.vy *= Math.exp(-6.5 * tickDelta);

  // Press-and-hold suction dimple while held in open water (renderer skips when
  // a glyph owns the hold). Emitted sparsely so the 8-splat budget stays free.
  if (
    state.pointer.active
    && pressHoldStartedAt > 0
    && !prefersReducedMotion()
    && now - lastSuctionEmitAt > 48
  ) {
    const holdAge = Math.max(0, t - pressHoldStartedAt);
    if (holdAge > 0.05) {
      const suction = Math.min(1, 0.2 + holdAge * 0.9);
      pushInteraction({
        kind: "suction",
        startX: state.pointer.x,
        startY: state.pointer.y,
        endX: state.pointer.x,
        endY: state.pointer.y,
        vx: state.pointer.vx,
        vy: state.pointer.vy,
        strength: suction,
        radius: 52 + holdAge * 28,
        time: t,
        pointerType: state.pointer.pointerType,
      });
      lastSuctionEmitAt = now;
    }
  }

  state.scroll.velocity = decayScrollVelocity(state.scroll.velocity, tickDelta);
  state.scroll.depth +=
    (state.scroll.progress - state.scroll.depth) * (1 - Math.exp(-3.2 * tickDelta));
  for (let index = state.ripples.length - 1; index >= 0; index--) {
    const r = state.ripples[index];
    const age = (now - r.time) / 1000;
    if (age < RIPPLE_LIFETIME) {
      r.age = age;
    } else {
      state.ripples.splice(index, 1);
    }
  }
  for (let index = state.interactions.length - 1; index >= 0; index--) {
    if (t - state.interactions[index].time > 3.4) state.interactions.splice(index, 1);
  }

  if (!state.pointer.active && now - lastInputTime > 4000 && t > nextIdleRipple) {
    const idleX = window.innerWidth * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64);
    const idleY = window.innerHeight * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56);
    pushRipple(idleX, idleY, 0.22, now);
    nextIdleRipple = t + 8 + ((Math.sin(t * 1.7) + 1) * 0.5) * 6;
  }

  emitPointer();
  emitPhysics();
}

function onVisibilityChange() {
  if (document.hidden) onPointerLeave();
  if (!document.hidden && started) {
    lastTickAt = 0;
  }
}

function onResize() {
  invalidateWorldMeasurement();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const now = performance.now();
  lastInputTime = now;
  lastTickAt = 0;
  lastMovementSplatAt = 0;
  // Route markers are mounted before the shared input subscription starts.
  // Refresh synchronously so a case route never renders one index-depth frame
  // while the 30 Hz publisher waits for its first tick.
  state.world = computeWorldState(state.scroll.velocity);
  rootVarsKey = "";
  setRootVars();

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("blur", onWindowBlur);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener("visibilitychange", onVisibilityChange);

  // The world persists for the whole session: the loop suspends only for a
  // hidden tab, never because the hero left the viewport. Cadence stays ~30 Hz
  // via the unified frame clock.
  subscribeFrameClock(LIQUID_CLOCK_ID, tick, { cadenceMs: PHYSICS_INTERVAL_MS });
}

function stop() {
  if (!started) return;
  started = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerEnd);
  window.removeEventListener("pointercancel", onPointerEnd);
  window.removeEventListener("pointerleave", onPointerLeave);
  window.removeEventListener("blur", onWindowBlur);
  window.removeEventListener("resize", onResize);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  unsubscribeFrameClock(LIQUID_CLOCK_ID);
  pendingPointer = null;
  pendingPointerSamples = [];
}

function hasSubscribers() {
  return (
    pointerSubscribers.size > 0 ||
    physicsSubscribers.size > 0 ||
    rippleSubscribers.size > 0
  );
}

export function emitLiquidPointer(pointer: Partial<LiquidPointerState>) {
  state.pointer = { ...state.pointer, ...pointer };
  setRootVars();
  pointerSubscribers.forEach((subscriber) => subscriber(state.pointer));
  emitPhysics();
}

export function emitLiquidRipple(ripple: LiquidRippleState) {
  pushRipple(ripple.x, ripple.y, ripple.intensity, ripple.time);
  void import("./sound").then(({ playSound }) => playSound("ripple")).catch(() => undefined);
}

/**
 * Inject a directional wake through the shared water -  used when hovering
 * between suspended objects so the current visibly redirects from the
 * previous object toward the next one.
 */
export function emitLiquidWake({
  startX,
  startY,
  endX,
  endY,
  strength = 0.5,
  radius = 34,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  strength?: number;
  radius?: number;
}) {
  const now = performance.now();
  lastInputTime = now;
  const seconds = 1 / 120;
  pushInteraction({
    kind: "wake",
    startX,
    startY,
    endX,
    endY,
    vx: (endX - startX) / seconds,
    vy: (endY - startY) / seconds,
    strength: Math.max(0, Math.min(1, strength)),
    radius,
    time: now / 1000,
    pointerType: "world",
  });
  emitPhysics();
}

/**
 * Inject a soft localized press -  used when the cursor approaches a suspended
 * object (project showcase, contact slab) so the object visibly displaces the
 * water beneath it.
 */
export function emitLiquidPress({
  x,
  y,
  strength = 0.4,
  radius = 44,
}: {
  x: number;
  y: number;
  strength?: number;
  radius?: number;
}) {
  const now = performance.now();
  lastInputTime = now;
  pushInteraction({
    kind: "press",
    startX: x,
    startY: y,
    endX: x,
    endY: y,
    vx: 0,
    vy: 0,
    strength: Math.max(0, Math.min(1, strength)),
    radius,
    time: now / 1000,
    pointerType: "world",
  });
  pushRipple(x, y, Math.min(0.6, strength), now);
  void import("./sound").then(({ playSound }) => playSound("press")).catch(() => undefined);
}

/**
 * Annular click shockwave — a crisp plunk ring in the shared heightfield plus
 * a radial impulse for nearby glyph bodies. Strength 1 is a full page click;
 * use lower values for programmatic / secondary rings.
 */
export function emitLiquidShockwave(
  clientX: number,
  clientY: number,
  options?: { strength?: number; radius?: number; pointerType?: string },
) {
  if (prefersReducedMotion()) return;
  const now = performance.now();
  lastInputTime = now;
  const strength = Math.max(0, Math.min(1.5, options?.strength ?? SHOCKWAVE_DEFAULT_STRENGTH));
  if (strength < 0.02) return;
  const touchLike = isTouchLikePointer(options?.pointerType ?? "world");
  const radius = options?.radius
    ?? (touchLike ? 130 + strength * 48 : 110 + strength * 40);
  pushInteraction({
    kind: "shockwave",
    startX: clientX,
    startY: clientY,
    endX: clientX,
    endY: clientY,
    vx: 0,
    vy: 0,
    strength,
    radius,
    time: now / 1000,
    pointerType: options?.pointerType ?? "world",
  });
  pushRipple(clientX, clientY, Math.min(1, 0.55 + strength * 0.4), now);
  void import("./sound").then(({ playSound }) =>
    playSound("shockwave", { intensity: Math.min(1, strength) }),
  ).catch(() => undefined);
  emitPhysics();
}

export function emitLiquidScroll(scroll: Partial<LiquidScrollState>) {
  const now = performance.now();
  const progress = Math.max(0, Math.min(1, scroll.progress ?? state.scroll.progress));
  const velocity = Math.max(-1.25, Math.min(1.25, scroll.velocity ?? state.scroll.velocity));
  state.scroll = {
    ...state.scroll,
    ...scroll,
    progress,
    velocity,
    direction: velocity > 0.002 ? 1 : velocity < -0.002 ? -1 : state.scroll.direction,
    depth: scroll.depth ?? state.scroll.depth,
    section: Math.max(0, Math.min(3, scroll.section ?? Math.round(progress * 3))),
    time: now,
  };
  setRootVars();
  emitPhysics();
}

export function subscribeLiquidPointer(subscriber: PointerSubscriber) {
  start();
  pointerSubscribers.add(subscriber);
  subscriber(state.pointer);
  return () => {
    pointerSubscribers.delete(subscriber);
    if (!hasSubscribers()) stop();
  };
}

export function subscribeLiquidRipple(subscriber: RippleSubscriber) {
  start();
  rippleSubscribers.add(subscriber);
  return () => {
    rippleSubscribers.delete(subscriber);
    if (!hasSubscribers()) stop();
  };
}

export function subscribeLiquidPhysics(subscriber: PhysicsSubscriber) {
  start();
  physicsSubscribers.add(subscriber);
  subscriber(state);
  return () => {
    physicsSubscribers.delete(subscriber);
    if (!hasSubscribers()) stop();
  };
}

export function getLiquidPhysics(): LiquidPhysics {
  return state;
}

export function sampleLiquidField(x: number, y: number): LiquidFieldSample {
  const pointer = state.pointer;
  let dx = 0;
  let dy = 0;
  let intensity = 0;
  let pointerForce = 0;

  if (pointer.energy > 0.001) {
    const pdx = x - pointer.x;
    const pdy = y - pointer.y;
    const dist = Math.hypot(pdx, pdy);
    const wake = Math.exp(-dist / POINTER_WAKE_RADIUS) * pointer.energy;
    const ring = Math.sin(dist * 0.055 - state.time * 7.5);
    const env = Math.exp(-dist / 260) * pointer.energy;

    const dirX = pdx / Math.max(dist, 1);
    const dirY = pdy / Math.max(dist, 1);
    dx += dirX * wake * 2.2;
    dy += dirY * wake * 2.2;
    dx += pointer.vx * 0.022;
    dy += pointer.vy * 0.022;
    pointerForce = wake;
    intensity += wake * 0.55 + Math.max(ring, 0) * env * 0.28;
  }

  for (const r of state.ripples) {
    const age = (performance.now() - r.time) / 1000;
    if (age >= RIPPLE_LIFETIME) continue;
    const rdx = x - r.x;
    const rdy = y - r.y;
    const dist = Math.hypot(rdx, rdy);
    const radius = 24 + age * RIPPLE_SPEED;
    const ring = Math.sin((dist - radius) * 0.058);
    const falloff = 1 - age / RIPPLE_LIFETIME;
    const env = Math.exp(-Math.abs(dist - radius) / 82) * falloff * r.intensity;
    const dirX = rdx / Math.max(dist, 1);
    const dirY = rdy / Math.max(dist, 1);
    dx += dirX * ring * env * 3.2;
    dy += dirY * ring * env * 3.2;
    intensity += Math.abs(ring) * env * 0.55;
  }

  return {
    x: dx,
    y: dy,
    intensity: Math.min(1, intensity),
    pointerForce,
  };
}
