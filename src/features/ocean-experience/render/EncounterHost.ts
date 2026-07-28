/**
 * EncounterHost — owns lazy project-encounter modules for the renderer.
 *
 * One camera-locked stage root per encounter chapter. Visibility, preload,
 * and eviction are pure swept functions of journey progress (§10.1, §16.5):
 * loads abort on reversal, modules evict two chapters behind, and fast
 * scroll always lands on the exact authored state.
 */

import { Group, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3, type Scene } from "three";
import { chapterRangesForLayout, type ChapterId, type LayoutMode } from "../contracts/chapter.ts";
import type { ExperienceSnapshot } from "../state/experience-store.ts";
import type {
  EncounterFrame,
  EncounterFrameResult,
  EncounterProbe,
  ProjectEncounter,
} from "./encounter-contract.ts";
import {
  encounterWindowFor,
  ENCOUNTER_CHAPTERS,
  visibilityTable,
  type EncounterVisibility,
  type EncounterWindow,
} from "./encounter-visibility.ts";

export const ENCOUNTER_LAYER = 2;

type MutableRef<T> = { current: T };

type EncounterFactory = () => Promise<{
  createMonkeyClawEncounter?: () => ProjectEncounter;
  default?: () => ProjectEncounter;
}>;

type ModuleState = {
  id: ChapterId;
  stage: Group;
  module: ProjectEncounter | null;
  loading: boolean;
  loadGeneration: number;
  abort: AbortController | null;
  attached: boolean;
  stageDistance: number;
  fade: number;
};

export type EncounterHostOptions = {
  scene: Scene;
  camera: PerspectiveCamera;
  reducedMotionRef: MutableRef<boolean>;
  getQualityTier: () => "high" | "balanced" | "low";
  /** Chapter encounter factories — lazy chunks per chapter. */
  factories: Partial<Record<ChapterId, EncounterFactory>>;
  /** Stage distance per chapter (camera-space units). */
  stageDistance: Partial<Record<ChapterId, number>>;
};

const _forward = new Vector3();

export class EncounterHost {
  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly reducedMotionRef: MutableRef<boolean>;
  private readonly getQualityTier: () => "high" | "balanced" | "low";
  private readonly factories: Partial<Record<ChapterId, EncounterFactory>>;
  private readonly stageDistance: Partial<Record<ChapterId, number>>;
  private readonly states = new Map<ChapterId, ModuleState>();
  private windows: readonly EncounterWindow[] = [];
  private windowLayout: LayoutMode | ExperienceSnapshot["ranges"] = null;
  private readonly visibility: EncounterVisibility[] = [];
  private disposed = false;
  private audioSink: ((events: readonly string[]) => void) | null = null;

  constructor(options: EncounterHostOptions) {
    this.scene = options.scene;
    this.camera = options.camera;
    this.reducedMotionRef = options.reducedMotionRef;
    this.getQualityTier = options.getQualityTier;
    this.factories = options.factories;
    this.stageDistance = options.stageDistance;
  }

  /** Milestone 8 audio: receives bounded encounter audio hook events. */
  setAudioSink(sink: ((events: readonly string[]) => void) | null): void {
    this.audioSink = sink;
  }

  /**
   * Windows track the director's active ranges (measured DOM knots when
   * available) so the 3D scene and the DOM copy stay in the same water.
   */
  private windowsFor(
    layout: LayoutMode,
    ranges: ExperienceSnapshot["ranges"],
  ): readonly EncounterWindow[] {
    const key = ranges ?? layout;
    if (this.windowLayout !== key) {
      this.windowLayout = key;
      const active = ranges ?? chapterRangesForLayout(layout);
      this.windows = ENCOUNTER_CHAPTERS.map((id) => encounterWindowFor(id, active));
    }
    return this.windows;
  }

  private stateFor(id: ChapterId): ModuleState {
    let state = this.states.get(id);
    if (!state) {
      const stage = new Group();
      stage.name = `encounter-stage-${id}`;
      stage.visible = false;
      stage.traverse((object) => object.layers.set(ENCOUNTER_LAYER));
      stage.layers.set(ENCOUNTER_LAYER);
      this.scene.add(stage);
      state = {
        id,
        stage,
        module: null,
        loading: false,
        loadGeneration: 0,
        abort: null,
        attached: false,
        stageDistance: this.stageDistance[id] ?? 4.35,
        fade: 0,
      };
      this.states.set(id, state);
    }
    return state;
  }

  private beginLoad(state: ModuleState, layout: LayoutMode): void {
    const factory = this.factories[state.id];
    if (!factory || state.loading || state.module) return;
    state.loading = true;
    const generation = ++state.loadGeneration;
    const abort = new AbortController();
    state.abort = abort;
    void (async () => {
      try {
        const chunk = await factory();
        if (this.disposed || generation !== state.loadGeneration || abort.signal.aborted) return;
        const create = chunk.createMonkeyClawEncounter ?? chunk.default;
        if (!create) return;
        const encounter = create();
        await encounter.load({
          signal: abort.signal,
          generation,
          layout,
          qualityTier: this.getQualityTier(),
        });
        if (this.disposed || generation !== state.loadGeneration || abort.signal.aborted) {
          encounter.dispose();
          return;
        }
        state.module = encounter;
      } catch {
        // Load failure never gates content; retry on the next preload window.
      } finally {
        if (generation === state.loadGeneration) {
          state.loading = false;
          state.abort = null;
        }
      }
    })();
  }

