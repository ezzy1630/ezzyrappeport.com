/**
 * Deterministic no-op SceneDirector for architecture, SSR, and tests.
 * Never touches WebGL. Tracks last seek for contract assertions.
 */

import type { ExperiencePreferences } from "../contracts/preferences.ts";
import {
  type LoadContext,
  type SceneDirector,
  type SceneDirectorStatus,
  type ViewportSize,
  createViewportSize,
} from "../contracts/scene.ts";
import { clamp01 } from "../scroll/scroll-mapping.ts";

export type NullSceneDirectorState = {
  status: SceneDirectorStatus;
  progress: number;
  lastSeekDeltaSeconds: number;
  lastRenderTimeSeconds: number;
  resizeCount: number;
  loadCount: number;
  disposeCount: number;
  lastLoadGeneration: number | null;
  viewport: ViewportSize;
  preferences: ExperiencePreferences | null;
};

export class NullSceneDirector implements SceneDirector {
  private status: SceneDirectorStatus = "idle";
  private progress = 0;
  private lastSeekDeltaSeconds = 0;
  private lastRenderTimeSeconds = 0;
  private resizeCount = 0;
  private loadCount = 0;
  private disposeCount = 0;
  private lastLoadGeneration: number | null = null;
  private viewport: ViewportSize = createViewportSize(0, 0, 1);
  private preferences: ExperiencePreferences | null = null;

  async load(context?: LoadContext): Promise<void> {
    if (this.status === "disposed") return;
    if (context?.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    this.status = "loading";
    this.loadCount += 1;
    this.lastLoadGeneration = context?.generation ?? null;
    this.status = "ready";
  }

  resize(viewport: ViewportSize): void {
    if (this.status === "disposed") return;
    this.viewport = createViewportSize(viewport.width, viewport.height, viewport.dpr);
    this.resizeCount += 1;
  }

  seek(progress: number, deltaSeconds: number): void {
    if (this.status === "disposed") return;
    this.progress = clamp01(progress);
    this.lastSeekDeltaSeconds = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
  }

  render(timeSeconds: number): void {
    if (this.status === "disposed") return;
    this.lastRenderTimeSeconds = Number.isFinite(timeSeconds) ? timeSeconds : 0;
  }

  setPreferences(preferences: ExperiencePreferences): void {
    if (this.status === "disposed") return;
    this.preferences = {
      version: preferences.version,
      motion: preferences.motion,
      sound: preferences.sound,
      quality: preferences.quality,
      deviceParallax: preferences.deviceParallax,
      simpleView: preferences.simpleView,
    };
  }

  dispose(): void {
    this.status = "disposed";
    this.disposeCount += 1;
  }

  getState(): NullSceneDirectorState {
    return {
      status: this.status,
      progress: this.progress,
      lastSeekDeltaSeconds: this.lastSeekDeltaSeconds,
      lastRenderTimeSeconds: this.lastRenderTimeSeconds,
      resizeCount: this.resizeCount,
      loadCount: this.loadCount,
      disposeCount: this.disposeCount,
      lastLoadGeneration: this.lastLoadGeneration,
      viewport: {
        width: this.viewport.width,
        height: this.viewport.height,
        dpr: this.viewport.dpr,
      },
      preferences: this.preferences
        ? {
            version: this.preferences.version,
            motion: this.preferences.motion,
            sound: this.preferences.sound,
            quality: this.preferences.quality,
            deviceParallax: this.preferences.deviceParallax,
            simpleView: this.preferences.simpleView,
          }
        : null,
    };
  }
}

export function createNullSceneDirector(): NullSceneDirector {
  return new NullSceneDirector();
}
