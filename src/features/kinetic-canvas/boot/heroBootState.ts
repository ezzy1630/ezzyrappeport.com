/**
 * Hero boot state machine
 * ----------------------
 * poster → waterline → chunk → assets → hiddenFrame → crossfade → breach → live
 *
 * Invariants:
 * - Semantic HTML + poster paint before any WebGL work.
 * - No spinner / percentage UI — only a thin caustic waterline.
 * - Save-Data / 2g stays poster/static.
 * - Case routes never run the full hero entrance.
 * - Repeat visits get a shorter breach, never none.
 */

export type HeroBootPhase =
  | "poster"
  | "waterline"
  | "chunk"
  | "assets"
  | "hiddenFrame"
  | "crossfade"
  | "breach"
  | "live"
  | "static"
  | "failed";

export const BOOT_CROSSFADE_MS = 620;
export const BOOT_REPEAT_CROSSFADE_MS = 420;
export const BOOT_COPY_STAGGER_MS = 55;
export const BOOT_SESSION_KEY = "portfolio.hero-boot.v1";

export type BootVisitKind = "first" | "repeat";

export function readBootVisitKind(): BootVisitKind {
  if (typeof window === "undefined") return "first";
  try {
    const seen = sessionStorage.getItem(BOOT_SESSION_KEY) === "seen";
    if (!seen) sessionStorage.setItem(BOOT_SESSION_KEY, "seen");
    return seen ? "repeat" : "first";
  } catch {
    return "first";
  }
}

export function crossfadeMsForVisit(kind: BootVisitKind) {
  return kind === "repeat" ? BOOT_REPEAT_CROSSFADE_MS : BOOT_CROSSFADE_MS;
}

/** Capable devices may early-fetch the GLB after first paint. */
export function shouldEarlyFetchGlb(qualityTier: string, saveData: boolean) {
  if (saveData) return false;
  if (qualityTier === "static" || qualityTier === "low") return false;
  if (typeof navigator === "undefined") return false;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return memory >= 4 && (navigator.hardwareConcurrency ?? 4) >= 4;
}

export function nextBootPhase(phase: HeroBootPhase, event: "paint" | "chunk" | "assets" | "frame" | "crossfade-done" | "breach-done" | "fail" | "static"): HeroBootPhase {
  if (event === "fail") return "failed";
  if (event === "static") return "static";
  switch (phase) {
    case "poster":
      return event === "paint" ? "waterline" : phase;
    case "waterline":
      return event === "chunk" ? "chunk" : phase;
    case "chunk":
      return event === "assets" ? "assets" : phase;
    case "assets":
      return event === "frame" ? "hiddenFrame" : phase;
    case "hiddenFrame":
      return event === "frame" ? "crossfade" : phase;
    case "crossfade":
      return event === "crossfade-done" ? "breach" : phase;
    case "breach":
      return event === "breach-done" ? "live" : phase;
    default:
      return phase;
  }
}
