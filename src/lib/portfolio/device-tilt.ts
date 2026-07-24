/**
 * Permission-safe device-orientation tilt for subtle camera parallax.
 *
 * Enable path (explicit, no load-time prompts):
 * 1. If DeviceOrientationEvent.requestPermission exists (iOS 13+), wait for
 *    `enableFromUserGesture()` — never call requestPermission on load.
 * 2. Otherwise, start listening when `setAllowed(true)` if the event already
 *    fires without a permission gate.
 * 3. Hard-off when motion is disallowed; unsubscribe on blur / dispose.
 *
 * Visibility/blur listeners install on first use and tear down via
 * disposeDeviceTilt() — no module-evaluation side effects.
 */

export type DeviceTiltSample = {
  /** Screen-relative −1..1 (right / down positive). */
  x: number;
  y: number;
  active: boolean;
};

export type DeviceTiltPermission = "unknown" | "granted" | "denied" | "unavailable";

type OrientationPermissionAPI = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const IDLE: DeviceTiltSample = { x: 0, y: 0, active: false };
/** Mutable hot-path sample — never allocate from getDeviceTilt(). */
const LIVE: DeviceTiltSample = { x: 0, y: 0, active: true };
/** Degrees of physical tilt that map to ±1 before clamp. */
const FULL_SCALE_DEGREES = 14;
const SMOOTHING = 0.12;

let allowed = false;
let listening = false;
let lifecycleInstalled = false;
let permission: DeviceTiltPermission = "unknown";
let rawX = 0;
let rawY = 0;
let smoothX = 0;
let smoothY = 0;
let hasSample = false;
let baseBeta: number | null = null;
let baseGamma: number | null = null;

type Subscriber = (sample: DeviceTiltSample) => void;
const subscribers = new Set<Subscriber>();

function clampUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function publish() {
  const sample = getDeviceTilt();
  subscribers.forEach((subscriber) => subscriber(sample));
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!sample.active) {
    root.style.removeProperty("--device-tilt-x");
    root.style.removeProperty("--device-tilt-y");
    return;
  }
  root.style.setProperty("--device-tilt-x", sample.x.toFixed(4));
  root.style.setProperty("--device-tilt-y", sample.y.toFixed(4));
}

function onOrientation(event: DeviceOrientationEvent) {
  if (!allowed || document.hidden) return;
  if (event.beta == null || event.gamma == null) return;

  if (baseBeta === null || baseGamma === null) {
    baseBeta = event.beta;
    baseGamma = event.gamma;
  }

  // beta: front/back (−180..180), gamma: left/right (−90..90).
  rawX = clampUnit((event.gamma - baseGamma) / FULL_SCALE_DEGREES);
  rawY = clampUnit((event.beta - baseBeta) / FULL_SCALE_DEGREES);
  hasSample = true;
  smoothX += (rawX - smoothX) * SMOOTHING;
  smoothY += (rawY - smoothY) * SMOOTHING;
  publish();
}

function stopListening() {
  if (!listening || typeof window === "undefined") return;
  window.removeEventListener("deviceorientation", onOrientation);
  listening = false;
  hasSample = false;
  baseBeta = null;
  baseGamma = null;
  rawX = 0;
  rawY = 0;
  smoothX = 0;
  smoothY = 0;
  publish();
}

function startListening() {
  if (listening || !allowed || typeof window === "undefined") return;
  if (permission === "denied" || permission === "unavailable") return;
  ensureLifecycleListeners();
  window.addEventListener("deviceorientation", onOrientation, { passive: true });
  listening = true;
}

function orientationApiAvailable() {
  return typeof window !== "undefined" && typeof DeviceOrientationEvent !== "undefined";
}

function needsExplicitPermission() {
  if (!orientationApiAvailable()) return false;
  const api = DeviceOrientationEvent as unknown as OrientationPermissionAPI;
  return typeof api.requestPermission === "function";
}

function onVisibilityOrBlur() {
  if (typeof document !== "undefined" && document.hidden) {
    // Keep permission, drop the live stream until the tab is visible again.
    if (listening) {
      window.removeEventListener("deviceorientation", onOrientation);
      listening = false;
    }
    hasSample = false;
    smoothX = 0;
    smoothY = 0;
    publish();
    return;
  }
  if (allowed && permission === "granted") startListening();
}

function ensureLifecycleListeners() {
  if (lifecycleInstalled || typeof window === "undefined") return;
  window.addEventListener("blur", onVisibilityOrBlur);
  document.addEventListener("visibilitychange", onVisibilityOrBlur);
  lifecycleInstalled = true;
}

function tearDownLifecycleListeners() {
  if (!lifecycleInstalled || typeof window === "undefined") return;
  window.removeEventListener("blur", onVisibilityOrBlur);
  document.removeEventListener("visibilitychange", onVisibilityOrBlur);
  lifecycleInstalled = false;
}

/**
 * Gate for motion systems. When false, samples are idle and listeners detach.
 */
export function setDeviceTiltAllowed(next: boolean) {
  allowed = next;
  if (!allowed) {
    stopListening();
    return;
  }
  // Only auto-start when no invasive permission prompt is required.
  if (!needsExplicitPermission() && permission !== "denied") {
    if (permission === "unknown") permission = "granted";
    startListening();
  }
}

export function getDeviceTiltPermission(): DeviceTiltPermission {
  return permission;
}

export function getDeviceTilt(): DeviceTiltSample {
  if (!allowed || !hasSample) return IDLE;
  LIVE.x = smoothX;
  LIVE.y = smoothY;
  LIVE.active = true;
  return LIVE;
}

/**
 * Call from a user gesture (pointerdown / click). On iOS this may show the
 * system permission sheet once; elsewhere it is a no-op grant + listen.
 * Returns whether listening started.
 */
export async function enableDeviceTiltFromGesture(): Promise<boolean> {
  if (!allowed) return false;
  if (!orientationApiAvailable()) {
    permission = "unavailable";
    return false;
  }
  if (listening) return true;

  if (needsExplicitPermission()) {
    try {
      const api = DeviceOrientationEvent as unknown as OrientationPermissionAPI;
      const result = await api.requestPermission!();
      permission = result === "granted" ? "granted" : "denied";
      if (permission !== "granted") return false;
    } catch {
      permission = "denied";
      return false;
    }
  } else {
    permission = "granted";
  }

  startListening();
  return listening;
}

export function subscribeDeviceTilt(subscriber: Subscriber) {
  ensureLifecycleListeners();
  subscribers.add(subscriber);
  subscriber(getDeviceTilt());
  return () => {
    subscribers.delete(subscriber);
  };
}

export function disposeDeviceTilt() {
  stopListening();
  subscribers.clear();
  allowed = false;
  permission = "unknown";
  tearDownLifecycleListeners();
}

/** Test/diagnostic: whether blur/visibility lifecycle listeners are attached. */
export function isDeviceTiltLifecycleInstalled() {
  return lifecycleInstalled;
}
