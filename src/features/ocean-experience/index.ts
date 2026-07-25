/**
 * Ocean experience feature boundary — Milestone 0 foundation exports.
 */

export type { ChapterId, ChapterRange, LayoutMode } from "./contracts/chapter.ts";
export {
  CHAPTER_ORDER,
  CHAPTERS,
  DESKTOP_CHAPTER_RANGES,
  MOBILE_CHAPTER_RANGES,
  chapterIdFromHash,
  chapterRangesForLayout,
  isChapterId,
  waterSectionForChapter,
} from "./contracts/chapter.ts";

export type { ExperiencePreferences, QualityPreference } from "./contracts/preferences.ts";
export type { ResolvedQuality, QualityTier } from "./contracts/quality.ts";
export type { LoadContext, SceneDirector, ViewportSize } from "./contracts/scene.ts";

export {
  clamp01,
  mapProgressToChapter,
  mapProgressForLayout,
  progressFromRootScroll,
  progressForChapterStart,
  scrollYForRootProgress,
  validateChapterRanges,
} from "./scroll/scroll-mapping.ts";
export { createScrollDirector, ScrollDirector } from "./scroll/ScrollDirector.ts";
export { resolveInputShaping, shapeScrollDelta } from "./scroll/input-shaping-policy.ts";
export {
  subscribeJourneyScroll,
  subscribeJourneyResize,
} from "./scroll/journey-scroll-bus.ts";

export {
  getExperienceSnapshot,
  subscribeExperience,
  applyScrollSample,
  resetExperienceStore,
} from "./state/experience-store.ts";
export {
  getPreferencesSnapshot,
  hydratePreferencesStore,
  setPreferences,
  shouldUseSimpleStory,
} from "./state/preferences-store.ts";

export { createFrameFaultPolicy } from "./runtime/frame-fault-policy.ts";
export { createResourceRegistry, ResourceRegistry } from "./runtime/resource-registry.ts";
export {
  createExperienceRuntime,
  createBrowserExperienceFrameClock,
  ExperienceRuntime,
} from "./runtime/ExperienceRuntime.ts";
export { createNullSceneDirector, NullSceneDirector } from "./runtime/NullSceneDirector.ts";

export { FrameMsRingBuffer } from "./diagnostics/frame-stats.ts";
export { installExperienceDebugApi } from "./diagnostics/experience-debug.ts";
export { shouldInterceptChapterHashClick } from "./navigation/chapter-hash-click.ts";

export { getActiveScrollDirector } from "./OceanExperienceBridge.tsx";
export { default as OceanExperienceBridge } from "./OceanExperienceBridge.tsx";
