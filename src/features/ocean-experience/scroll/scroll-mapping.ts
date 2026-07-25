/**
 * Pure deterministic scroll <-> chapter mappings.
 * seek(0.57), reverse scroll, and hash jumps must yield the same chapter state.
 */

import {
  type ChapterId,
  type ChapterRange,
  type LayoutMode,
  CHAPTER_ORDER,
  chapterRangesForLayout,
  railVhForLayout,
} from "../contracts/chapter.ts";

export type MappedChapterState = {
  activeChapter: ChapterId;
  chapterProgress: number;
  chapterIndex: number;
  range: ChapterRange;
};

/** Root-relative scroll metrics for camera progress. */
export type RootScrollMetrics = {
  scrollY: number;
  /** Document Y where the experience root begins. */
  rootOffsetTop: number;
  /**
   * Exact authored travel in CSS pixels.
   * Milestone 0 uses document maxScroll; later milestones may use railVh * vh.
   */
  authoredTravelPx: number;
};

const EPSILON = 1e-9;

/** Validate each ranges object identity once; retain strong public validateChapterRanges. */
const validatedRanges = new WeakSet<object>();

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * Validate authored ranges: coverage of [0, 1], monotonicity, no gaps/overlaps,
 * chapter order matches CHAPTER_ORDER.
 */
export function validateChapterRanges(ranges: readonly ChapterRange[]): void {
  if (ranges.length === 0) {
    throw new Error("Chapter ranges must be non-empty");
  }
  if (ranges.length !== CHAPTER_ORDER.length) {
    throw new Error(
      `Expected ${CHAPTER_ORDER.length} chapter ranges, got ${ranges.length}`,
    );
  }

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const expectedId = CHAPTER_ORDER[index];
    if (range.id !== expectedId) {
      throw new Error(
        `Range order mismatch at ${index}: expected ${expectedId}, got ${range.id}`,
      );
    }
    if (!(range.start < range.end)) {
      throw new Error(`Invalid range for ${range.id}: start must be < end`);
    }
    if (range.start < -EPSILON || range.end > 1 + EPSILON) {
      throw new Error(`Range for ${range.id} escapes [0, 1]`);
    }
  }

  if (Math.abs(ranges[0].start - 0) > EPSILON) {
    throw new Error("First chapter must start at 0");
  }
  if (Math.abs(ranges[ranges.length - 1].end - 1) > EPSILON) {
    throw new Error("Last chapter must end at 1");
  }

  for (let index = 1; index < ranges.length; index += 1) {
    const previous = ranges[index - 1];
    const current = ranges[index];
    if (Math.abs(previous.end - current.start) > EPSILON) {
      throw new Error(
        `Gap or overlap between ${previous.id} and ${current.id}: ${previous.end} → ${current.start}`,
      );
    }
    if (current.start < previous.start - EPSILON) {
      throw new Error(`Non-monotonic chapter starts at ${current.id}`);
    }
  }
}

/** Hot-path gate: validate a ranges table once per object identity. */
export function ensureChapterRangesValidated(ranges: readonly ChapterRange[]): void {
  if (validatedRanges.has(ranges as object)) return;
  validateChapterRanges(ranges);
  validatedRanges.add(ranges as object);
}

/** Authored scroll travel in CSS pixels for a viewport height. */
export function authoredTravelPx(railVh: number, viewportHeight: number): number {
  const vh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  const rail = Number.isFinite(railVh) && railVh > 0 ? railVh : 0;
  return (rail / 100) * vh;
}

/**
 * Root layout height in CSS pixels: authored travel plus one terminal viewport
 * so maxScroll through the root equals authored travel.
 */
export function rootLayoutHeightPx(railVh: number, viewportHeight: number): number {
  const vh = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  return authoredTravelPx(railVh, vh) + vh;
}

/** Chapter physical height in vh units from authored range + rail. */
export function chapterPhysicalSpanVh(range: ChapterRange, railVh: number): number {
  return (range.end - range.start) * railVh;
}

/** Sum of chapter physical spans; must equal railVh for a valid table. */
export function totalChapterPhysicalSpanVh(
  ranges: readonly ChapterRange[],
  railVh: number,
): number {
  let total = 0;
  for (const range of ranges) {
    total += chapterPhysicalSpanVh(range, railVh);
  }
  return total;
}

export function chapterPhysicalSpansForLayout(layout: LayoutMode): Readonly<
  Record<ChapterId, number>
