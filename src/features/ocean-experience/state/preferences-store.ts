/**
 * Versioned ocean-experience preferences.
 * Sound is independent of motion. OS reduced-motion is a hard ceiling on Full.
 * Storage key is namespaced separately from legacy `portfolio-motion`.
 */

export type MotionPreference = "full" | "reduced" | "off";
export type QualityPreference = "auto" | "high" | "balanced" | "low";

export type ExperiencePreferences = {
  version: 1;
  motion: MotionPreference;
  sound: boolean;
  quality: QualityPreference;
  /** Explicit opt-in only; default false. */
  deviceParallax: boolean;
  simpleView: boolean;
};

export type PreferencesListener = () => void;

export const PREFERENCES_STORAGE_KEY = "ocean-experience-prefs.v1";
export const PREFERENCES_SCHEMA_VERSION = 1 as const;

export const DEFAULT_PREFERENCES: ExperiencePreferences = {
  version: 1,
  motion: "full",
  sound: false,
  quality: "auto",
  deviceParallax: false,
  simpleView: false,
};

const MOTION_VALUES: readonly MotionPreference[] = ["full", "reduced", "off"];
const QUALITY_VALUES: readonly QualityPreference[] = [
  "auto",
  "high",
  "balanced",
  "low",
];

let snapshot: ExperiencePreferences = { ...DEFAULT_PREFERENCES };
const listeners = new Set<PreferencesListener>();
let hydrated = false;

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isMotionPreference(value: unknown): value is MotionPreference {
  return typeof value === "string" && (MOTION_VALUES as readonly string[]).includes(value);
}

export function isQualityPreference(value: unknown): value is QualityPreference {
  return typeof value === "string" && (QUALITY_VALUES as readonly string[]).includes(value);
}

/**
 * Defensive sanitization of persisted / external preference payloads.
 * Unknown fields are dropped; invalid values fall back to defaults.
 */
export function sanitizePreferences(input: unknown): ExperiencePreferences {
  const base = { ...DEFAULT_PREFERENCES };
  if (!input || typeof input !== "object") {
    return base;
  }
  const raw = input as Record<string, unknown>;

  const version = raw.version === 1 ? 1 : PREFERENCES_SCHEMA_VERSION;
  const motion = isMotionPreference(raw.motion) ? raw.motion : base.motion;
  const quality = isQualityPreference(raw.quality) ? raw.quality : base.quality;
  const sound = typeof raw.sound === "boolean" ? raw.sound : base.sound;
  const deviceParallax =
    typeof raw.deviceParallax === "boolean" ? raw.deviceParallax : base.deviceParallax;
  const simpleView =
    typeof raw.simpleView === "boolean" ? raw.simpleView : base.simpleView;

  return {
    version,
    motion,
    sound,
    quality,
    deviceParallax,
    simpleView,
  };
}

