"use client";

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

export type LiquidPhysics = {
  pointer: LiquidPointerState;
  ripples: LiquidRippleState[];
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
const POINTER_WAKE_RADIUS = 220;
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
  time: 0,
};

const pointerSubscribers = new Set<PointerSubscriber>();
const rippleSubscribers = new Set<RippleSubscriber>();
const physicsSubscribers = new Set<PhysicsSubscriber>();

let started = false;
let raf = 0;
let nextIdleRipple = 1.4;
let lastInputTime = 0;
let lastRippleAt = 0;

function setRootVars() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--liquid-x", `${state.pointer.x}px`);
  root.style.setProperty("--liquid-y", `${state.pointer.y}px`);
  root.style.setProperty("--liquid-speed", state.pointer.speed.toFixed(3));
  root.style.setProperty("--liquid-energy", state.pointer.energy.toFixed(3));
  root.style.setProperty("--liquid-active", state.pointer.active ? "1" : "0");
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
  const prevTime = state.pointer.time || now;
  const dt = Math.max((now - prevTime) / 1000, 0.001);
  const dx = e.clientX - state.pointer.x;
  const dy = e.clientY - state.pointer.y;
  const speed = Math.hypot(dx, dy) / Math.max(window.innerWidth, window.innerHeight) / dt;

  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.vx += (dx / dt - state.pointer.vx) * 0.25;
  state.pointer.vy += (dy / dt - state.pointer.vy) * 0.25;
  state.pointer.speed = speed;
  state.pointer.active = true;
  state.pointer.energy = Math.min(1.0, Math.max(state.pointer.energy, 0.14 + speed * 0.32));
  state.pointer.time = now;

  emitPointer();
  emitPhysics();

  if (now - lastRippleAt > 240) {
    const intensity = Math.min(0.7, 0.12 + speed * 0.38);
    pushRipple(e.clientX, e.clientY, intensity, now);
    lastRippleAt = now;
  }
}

function onPointerDown(e: PointerEvent) {
  const now = performance.now();
  lastInputTime = now;
  state.pointer.x = e.clientX;
  state.pointer.y = e.clientY;
  state.pointer.vx = 0;
  state.pointer.vy = 0;
  state.pointer.active = true;
  state.pointer.energy = Math.max(state.pointer.energy, 0.7);
  state.pointer.time = now;
  lastRippleAt = now;
  emitPointer();
  emitPhysics();
  pushRipple(e.clientX, e.clientY, 0.9, now);
}

function onPointerEnd() {
  state.pointer.active = false;
  state.pointer.vx *= 0.35;
  state.pointer.vy *= 0.35;
  emitPointer();
  emitPhysics();
}

function tick(now: number) {
  const t = now / 1000;
  state.time = t;

  const targetEnergy = state.pointer.active ? 0.36 : 0.03;
  const k = state.pointer.active ? 0.08 : 0.025;
  state.pointer.energy += (targetEnergy - state.pointer.energy) * k;

  const freshRipples: LiquidRippleState[] = [];
  for (const r of state.ripples) {
    const age = (now - r.time) / 1000;
    if (age < RIPPLE_LIFETIME) {
      freshRipples.push({ ...r, age });
    }
  }
  state.ripples = freshRipples;

  if (!state.pointer.active && now - lastInputTime > 2600 && t > nextIdleRipple) {
    const idleX = window.innerWidth * (0.18 + ((Math.sin(t * 0.37) + 1) * 0.5) * 0.64);
    const idleY = window.innerHeight * (0.18 + ((Math.cos(t * 0.29 + 1.2) + 1) * 0.5) * 0.56);
    pushRipple(idleX, idleY, 0.12, now);
    nextIdleRipple = t + 3.4 + ((Math.sin(t * 1.7) + 1) * 0.5) * 1.8;
  }

  emitPointer();
  emitPhysics();
  raf = requestAnimationFrame(tick);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const now = performance.now();
  lastInputTime = now;
  lastRippleAt = 0;

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerup", onPointerEnd, { passive: true });
  window.addEventListener("pointercancel", onPointerEnd, { passive: true });
  window.addEventListener("pointerleave", onPointerEnd);

  raf = requestAnimationFrame(tick);
}

function stop() {
  if (!started) return;
  started = false;
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerdown", onPointerDown);
  window.removeEventListener("pointerup", onPointerEnd);
  window.removeEventListener("pointercancel", onPointerEnd);
  window.removeEventListener("pointerleave", onPointerEnd);
  cancelAnimationFrame(raf);
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
