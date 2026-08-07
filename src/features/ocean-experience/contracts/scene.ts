/**
 * SceneDirector contract — WebGL/scene owner for later milestones.
 * Progress seeking must be exact and reversible; preferences are push-only.
 * Loads are abortable via LoadContext; content never waits on readiness.
 */

import type { ExperiencePreferences, QualityPreference } from "./preferences.ts";

export type ViewportSize = {
  width: number;
  height: number;
  dpr: number;
};

/** Abortable load generation shared by ExperienceRuntime and resource registry. */
export type LoadContext = {
  signal: AbortSignal;
  /** Monotonic generation; stale awaits must no-op when generation mismatches. */
  generation: number;
};

export type SceneDirector = {
  load(context?: LoadContext): Promise<void>;
  resize(viewport: ViewportSize): void;
  /** Exact and reversible. deltaSeconds may drive secondary motion only. */
  seek(progress: number, deltaSeconds: number): void;
  render(timeSeconds: number): void;
  setPreferences(preferences: ExperiencePreferences): void;
  dispose(): void;
};

export type SceneDirectorStatus =
  | "idle"
  | "loading"
  | "ready"
  | "disposed"
  | "failed";

export function createViewportSize(
  width: number,
  height: number,
  dpr = 1,
): ViewportSize {
  return {
    width: Math.max(0, width),
    height: Math.max(0, height),
    dpr: Number.isFinite(dpr) && dpr > 0 ? dpr : 1,
  };
}

export function qualityFromPreference(
  quality: QualityPreference,
): Exclude<QualityPreference, "auto"> {
  if (quality === "auto") return "balanced";
  return quality;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError")
    || (typeof error === "object"
      && error !== null
      && "name" in error
      && (error as { name: string }).name === "AbortError")
  );
}