export function readOsReducedMotion(
  matchMedia: ((query: string) => { matches: boolean }) | null = null,
): boolean {
  if (matchMedia) {
    try {
      return matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * OS prefers-reduced-motion is a hard ceiling: Full cannot produce full camera motion.
 * Sound is not affected.
 */
export function applyOsReducedMotionCeiling(
  motion: MotionPreference,
  osReducedMotion: boolean,
): MotionPreference {
  if (osReducedMotion && motion === "full") return "reduced";
  return motion;
}

/**
 * Resolve effective preferences before effects mount.
 * Stored values are sanitized; OS reduced clamps Full to reduced.
 * Sound remains independent.
 */
export function resolveInitialPreferences(input: {
  stored: unknown;
  osReducedMotion: boolean;
}): ExperiencePreferences {
  const sanitized = sanitizePreferences(input.stored);
  const hadStoredMotion =
    input.stored &&
    typeof input.stored === "object" &&
    isMotionPreference((input.stored as Record<string, unknown>).motion);

  let motion = sanitized.motion;
  if (!hadStoredMotion && input.osReducedMotion && motion === "full") {
    motion = "reduced";
  }
  motion = applyOsReducedMotionCeiling(motion, input.osReducedMotion);

  return { ...sanitized, motion };
}

function readStoredRaw(): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function persist(prefs: ExperiencePreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Quota / private mode - ignore.
  }
}

function readBootAttributes(): Partial<ExperiencePreferences> | null {
  if (typeof document === "undefined") return null;
  const root = document.documentElement;
  const motionAttr = root.getAttribute("data-experience-motion");
  const soundAttr = root.getAttribute("data-experience-sound");
  const qualityAttr = root.getAttribute("data-experience-quality");
  const simpleAttr = root.getAttribute("data-experience-simple");
  const parallaxAttr = root.getAttribute("data-experience-parallax");
  if (!motionAttr && !soundAttr && !qualityAttr && !simpleAttr && !parallaxAttr) {
    return null;
  }
  return sanitizePreferences({
    version: 1,
    motion: motionAttr,
    sound: soundAttr === "on",
    quality: qualityAttr,
    simpleView: simpleAttr === "on",
    deviceParallax: parallaxAttr === "on",
  });
}

function writeBootAttributes(prefs: ExperiencePreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-experience-motion", prefs.motion);
  root.setAttribute("data-experience-sound", prefs.sound ? "on" : "off");
  root.setAttribute("data-experience-quality", prefs.quality);
  root.setAttribute("data-experience-simple", prefs.simpleView ? "on" : "off");
  root.setAttribute("data-experience-parallax", prefs.deviceParallax ? "on" : "off");
}

function withOsCeiling(
  prefs: ExperiencePreferences,
  osReducedMotion: boolean,
): ExperiencePreferences {
  return {
    ...prefs,
    motion: applyOsReducedMotionCeiling(prefs.motion, osReducedMotion),
  };
}

/**
 * Hydrate once from boot attributes -> storage -> OS.
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function hydratePreferencesStore(
  options?: { osReducedMotion?: boolean },
): ExperiencePreferences {
  if (hydrated) return snapshot;
  hydrated = true;

  const osReducedMotion =
    typeof options?.osReducedMotion === "boolean"
      ? options.osReducedMotion
      : readOsReducedMotion();

  const boot = readBootAttributes();
  if (boot) {
    snapshot = withOsCeiling(
      { ...DEFAULT_PREFERENCES, ...boot, version: 1 },
      osReducedMotion,
    );
    writeBootAttributes(snapshot);
    emit();
    return snapshot;
  }

  snapshot = resolveInitialPreferences({
    stored: readStoredRaw(),
    osReducedMotion,
  });
  writeBootAttributes(snapshot);
  emit();
  return snapshot;
}

/**
 * Pure snapshot read for React render / useSyncExternalStore.
 * Never touches localStorage, matchMedia, or the document.
 */
export function getPreferencesSnapshot(): ExperiencePreferences {
  return snapshot;
}

export function getServerPreferencesSnapshot(): ExperiencePreferences {
  return DEFAULT_PREFERENCES;
}

export function subscribePreferences(listener: PreferencesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setPreferences(patch: Partial<Omit<ExperiencePreferences, "version">>): void {
  const next = sanitizePreferences({
    ...snapshot,
    ...patch,
    version: 1,
  });
  snapshot = withOsCeiling(next, readOsReducedMotion());
  persist(snapshot);
  writeBootAttributes(snapshot);
  emit();
}

export function replacePreferences(next: ExperiencePreferences): void {
  snapshot = withOsCeiling(sanitizePreferences(next), readOsReducedMotion());
  persist(snapshot);
  writeBootAttributes(snapshot);
  emit();
}

export function resetPreferencesStore(): void {
  hydrated = false;
  snapshot = { ...DEFAULT_PREFERENCES };
  listeners.clear();
}

/** True when the cinematic rail should not run (normal document flow). */
export function shouldUseSimpleStory(prefs: ExperiencePreferences): boolean {
  return prefs.simpleView || prefs.motion === "reduced" || prefs.motion === "off";
}
