"use client";

import { resolveMovementSplat } from "./interaction-policy";

export type LiquidPointerState = {
  x: number;
  y: number;
  active: boolean;
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
  scroll: LiquidScrollState;
  time: number;
};

export type LiquidFieldSample = {
  x: number;
  y: number;
  intensity: number;
  pointerForce: number;
};

type PointerSubscriber = (state: LiquidPointerState) => void;
type RippleSubscriber = (state: LiquidRippleState) => void;
type PhysicsSubscriber = (state: LiquidPhysics) => void;

const RIPPLE_LIFETIME = 3.2;
const MAX_RIPPLES = 16;
const POINTER_WAKE_RADIUS = 260;
const RIPPLE_SPEED = 155;

const defaultX = typeof window !== "undefined" ? window.innerWidth * 0.62 : 0;
const defaultY = typeof window !== "undefined" ? window.innerHeight * 0.54 : 0;

const state: LiquidPhysics = {
  pointer: {
    x: defaultX,
    y: defaultY,
    active: false,
    speed: 0,
    vx: 0,
    vy: 0,
    energy: 0,
    time: 0,
  },
  ripples: [],
  scroll: {
    progress: 0,
    velocity: 0,
    direction: 0,
    depth: 0,
    section: 0,
    time: 0,
  },
  time: 0,
};

const pointerSubscribers = new Set<PointerSubscriber>();
const rippleSubscribers = new Set<RippleSubscriber>();
const physicsSubscribers = new Set<PhysicsSubscriber>();

let started = false;
let raf = 0;
let nextIdleRipple = 8;
let lastInputTime = 0;
let lastTickAt = 0;
let lastMovementSplatAt = 0;
let rootVarsKey = "";
let pendingPointer: { x: number; y: number; time: number } | null = null;
let runtimeVisible = true;
let visibilityObserver: IntersectionObserver | null = null;

const PHYSICS_INTERVAL_MS = 1000 / 30;

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
  ].join("|");
  if (nextKey === rootVarsKey) return;
  rootVarsKey = nextKey;
  const root = document.documentElement;
  root.style.setProperty("--liquid-x", `${state.pointer.x}px`);
  root.style.setProperty("--liquid-y", `${state.pointer.y}px`);
  root.style.setProperty("--liquid-speed", state.pointer.speed.toFixed(3));
  root.style.setProperty("--liquid-energy", state.pointer.energy.toFixed(3));
  root.style.setProperty("--liquid-active", state.pointer.active ? "1" : "0");
  root.style.setProperty("--liquid-scroll", state.scroll.progress.toFixed(4));
  root.style.setProperty("--liquid-scroll-velocity", state.scroll.velocity.toFixed(3));
  root.style.setProperty("--liquid-depth", state.scroll.depth.toFixed(3));
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

function onPointerMove(e: PointerEvent) {
  const now = performance.now();
  lastInputTime = now;
  pendingPointer = { x: e.clientX, y: e.clientY, time: now };
}

function applyPendingPointer() {
  if (!pendingPointer) return;
  const { x, y, time: now } = pendingPointer;
  pendingPointer = null;
  const prevTime = state.pointer.time || now;
  const dt = Math.max((now - prevTime) / 1000, 0.001);
  const dx = x - state.pointer.x;
  const dy = y - state.pointer.y;
  const speed = Math.hypot(dx, dy) / Math.max(window.innerWidth, window.innerHeight) / dt;

  state.pointer.x = x;
  state.pointer.y = y;
  const velocityResponse = 1 - Math.exp(-10 * dt);
  state.pointer.vx += (dx / dt - state.pointer.vx) * velocityResponse;
  state.pointer.vy += (dy / dt - state.pointer.vy) * velocityResponse;
  state.pointer.speed = speed;
  state.pointer.active = true;
  const trailEnergy = Math.min(0.82, Math.max(0.24, 0.22 + speed * 0.14));
  state.pointer.energy = Math.max(state.pointer.energy, trailEnergy);
  state.pointer.time = now;

  emitPointer();
  emitPhysics();

  // Add an occasional low-energy wake to ordinary pointer travel. The
  // distance and elapsed-time gates keep it legible as water motion instead
  // of turning a fast sweep into a particle trail.
  const movementDistance = Math.hypot(dx, dy);
  const movementIntensity = resolveMovementSplat({
    distance: movementDistance,
    now,
    lastAt: lastMovementSplatAt,
  });
  if (movementIntensity !== null) {
    pushRipple(x, y, movementIntensity, now);
    lastMovementSplatAt = now;
  }

}

