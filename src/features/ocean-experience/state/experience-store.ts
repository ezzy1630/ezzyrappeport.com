/**
 * Tiny imperative experience store.
 * Progress updates stay in the snapshot without notifying React every frame.
 * Discrete field changes (activeChapter, locked, layout, …) notify subscribers.
 */

import {
  type ChapterId,
  type ChapterRange,
  type LayoutMode,
  CHAPTER_ORDER,
} from "../contracts/chapter.ts";

export type ScrollDirection = -1 | 0 | 1;

export type ExperienceSnapshot = {
  progress: number;
  activeChapter: ChapterId;
  chapterProgress: number;
  direction: ScrollDirection;
  velocity: number;
  locked: boolean;
  layout: LayoutMode;
  /** Active chapter ranges: measured DOM knots when available, authored
      normalized ranges otherwise. Discrete (identity-compared). */
  ranges: readonly ChapterRange[] | null;
  /** Scene lifecycle - decorative; never gates content. */
  sceneStatus: "idle" | "loading" | "ready" | "failed";
};

export type ExperienceListener = () => void;

const INITIAL: ExperienceSnapshot = {
  progress: 0,
  activeChapter: CHAPTER_ORDER[0],
  chapterProgress: 0,
  direction: 0,
  velocity: 0,
  locked: false,
  layout: "desktop",
  ranges: null,
  sceneStatus: "idle",
};

let snapshot: ExperienceSnapshot = { ...INITIAL };
const listeners = new Set<ExperienceListener>();

function discreteEqual(a: ExperienceSnapshot, b: ExperienceSnapshot): boolean {
  return (
    a.activeChapter === b.activeChapter &&
    a.locked === b.locked &&
    a.layout === b.layout &&
    a.sceneStatus === b.sceneStatus &&
    a.ranges === b.ranges &&
    a.direction === b.direction
  );
}

function emitIfDiscreteChanged(previous: ExperienceSnapshot): void {
  if (discreteEqual(previous, snapshot)) return;
  for (const listener of listeners) {
    listener();
  }
}

export function getExperienceSnapshot(): ExperienceSnapshot {
  return snapshot;
}

export function getServerExperienceSnapshot(): ExperienceSnapshot {
  return INITIAL;
}

export function subscribeExperience(listener: ExperienceListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Apply scroll-derived fields. Notifies only when discrete fields change.
 * Progress / chapterProgress / velocity always update the snapshot.
 */
export function applyScrollSample(input: {
  progress: number;
  activeChapter: ChapterId;
  chapterProgress: number;
  direction: ScrollDirection;
  velocity: number;
}): void {
  const previous = snapshot;
  snapshot = {
    ...snapshot,
    progress: input.progress,
    activeChapter: input.activeChapter,
    chapterProgress: input.chapterProgress,
    direction: input.direction,
    velocity: input.velocity,
  };
  emitIfDiscreteChanged(previous);
}

export function setExperienceLocked(locked: boolean): void {
  if (snapshot.locked === locked) return;
  const previous = snapshot;
  snapshot = { ...snapshot, locked };
  emitIfDiscreteChanged(previous);
}

export function setExperienceLayout(layout: LayoutMode): void {
  if (snapshot.layout === layout) return;
  const previous = snapshot;
  snapshot = { ...snapshot, layout };
  emitIfDiscreteChanged(previous);
}

/** Publish the director's active chapter ranges (measured knots or authored). */
export function setExperienceRanges(ranges: readonly ChapterRange[]): void {
  if (snapshot.ranges === ranges) return;
  const previous = snapshot;
  snapshot = { ...snapshot, ranges };
  emitIfDiscreteChanged(previous);
}

export function setSceneStatus(sceneStatus: ExperienceSnapshot["sceneStatus"]): void {
  if (snapshot.sceneStatus === sceneStatus) return;
  const previous = snapshot;
  snapshot = { ...snapshot, sceneStatus };
  emitIfDiscreteChanged(previous);
}

/** Test / restore helper - replaces the full snapshot and always notifies. */
export function replaceExperienceSnapshot(next: ExperienceSnapshot): void {
  snapshot = { ...next };
  for (const listener of listeners) {
    listener();
  }
}

export function resetExperienceStore(): void {
  snapshot = { ...INITIAL };
  for (const listener of listeners) {
    listener();
  }
}
