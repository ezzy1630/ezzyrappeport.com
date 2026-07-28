/**
 * Project encounter contract (plan §10.1).
 *
 * Each anchor project gets a distinct ocean phenomenon inside the same water,
 * driven by the same camera grammar, light physics, and input. The module is
 * a small pure-mapping owner: every primary transform derives from chapter
 * progress so scroll reversal reconstructs the exact composition; secondary
 * motion (idle pulses, probe response) decays back to that state.
 */

import type { Group } from "three";
import type { ChapterId, LayoutMode } from "../contracts/chapter.ts";

/** Continuous per-frame inputs handed to an active encounter. */
export type EncounterFrame = {
  /** Local chapter progress in [0, 1] from the sole ScrollDirector. */
  chapterProgress: number;
  /** Global journey progress in [0, 1]. */
  progress: number;
  /** Scroll direction -1 | 0 | 1. */
  direction: -1 | 0 | 1;
  /** Filtered scroll velocity (px/s, signed). */
  velocity: number;
  /** Visibility fade in [0, 1] from the swept window table. */
  fade: number;
  /** Frame delta seconds (secondary motion only). */
  deltaSeconds: number;
  /** Absolute renderer time seconds. */
  time: number;
  layout: LayoutMode;
  reducedMotion: boolean;
  qualityTier: "high" | "balanced" | "low";
};

/** Stage-space pointer probe (encounter-local coordinates). */
export type EncounterProbe = {
  kind: "move" | "down" | "up" | "cancel";
  /** Stage-local x (screen-right) and y (screen-up) in world units. */
  x: number;
  y: number;
  /** Viewport-relative position in [0, 1] for DOM-aligned effects. */
  u: number;
  v: number;
  time: number;
};

/** Audio hook events (§14) — consumed by the AudioDirector in Milestone 8. */
export type EncounterAudioEvent =
  | "probe-pulse"
  | "judge-hit"
  | "deflect"
  | "telemetry-return";

export type EncounterFrameResult = {
  /** Draw calls attributable to this encounter (diagnostics). */
  drawCalls: number;
  /** Bounded audio hook events emitted this frame. */
  audioEvents: readonly EncounterAudioEvent[];
};

export type EncounterLoadContext = {
  signal: AbortSignal;
  generation: number;
  layout: LayoutMode;
  qualityTier: "high" | "balanced" | "low";
};

/**
 * A lazily loaded, explicitly disposable encounter scene. Objects attach to a
 * camera-locked stage root whose local space is: +x screen-right, +y
 * screen-up, +z toward the camera.
 */
export type ProjectEncounter = {
  readonly id: ChapterId;
  /** Estimated GPU memory in MB (budget accounting). */
  readonly estimatedGpuMb: number;
  load(context: EncounterLoadContext): Promise<void>;
  /** Attach built objects/materials to the stage root. */
  attach(root: Group): void;
  /** Primary choreography: pure function of frame.chapterProgress. */
  seek(frame: EncounterFrame): void;
  /** Signature pointer interaction; bounded and never required. */
  probe(event: EncounterProbe): void;
  /** Fixed-step secondary simulation (bounded work). */
  update(frame: EncounterFrame): EncounterFrameResult;
  /** Detach from the stage; idempotent. */
  detach(): void;
  /** Release geometries, materials, textures, and buffers; idempotent. */
  dispose(): void;
};