> {
  const ranges = chapterRangesForLayout(layout);
  const railVh = railVhForLayout(layout);
  ensureChapterRangesValidated(ranges);
  const spans = {} as Record<ChapterId, number>;
  for (const range of ranges) {
    spans[range.id] = chapterPhysicalSpanVh(range, railVh);
  }
  return spans;
}

/**
 * Normalized progress relative to the experience root/rail, not competing
 * DOM-derived world depth. scrollY past the authored window clamps to 1.
 */
export function progressFromRootScroll(metrics: RootScrollMetrics): number {
  const localY = metrics.scrollY - metrics.rootOffsetTop;
  return progressFromScrollY(localY, metrics.authoredTravelPx);
}

export function scrollYForRootProgress(
  progress: number,
  rootOffsetTop: number,
  authoredTravelPxValue: number,
): number {
  return rootOffsetTop + scrollYForProgress(progress, authoredTravelPxValue);
}

export function mapProgressToChapter(
  progress: number,
  ranges: readonly ChapterRange[],
): MappedChapterState {
  ensureChapterRangesValidated(ranges);
  const p = clamp01(progress);

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const isLast = index === ranges.length - 1;
    const inside = isLast
      ? p >= range.start - EPSILON && p <= range.end + EPSILON
      : p >= range.start - EPSILON && p < range.end - EPSILON;

    if (!inside) continue;

    const span = Math.max(range.end - range.start, EPSILON);
    const local = clamp01((p - range.start) / span);
    return {
      activeChapter: range.id,
      chapterProgress: local,
      chapterIndex: index,
      range,
    };
  }

  // Total function fallback: clamp to final chapter.
  const lastIndex = ranges.length - 1;
  const last = ranges[lastIndex];
  return {
    activeChapter: last.id,
    chapterProgress: 1,
    chapterIndex: lastIndex,
    range: last,
  };
}

export function mapProgressForLayout(
  progress: number,
  layout: LayoutMode,
): MappedChapterState {
  return mapProgressToChapter(progress, chapterRangesForLayout(layout));
}

/** Canonical progress for entering a chapter (start edge). */
export function progressForChapterStart(
  id: ChapterId,
  ranges: readonly ChapterRange[],
): number {
  ensureChapterRangesValidated(ranges);
  const range = ranges.find((candidate) => candidate.id === id);
  if (!range) {
    throw new Error(`Unknown chapter id: ${id}`);
  }
  return clamp01(range.start);
}

/** Midpoint progress inside a chapter (useful for restoration samples). */
export function progressForChapterMid(
  id: ChapterId,
  ranges: readonly ChapterRange[],
): number {
  ensureChapterRangesValidated(ranges);
  const range = ranges.find((candidate) => candidate.id === id);
  if (!range) {
    throw new Error(`Unknown chapter id: ${id}`);
  }
  return clamp01((range.start + range.end) / 2);
}

/**
 * Document scrollY for a normalized journey progress given scroll metrics.
 * Prefer scrollYForRootProgress for experience-root seeks.
 */
export function scrollYForProgress(progress: number, maxScroll: number): number {
  const p = clamp01(progress);
  const max = Number.isFinite(maxScroll) && maxScroll > 0 ? maxScroll : 0;
  return p * max;
}

export function progressFromScrollY(scrollY: number, maxScroll: number): number {
  const max = Number.isFinite(maxScroll) && maxScroll > 0 ? maxScroll : 0;
  if (max <= 0) return 0;
  return clamp01(scrollY / max);
}

/** Validate both layout tables at module evaluation for fail-fast contracts. */
export function assertAuthoredMappingsValid(): void {
  validateChapterRanges(chapterRangesForLayout("desktop"));
  validateChapterRanges(chapterRangesForLayout("mobile"));
  const desktopTotal = totalChapterPhysicalSpanVh(
    chapterRangesForLayout("desktop"),
    railVhForLayout("desktop"),
  );
  const mobileTotal = totalChapterPhysicalSpanVh(
    chapterRangesForLayout("mobile"),
    railVhForLayout("mobile"),
  );
  if (Math.abs(desktopTotal - railVhForLayout("desktop")) > EPSILON) {
    throw new Error(`Desktop chapter spans must sum to rail VH (got ${desktopTotal})`);
  }
  if (Math.abs(mobileTotal - railVhForLayout("mobile")) > EPSILON) {
    throw new Error(`Mobile chapter spans must sum to rail VH (got ${mobileTotal})`);
  }
}

assertAuthoredMappingsValid();
