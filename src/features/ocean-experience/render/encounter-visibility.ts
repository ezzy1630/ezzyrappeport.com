/**
 * Pure journey-progress → encounter visibility tables.
 *
 * Fast scroll, scrollbar drags, and chapter jumps all land on the exact same
 * swept state: visibility is a total function of progress, never of elapsed
 * time or traversal history.
 */

import {
  type ChapterId,
  type ChapterRange,
  type LayoutMode,
  chapterRangesForLayout,
} from "../contracts/chapter.ts";
import { clamp01 } from "../scroll/scroll-mapping.ts";

export type EncounterWindow = {
  id: ChapterId;
  /** Chapter range edges (chapterProgress is a pure function of these). */
  rangeStart: number;
  rangeEnd: number;
  /** Journey progress where the encounter starts fading in. */
  fadeInStart: number;
  /** Journey progress where the encounter reaches full visibility. */
  fadeInEnd: number;
  /** Journey progress where the encounter starts fading out. */
  fadeOutStart: number;
  /** Journey progress where the encounter is fully gone. */
  fadeOutEnd: number;
  /** Journey progress that triggers preload (before fade-in). */
  preloadStart: number;
  /** Journey progress past which the module may be evicted. */
  evictAfter: number;
};

/** Journey-distance margins around each chapter range. */
export const ENCOUNTER_WINDOW_MARGINS = {
  fade: 0.028,
  preload: 0.06,
  /** Eviction once two chapter boundaries have passed (§16.5). */
  evictChapters: 2,
} as const;

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Anchor chapters that host 3D encounters (Charted Work stays a DOM map). */
export const ENCOUNTER_CHAPTERS: readonly ChapterId[] = [
  "monkeyclaw",
  "etch",
  "flowe",
  "argyph",
] as const;

export function isEncounterChapter(id: ChapterId): boolean {
  return (ENCOUNTER_CHAPTERS as readonly string[]).includes(id);
}

export function encounterWindowFor(
  id: ChapterId,
  ranges: readonly ChapterRange[],
): EncounterWindow {
  const index = ranges.findIndex((range) => range.id === id);
  if (index < 0) {
    throw new Error(`Unknown encounter chapter: ${id}`);
  }
  const range = ranges[index];
  const fade = ENCOUNTER_WINDOW_MARGINS.fade;
  const evictIndex = Math.min(
    ranges.length - 1,
    index + ENCOUNTER_WINDOW_MARGINS.evictChapters,
  );
  return {
    id,
    rangeStart: range.start,
    rangeEnd: range.end,
    fadeInStart: Math.max(0, range.start - fade),
    fadeInEnd: range.start + fade,
    fadeOutStart: range.end - fade,
    fadeOutEnd: Math.min(1, range.end + fade),
    preloadStart: Math.max(0, range.start - ENCOUNTER_WINDOW_MARGINS.preload),
    evictAfter: ranges[evictIndex].end,
  };
}

export function encounterWindowsForLayout(
  layout: LayoutMode,
): readonly EncounterWindow[] {
  const ranges = chapterRangesForLayout(layout);
  return ENCOUNTER_CHAPTERS.map((id) => encounterWindowFor(id, ranges));
}

export type EncounterVisibility = {
  id: ChapterId;
  /** 0 = hidden, 1 = fully visible. */
  fade: number;
  /** Local chapter progress swept from the window range in [0, 1]. */
  chapterProgress: number;
  /** Inside the active chapter range (chapterProgress meaningful). */
  active: boolean;
  shouldPreload: boolean;
  shouldEvict: boolean;
};

/** Swept visibility for one window at one progress sample. */
export function visibilityForWindow(
  window: EncounterWindow,
  progress: number,
): EncounterVisibility {
  const p = clamp01(progress);
  let fade = 0;
  if (p >= window.fadeInStart && p < window.fadeInEnd) {
    fade = smoothstep01((p - window.fadeInStart) / Math.max(window.fadeInEnd - window.fadeInStart, 1e-9));
  } else if (p >= window.fadeInEnd && p <= window.fadeOutStart) {
    fade = 1;
  } else if (p > window.fadeOutStart && p <= window.fadeOutEnd) {
    fade = 1 - smoothstep01((p - window.fadeOutStart) / Math.max(window.fadeOutEnd - window.fadeOutStart, 1e-9));
  }
  const chapterProgress = clamp01(
    (p - window.rangeStart) / Math.max(window.rangeEnd - window.rangeStart, 1e-9),
  );
  return {
    id: window.id,
    fade,
    chapterProgress,
    active: p >= window.fadeInStart && p <= window.fadeOutEnd,
    shouldPreload: p >= window.preloadStart && p <= window.evictAfter,
    shouldEvict: p > window.evictAfter || p < window.preloadStart,
  };
}

/**
 * Swept table for every encounter at one progress sample. Allocation-free
 * into `out` when provided (hot path); returns the same array.
 */
export function visibilityTable(
  windows: readonly EncounterWindow[],
  progress: number,
  out?: EncounterVisibility[],
): EncounterVisibility[] {
  const table = out ?? [];
  for (let index = 0; index < windows.length; index += 1) {
    const next = visibilityForWindow(windows[index], progress);
    if (table[index]) {
      table[index].fade = next.fade;
      table[index].chapterProgress = next.chapterProgress;
      table[index].active = next.active;
      table[index].shouldPreload = next.shouldPreload;
      table[index].shouldEvict = next.shouldEvict;
    } else {
      table[index] = next;
    }
  }
  table.length = windows.length;
  return table;
}