  private cancelLoad(state: ModuleState): void {
    state.loadGeneration += 1;
    state.loading = false;
    state.abort?.abort();
    state.abort = null;
  }

  private evict(state: ModuleState): void {
    this.cancelLoad(state);
    if (state.module) {
      state.module.detach();
      state.module.dispose();
      state.module = null;
    }
    state.attached = false;
    state.stage.visible = false;
    state.fade = 0;
  }

  /**
   * Per-frame driver. Reads the committed ScrollDirector snapshot — never a
   * competing scroll owner. Returns total encounter draw-call estimate.
   */
  frame(
    snapshot: ExperienceSnapshot,
    deltaSeconds: number,
    time: number,
    metrics?: { encounter?: string; phase?: number; fade?: number },
  ): number {
    if (this.disposed) return 0;
    const layout = snapshot.layout;
    const windows = this.windowsFor(layout, snapshot.ranges);
    visibilityTable(windows, snapshot.progress, this.visibility);

    let activeId: ChapterId | null = null;
    let activeFade = 0;

    for (const visibility of this.visibility) {
      const state = this.stateFor(visibility.id);
      if (visibility.shouldPreload && !state.module && !state.loading) {
        this.beginLoad(state, layout);
      }
      if (visibility.shouldEvict && (state.module || state.loading)) {
        this.evict(state);
        continue;
      }
      if (!state.module) {
        state.stage.visible = false;
        continue;
      }

      const fade = visibility.fade;
      state.fade = fade;
      if (fade <= 0.001) {
        if (state.attached) {
          state.module.detach();
          state.attached = false;
        }
        state.stage.visible = false;
        continue;
      }

      if (!state.attached) {
        state.module.attach(state.stage);
        state.stage.traverse((object) => object.layers.set(ENCOUNTER_LAYER));
        state.attached = true;
      }
      state.stage.visible = true;

      // Camera-locked stage: exact deterministic anchor per frame.
      this.camera.getWorldDirection(_forward);
      state.stage.position.copy(this.camera.position)
        .addScaledVector(_forward, state.stageDistance);
      state.stage.quaternion.copy(this.camera.quaternion);

      const frame: EncounterFrame = {
        // Swept from the window range — exact for any progress, including
        // fade overlaps where the director's active chapter differs.
        chapterProgress: visibility.chapterProgress,
        progress: snapshot.progress,
        direction: snapshot.direction,
        velocity: snapshot.velocity,
        fade,
        deltaSeconds,
        time,
        layout,
        reducedMotion: this.reducedMotionRef.current,
        qualityTier: this.getQualityTier(),
      };
      state.module.seek(frame);
      const result: EncounterFrameResult = state.module.update(frame);
      if (result.audioEvents.length > 0) this.audioSink?.(result.audioEvents);

      if (fade > activeFade) {
        activeFade = fade;
        activeId = state.id;
      }
    }

    if (metrics) {
      metrics.encounter = activeId ?? "none";
      metrics.fade = activeFade;
    }
    return activeId ? 1 : 0;
  }

  /** Forward a stage-space probe to the most visible active encounter. */
  probe(event: EncounterProbe): void {
    if (this.disposed) return;
    let target: ModuleState | null = null;
    for (const state of this.states.values()) {
      if (!state.module || state.fade <= 0.001) continue;
      if (!target || state.fade > target.fade) target = state;
    }
    target?.module?.probe(event);
  }

  private readonly raycaster = new Raycaster();
  private readonly probePlane = new Plane();
  private readonly probeNdc = new Vector2();
  private readonly probeHit = new Vector3();

  /**
   * Ray-map a viewport pointer position into the active stage's local frame
   * (§7.4): the probe becomes a bounded physical adversarial pulse, never a
   * required interaction and never fake terminal output.
   */
  probeFromViewport(
    clientX: number,
    clientY: number,
    rect: { left: number; top: number; width: number; height: number },
    kind: EncounterProbe["kind"],
    time: number,
  ): void {
    if (this.disposed) return;
    let target: ModuleState | null = null;
    for (const state of this.states.values()) {
      if (!state.module || state.fade <= 0.001) continue;
      if (!target || state.fade > target.fade) target = state;
    }
    if (!target?.module) return;
    const u = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(rect.width, 1)));
    const v = Math.min(1, Math.max(0, (clientY - rect.top) / Math.max(rect.height, 1)));
    this.probeNdc.set(u * 2 - 1, -(v * 2 - 1));
    this.raycaster.setFromCamera(this.probeNdc, this.camera);
    this.camera.getWorldDirection(_forward);
    this.probePlane.setFromNormalAndCoplanarPoint(_forward, target.stage.position);
    const hit = this.raycaster.ray.intersectPlane(this.probePlane, this.probeHit);
    if (!hit) return;
    target.stage.worldToLocal(this.probeHit);
    target.module.probe({
      kind,
      x: this.probeHit.x,
      y: this.probeHit.y,
      u,
      v,
      time,
    });
  }

  /** Convert a world-space point into the active stage's local frame. */
  stageLocalFromWorld(id: ChapterId, world: Vector3, out: Vector3): boolean {
    const state = this.states.get(id);
    if (!state || !state.module || state.fade <= 0.001) return false;
    out.copy(world);
    state.stage.worldToLocal(out);
    return true;
  }

  hasActiveEncounter(): boolean {
    for (const state of this.states.values()) {
      if (state.module && state.fade > 0.001) return true;
    }
    return false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const state of this.states.values()) {
      this.evict(state);
      this.scene.remove(state.stage);
    }
    this.states.clear();
    this.audioSink = null;
  }
}
