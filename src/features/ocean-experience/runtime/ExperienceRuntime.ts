/**
 * Experience runtime / frame owner for ocean-experience.
 * Owns load/start/seek/stop/dispose with exact cleanup and abortable loads.
 */

import { subscribeFrameClock } from "../../../lib/portfolio/frame-clock.ts";
import type { ExperiencePreferences } from "../contracts/preferences.ts";
import {
  isAbortError,
  type LoadContext,
  type SceneDirector,
  type ViewportSize,
} from "../contracts/scene.ts";
import {
  createResourceRegistry,
  type ResourceRegistry,
} from "./resource-registry.ts";
import { setSceneStatus } from "../state/experience-store.ts";

export type ExperienceRuntimeStatus =
  | "idle"
  | "loading"
  | "ready"
  | "failed"
  | "disposed";

export type ExperienceRuntimeMode = "animated" | "static";

export type ExperienceFrameClock = {
  subscribe: (
    id: string,
    callback: (timeMs: number, deltaMs: number) => void,
    options?: { cadenceMs?: number },
  ) => () => void;
};

export type ExperienceRuntimeOptions = {
  createDirector: () => SceneDirector;
  clock: ExperienceFrameClock;
  /** Defaults to animated. Null / decorative directors use static. */
  mode: ExperienceRuntimeMode;
  clockId?: string;
  registry?: ResourceRegistry;
  onStatus?: (status: ExperienceRuntimeStatus) => void;
};

const DEFAULT_CLOCK_ID = "ocean-experience.scene";

export function createBrowserExperienceFrameClock(): ExperienceFrameClock {
  return {
    subscribe(id, callback, options) {
      return subscribeFrameClock(id, callback, options);
    },
  };
}

export class ExperienceRuntime {
  private readonly createDirector: () => SceneDirector;
  private readonly clock: ExperienceFrameClock;
  private readonly mode: ExperienceRuntimeMode;
  private readonly clockId: string;
  private readonly onStatus: ((status: ExperienceRuntimeStatus) => void) | null;
  private readonly registry: ResourceRegistry;

  private director: SceneDirector | null = null;
  private status: ExperienceRuntimeStatus = "idle";
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private loadGeneration = 0;

  constructor(options: ExperienceRuntimeOptions) {
    this.createDirector = options.createDirector;
    this.clock = options.clock;
    this.mode = options.mode;
    this.clockId = options.clockId ?? DEFAULT_CLOCK_ID;
    this.onStatus = options.onStatus ?? null;
    this.registry = options.registry ?? createResourceRegistry();
  }

  getStatus(): ExperienceRuntimeStatus {
    return this.status;
  }

  getDirector(): SceneDirector | null {
    return this.director;
  }

  getRegistry(): ResourceRegistry {
    return this.registry;
  }

  async load(): Promise<void> {
    if (this.status === "disposed") {
      throw new Error("ExperienceRuntime.load called after dispose");
    }
    if (this.director) {
      return;
    }
    this.setStatus("loading");
    setSceneStatus("loading");
    const handle = this.registry.beginLoad();
    this.loadGeneration = handle.generation;
    const director = this.createDirector();
    this.director = director;
    const context: LoadContext = {
      signal: handle.signal,
      generation: handle.generation,
    };
    try {
      await director.load(context);
      if (this.director !== director || !handle.isCurrent()) {
        director.dispose();
        return;
      }
      this.setStatus("ready");
      setSceneStatus("ready");
    } catch (error) {
      if (isAbortError(error) || !handle.isCurrent() || this.director !== director) {
        if (this.director === director) {
          director.dispose();
          this.director = null;
        }
        return;
      }
      director.dispose();
      this.director = null;
      this.setStatus("failed");
      setSceneStatus("failed");
      this.registry.setFallbackReason(
        error instanceof Error ? error.message : "scene load failed",
      );
    }
  }

  start(): void {
    if (this.status === "disposed" || this.started) return;
    if (this.status !== "ready" || !this.director) {
      throw new Error("ExperienceRuntime.start requires a ready director");
    }
    this.started = true;
    if (this.mode === "static") {
      return;
    }
    const director = this.director;
    this.unsubscribe = this.clock.subscribe(this.clockId, (timeMs) => {
      director.render(timeMs / 1000);
    });
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.started = false;
  }

  seek(progress: number, deltaSeconds: number): void {
    this.director?.seek(progress, deltaSeconds);
  }

  resize(viewport: ViewportSize): void {
    this.director?.resize(viewport);
  }

  setPreferences(preferences: ExperiencePreferences): void {
    this.director?.setPreferences(preferences);
  }

  dispose(): void {
    this.stop();
    this.registry.beginLoad().abort();
    this.loadGeneration += 1;
    if (this.director) {
      this.director.dispose();
      this.director = null;
    }
    this.registry.disposeAll();
    this.setStatus("disposed");
    setSceneStatus("idle");
  }

  private setStatus(status: ExperienceRuntimeStatus): void {
    this.status = status;
    this.onStatus?.(status);
  }
}

export function createExperienceRuntime(
  options: ExperienceRuntimeOptions,
): ExperienceRuntime {
  return new ExperienceRuntime(options);
}
