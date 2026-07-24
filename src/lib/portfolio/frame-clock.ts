"use client";

/**
 * Unified frame clock
 * -------------------
 * One requestAnimationFrame loop for the whole portfolio runtime. Named
 * subscribers declare an optional cadence (e.g. liquid CSS vars at ~30 Hz)
 * while the WebGL renderer can run every display frame. The loop auto-stops
 * when no subscribers remain and pauses while the document is hidden.
 *
 * GSAP binding is explicit and reference-counted: call bindGsapToFrameClock
 * from a client effect, and unbindGsapFromFrameClock on teardown.
 */

export type FrameClockCallback = (timeMs: number, deltaMs: number) => void;

export type FrameClockSubscribeOptions = {
  /** Minimum milliseconds between callbacks. 0 = every display frame. */
  cadenceMs?: number;
};

type Subscriber = {
  id: string;
  callback: FrameClockCallback;
  cadenceMs: number;
  lastFiredAt: number;
};

const subscribers = new Map<string, Subscriber>();

let rafId = 0;
let lastNow = 0;
let visibilityBound = false;
let gsapDriver: ((timeMs: number) => void) | null = null;
let gsapBindPromise: Promise<void> | null = null;
let gsapBindCount = 0;
let gsapUpdateRoot: ((timeSeconds: number) => void) | null = null;

function pump(now: number) {
  rafId = 0;
  if (subscribers.size === 0) {
    lastNow = 0;
    return;
  }
  if (typeof document !== "undefined" && document.hidden) {
    // Stay subscribed; visibilitychange restarts the loop.
    return;
  }

  const deltaMs = lastNow > 0 ? Math.min(100, now - lastNow) : 1000 / 60;
  lastNow = now;

  gsapDriver?.(now);

  for (const subscriber of subscribers.values()) {
    if (
      subscriber.cadenceMs > 0
      && subscriber.lastFiredAt > 0
      && now - subscriber.lastFiredAt < subscriber.cadenceMs
    ) {
      continue;
    }
    subscriber.lastFiredAt = now;
    subscriber.callback(now, deltaMs);
  }

  if (subscribers.size > 0) {
    rafId = requestAnimationFrame(pump);
  } else {
    lastNow = 0;
  }
}

function onVisibilityChange() {
  if (typeof document === "undefined") return;
  if (!document.hidden && subscribers.size > 0) ensureRunning();
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function unbindVisibility() {
  if (!visibilityBound || typeof document === "undefined") return;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  visibilityBound = false;
}

function ensureRunning() {
  if (rafId || typeof window === "undefined") return;
  if (typeof document !== "undefined" && document.hidden) return;
  lastNow = 0;
  rafId = requestAnimationFrame(pump);
}

export function subscribeFrameClock(
  id: string,
  callback: FrameClockCallback,
  options: FrameClockSubscribeOptions = {},
): () => void {
  bindVisibility();
  subscribers.set(id, {
    id,
    callback,
    cadenceMs: Math.max(0, options.cadenceMs ?? 0),
    lastFiredAt: 0,
  });
  ensureRunning();
  return () => unsubscribeFrameClock(id);
}

export function unsubscribeFrameClock(id: string) {
  subscribers.delete(id);
  if (subscribers.size === 0 && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    lastNow = 0;
  }
  if (subscribers.size === 0) unbindVisibility();
}

export function isFrameClockRunning() {
  return rafId !== 0;
}

export function frameClockSubscriberCount() {
  return subscribers.size;
}

/**
 * Drive GSAP from this clock (single rAF). Reference-counted and idempotent.
 * Safe to call from client effects; no window access at module evaluation.
 */
export function bindGsapToFrameClock(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  gsapBindCount += 1;
  if (gsapDriver) return Promise.resolve();
  if (gsapBindPromise) return gsapBindPromise;

  gsapBindPromise = import("gsap").then(({ default: gsap }) => {
    if (gsapBindCount <= 0) {
      gsapBindPromise = null;
      return;
    }
    gsap.ticker.lagSmoothing(0);
    gsap.ticker.remove(gsap.updateRoot);
    gsapUpdateRoot = gsap.updateRoot.bind(gsap);
    gsapDriver = (timeMs: number) => {
      gsapUpdateRoot?.(timeMs / 1000);
    };
  }).catch(() => {
    gsapBindPromise = null;
    gsapBindCount = Math.max(0, gsapBindCount - 1);
  });

  return gsapBindPromise ?? Promise.resolve();
}

/**
 * Drop one bindGsapToFrameClock() claim. When the count hits zero, restore
 * GSAP's own ticker root and clear the driver.
 */
export function unbindGsapFromFrameClock(): void {
  if (gsapBindCount <= 0) return;
  gsapBindCount -= 1;
  if (gsapBindCount > 0) return;

  gsapDriver = null;
  gsapBindPromise = null;
  if (typeof window === "undefined") {
    gsapUpdateRoot = null;
    return;
  }
  void import("gsap").then(({ default: gsap }) => {
    if (gsapBindCount > 0 || gsapDriver) return;
    if (gsapUpdateRoot) {
      gsap.ticker.add(gsap.updateRoot);
    }
    gsapUpdateRoot = null;
  }).catch(() => {
    gsapUpdateRoot = null;
  });
}

/** Test/diagnostic: active GSAP bind claims. */
export function gsapFrameClockBindCount() {
  return gsapBindCount;
}