function onPointerDown(e: PointerEvent) {
  const now = performance.now();
  lastInputTime = now;
  pendingPointer = null;
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.vx = 0;
  state.pointer.vy = 0;
  state.pointer.active = true;
  state.pointer.energy = Math.max(state.pointer.energy, 0.7);
  state.pointer.time = now;
  emitPointer();
  emitPhysics();
  pushRipple(e.clientX, e.clientY, 0.9, now);
}

function onPointerEnd() {
  pendingPointer = null;
  state.pointer.active = false;
  state.pointer.vx *= 0.35;
  state.pointer.vy *= 0.35;
  emitPointer();
  emitPhysics();
}

function tick(now: number) {
  if (document.hidden || !runtimeVisible) return;
  if (now - lastTickAt < PHYSICS_INTERVAL_MS) {
    raf = requestAnimationFrame(tick);
    return;
  }
  const tickDelta = lastTickAt > 0 ? Math.min(0.1, (now - lastTickAt) / 1000) : 1 / 30;
  lastTickAt = now;
  applyPendingPointer();
  const t = now / 1000;
  state.time = t;

  if (state.pointer.active && now - lastInputTime > 620) {
    state.pointer.active = false;
  }
  const targetEnergy = state.pointer.active
    ? Math.min(0.82, Math.max(0.24, 0.22 + state.pointer.speed * 0.14))
    : 0;
  const energyResponse = 1 - Math.exp(-(state.pointer.active ? 7.5 : 5.5) * tickDelta);
  state.pointer.energy += (targetEnergy - state.pointer.energy) * energyResponse;
  state.pointer.speed *= Math.exp(-(state.pointer.active ? 5.5 : 8.5) * tickDelta);
  state.pointer.vx *= Math.exp(-8.5 * tickDelta);
  state.pointer.vy *= Math.exp(-8.5 * tickDelta);
  state.scroll.velocity *= Math.exp(-7.5 * tickDelta);
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

  if (!state.pointer.active && now - lastInputTime > 4000 && t > nextIdleRipple) {
    const idleX = window.innerWidth * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64);
    const idleY = window.innerHeight * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56);
    pushRipple(idleX, idleY, 0.22, now);
    nextIdleRipple = t + 8 + ((Math.sin(t * 1.7) + 1) * 0.5) * 6;
  }

  emitPointer();
  emitPhysics();
  raf = requestAnimationFrame(tick);
}

function onVisibilityChange() {
  cancelAnimationFrame(raf);
  if (!document.hidden && runtimeVisible && started) {
    lastTickAt = 0;
    raf = requestAnimationFrame(tick);
  }
}

function setRuntimeVisible(visible: boolean) {
  if (runtimeVisible === visible) return;
  runtimeVisible = visible;
  cancelAnimationFrame(raf);
  if (runtimeVisible && !document.hidden && started) {
    lastTickAt = 0;
    raf = requestAnimationFrame(tick);
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const now = performance.now();
  lastInputTime = now;
  lastTickAt = 0;
  lastMovementSplatAt = 0;
  runtimeVisible = true;

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd);
  document.addEventListener("visibilitychange", onVisibilityChange);

  const renderSurface = document.querySelector<HTMLElement>(".hero-shell, .case-hero");
  if (renderSurface && "IntersectionObserver" in window) {
    const rect = renderSurface.getBoundingClientRect();
    runtimeVisible = rect.bottom > -180 && rect.top < window.innerHeight + 180;
    visibilityObserver = new IntersectionObserver(
      ([entry]) => setRuntimeVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "180px 0px" },
    );
    visibilityObserver.observe(renderSurface);
  }

  if (runtimeVisible && !document.hidden) raf = requestAnimationFrame(tick);
}

function stop() {
  if (!started) return;
  started = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerEnd);
  window.removeEventListener("pointercancel", onPointerEnd);
  window.removeEventListener("pointerleave", onPointerEnd);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  visibilityObserver?.disconnect();
  visibilityObserver = null;
  cancelAnimationFrame(raf);
  pendingPointer = null;
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
