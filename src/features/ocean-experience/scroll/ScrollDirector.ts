/**
 * ScrollDirector — sole window scroll/resize listener for journey geometry.
 * Native scrolling / Lenis may still drive the scroll position; this director
 * owns coalesced sampling, chapter mapping, and water-section chrome publish.
 * Milestone 0 preserves measured world-depth visuals.
 */

import {
  type ChapterId,
  type ChapterRange,
  type LayoutMode,
  CHAPTER_ORDER,
  chapterRangesForLayout,
} from "../contracts/chapter.ts";
import {
  createViewportSize,
  type SceneDirector,
  type ViewportSize,
} from "../contracts/scene.ts";
import {
  chapterRangesFromKnots,
  ensureChapterRangesValidated,
  mapProgressToChapter,
  progressForChapterStart,
  progressFromRootScroll,
  scrollYForRootProgress,
  type RootScrollMetrics,
} from "./scroll-mapping.ts";
import {
  applyScrollSample,
  getExperienceSnapshot,
  setExperienceLayout,
  setExperienceLocked,
  setExperienceRanges,
  type ScrollDirection,
} from "../state/experience-store.ts";
import {
  invalidateWorldMeasurement,
  resolveDocumentWaterSection,
} from "../../../lib/portfolio/world-state.ts";
import {
  notifyJourneyResize,
  notifyJourneyScroll,
} from "./journey-scroll-bus.ts";
import { writeJourneyScrollY } from "./journey-scroll-writer.ts";

export type ScrollSampleListener = (sample: {
  progress: number;
  chapter: ChapterId;
  chapterProgress: number;
  direction: ScrollDirection;
  velocity: number;
  scrollY: number;
  maxScroll: number;
}) => void;

export type ScrollDirectorOptions = {
  /** Element receiving CSS journey variables (experience root). */
  root: HTMLElement;
  /** Optional scene seek sink. */
  scene?: SceneDirector | null;
  /** Mobile breakpoint max-width in CSS pixels. */
  mobileMaxWidth?: number;
  /** Override layout detection (tests). */
  getLayout?: () => LayoutMode;
  /** Override root-relative scroll metrics (tests). */
  getScrollMetrics?: () => RootScrollMetrics;
  /** Override viewport read (tests). */
  getViewport?: () => ViewportSize;
  /** Override scroll write (tests). */
  setScrollY?: (y: number) => void;
  /**
   * When true (default), publish `data-water-section` from measured world state
   * so Milestone 0 nav/chrome stay visually identical.
   */
  publishWaterSection?: boolean;
};

const CSS_PROGRESS = "--experience-progress";
const CSS_CHAPTER_PROGRESS = "--experience-chapter-progress";
const CSS_CHAPTER = "--experience-chapter";
const CSS_DIRECTION = "--experience-direction";
const CSS_VELOCITY = "--experience-velocity";

type RuntimeWindow = {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  scrollY: number;
  addEventListener: typeof window.addEventListener;
  removeEventListener: typeof window.removeEventListener;
  requestAnimationFrame: typeof window.requestAnimationFrame;
  cancelAnimationFrame: typeof window.cancelAnimationFrame;
  scrollTo: typeof window.scrollTo;
};

function runtimeWindow(): RuntimeWindow | null {
  const candidate = (globalThis as { window?: RuntimeWindow }).window;
  return candidate ?? null;
}

function defaultLayout(mobileMaxWidth: number): LayoutMode {
  const win = runtimeWindow();
  if (!win) return "desktop";
  return win.innerWidth <= mobileMaxWidth ? "mobile" : "desktop";
}

function defaultViewport(): ViewportSize {
  const win = runtimeWindow();
  if (!win) {
    return createViewportSize(0, 0, 1);
  }
  return createViewportSize(win.innerWidth, win.innerHeight, win.devicePixelRatio || 1);
}

function rootOffsetTopPx(root: HTMLElement): number {
  let offset = 0;
  let node: HTMLElement | null = root;
  while (node) {
    offset += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  return offset;
}

/**
 * Milestone 0 travel = document maxScroll so existing layout height is unchanged.
 * Later milestones may switch to authored railVh * vh.
 */
function documentAuthoredTravelPx(): number {
  const doc = (globalThis as { document?: Document }).document;
  const win = runtimeWindow();
  if (!doc || !win) return 0;
  return Math.max(doc.documentElement.scrollHeight - win.innerHeight, 0);
}

/**
 * Measured chapter anchors (§7.2): the director owns the sole mapping, and
 * knots anchor it to physical layout so copy and scene stay in the same
 * water. Missing anchors fall back to the authored normalized ranges.
 */
export const CHAPTER_ANCHOR_SELECTORS: Readonly<Record<string, string>> = {
  surface: ".hero-shell",
  descent: "#projects",
  monkeyclaw: "#project-monkeyclaw",
  etch: "#project-etch",
  flowe: "#project-flowe",
  argyph: "#project-argyph",
  "charted-work": "#charted-work",
  about: "#about",
  contact: "#contact",
};

const CHAPTER_ANCHOR_HASHES: readonly string[] = [
  "#top",
  "#projects",
  "#project-monkeyclaw",
  "#project-etch",
  "#project-flowe",
  "#project-argyph",
  "#projects",
  "#about",
  "#contact",
];

/**
 * Per-chapter knot offsets (in viewport heights). Sticky encounter stages
 * release one viewport before the next article's top, so handoff chapters
 * flip mid-handoff. Structural chapters anchor where their content becomes
 * dominant. Offsets must keep knots strictly monotonic.
 */
const ENCOUNTER_KNOT_OFFSET_VIEWPORTS: Readonly<Record<string, number>> = {
  surface: 0,
  descent: 0,
  monkeyclaw: 0,
  // Etch begins during the last third of the incoming handoff. Intent can
  // assemble before the pin, then hold on a complete frame long enough to be
  // read; starting a full viewport early made its only Intent frame cropped.
  etch: -0.35,
  flowe: -1,
  argyph: -1,
  "charted-work": -1,
  about: -0.5,
  contact: -1,
};

function measureChapterKnots(
  metrics: RootScrollMetrics,
  viewportHeight: number,
): readonly ChapterRange[] | null {
  const doc = (globalThis as { document?: Document }).document;
  if (!doc || metrics.authoredTravelPx <= 0) return null;
  const knots: number[] = [];
  for (const id of CHAPTER_ORDER) {
    const selector = CHAPTER_ANCHOR_SELECTORS[id];
    const element = selector ? doc.querySelector<HTMLElement>(selector) : null;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const offset = (ENCOUNTER_KNOT_OFFSET_VIEWPORTS[id] ?? 0) * viewportHeight;
    const y = rect.top + metrics.scrollY + offset;
    knots.push((y - metrics.rootOffsetTop) / metrics.authoredTravelPx);
  }
  const docEnd = metrics.rootOffsetTop + metrics.authoredTravelPx;
  knots.push((docEnd - metrics.rootOffsetTop) / metrics.authoredTravelPx);
  return chapterRangesFromKnots(knots, CHAPTER_ANCHOR_HASHES);
}

function defaultRootMetrics(root: HTMLElement): RootScrollMetrics {
  const win = runtimeWindow();
  const doc = (globalThis as { document?: Document }).document;
  const scrollY = win
    ? win.scrollY || doc?.documentElement.scrollTop || 0
    : 0;
  return {
    scrollY,
    rootOffsetTop: rootOffsetTopPx(root),
    authoredTravelPx: documentAuthoredTravelPx(),
  };
}

function viewportChanged(a: ViewportSize, b: ViewportSize): boolean {
  return a.width !== b.width || a.height !== b.height || a.dpr !== b.dpr;
}

export class ScrollDirector {
  private readonly root: HTMLElement;
  private readonly mobileMaxWidth: number;
  private readonly getLayoutFn: () => LayoutMode;
  private readonly getScrollMetricsFn: () => RootScrollMetrics;
  private readonly getViewportFn: () => ViewportSize;
  private readonly setScrollYFn: (y: number) => void;
  private readonly publishWaterSection: boolean;
  private scene: SceneDirector | null;

  private attached = false;
  private rafId: number | null = null;
  private dirty = false;
  private lastScrollY = 0;
  private lastTimestamp = 0;
  private lastProgress = 0;
  private seeking = false;
  private lastViewport: ViewportSize | null = null;
  private cachedRanges: readonly ChapterRange[] | null = null;
  private cachedLayout: LayoutMode | null = null;
  private knotCacheKey = "";
  private knotRanges: readonly ChapterRange[] | null = null;
  private publishedRanges: readonly ChapterRange[] | null = null;
  private pendingResizeNotify = false;
  private readonly sampleListeners = new Set<ScrollSampleListener>();

  constructor(options: ScrollDirectorOptions) {
    this.root = options.root;
    this.mobileMaxWidth = options.mobileMaxWidth ?? 767;
    this.publishWaterSection = options.publishWaterSection !== false;
    this.getLayoutFn = options.getLayout ?? (() => defaultLayout(this.mobileMaxWidth));
    this.getViewportFn = options.getViewport ?? defaultViewport;
    this.getScrollMetricsFn =
      options.getScrollMetrics ?? (() => defaultRootMetrics(this.root));
    this.setScrollYFn = options.setScrollY ?? writeJourneyScrollY;
    this.scene = options.scene ?? null;
  }

  setScene(scene: SceneDirector | null): void {
    this.scene = scene;
  }

  /** Subscribe to coalesced samples (e.g. native liquid scroll emit). */
  subscribeSample(listener: ScrollSampleListener): () => void {
    this.sampleListeners.add(listener);
    return () => {
      this.sampleListeners.delete(listener);
    };
  }

  attach(): void {
    const win = runtimeWindow();
    if (this.attached || !win) return;
    this.attached = true;
    this.lastTimestamp = performance.now();
    const metrics = this.getScrollMetricsFn();
    this.lastScrollY = metrics.scrollY;
    win.addEventListener("scroll", this.onScroll, { passive: true });
    win.addEventListener("resize", this.onResize, { passive: true });
    this.syncSceneResize(true);
    this.sample(true);
  }

  detach(): void {
    const win = runtimeWindow();
    if (!this.attached || !win) return;
    this.attached = false;
    win.removeEventListener("scroll", this.onScroll);
    win.removeEventListener("resize", this.onResize);
    if (this.rafId !== null) {
      win.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.dirty = false;
  }

  dispose(): void {
    this.detach();
    this.scene = null;
    this.lastViewport = null;
    this.cachedRanges = null;
    this.cachedLayout = null;
    this.sampleListeners.clear();
    if (this.publishWaterSection && typeof document !== "undefined") {
      delete document.documentElement.dataset.waterSection;
      delete document.documentElement.dataset.experienceChapter;
    }
  }

  getState() {
    return getExperienceSnapshot();
  }

  /** Force a coalesced sample without changing scroll position. */
  requestSample(): void {
    if (!this.attached) return;
    this.schedule();
  }

  setLocked(locked: boolean): void {
    setExperienceLocked(locked);
  }

  /** Imperative seek — updates scroll position and store deterministically. */
  seek(progress: number): void {
    const layout = this.getLayoutFn();
    setExperienceLayout(layout);
    const metrics = this.getScrollMetricsFn();
    const y = scrollYForRootProgress(
      progress,
      metrics.rootOffsetTop,
      metrics.authoredTravelPx,
    );
    this.seeking = true;
    this.setScrollYFn(y);
    this.sample(true);
    this.seeking = false;
  }

  seekChapter(id: ChapterId): void {
    const layout = this.getLayoutFn();
    const ranges = this.rangesForLayout(layout, this.getScrollMetricsFn());
    const progress = progressForChapterStart(id, ranges);
    this.seek(progress);
  }

  private authoredRangesForLayout(layout: LayoutMode): readonly ChapterRange[] {
    if (this.cachedLayout === layout && this.cachedRanges) {
      return this.cachedRanges;
    }
    const ranges = chapterRangesForLayout(layout);
    ensureChapterRangesValidated(ranges);
    this.cachedRanges = ranges;
    this.cachedLayout = layout;
    return ranges;
  }

  /**
   * Active ranges: measured DOM knots when the homepage anchors exist,
   * authored normalized ranges otherwise (case routes, missing content).
   */
  private rangesForLayout(layout: LayoutMode, metrics?: RootScrollMetrics): readonly ChapterRange[] {
    const authored = this.authoredRangesForLayout(layout);
    const sample = metrics ?? this.getScrollMetricsFn();
    const doc = (globalThis as { document?: Document }).document;
    const viewportHeight = this.getViewportFn().height;
    const cacheKey = doc
      ? `${layout}:${doc.documentElement.scrollHeight}:${Math.round(sample.authoredTravelPx)}:${Math.round(viewportHeight)}`
      : "";
    if (cacheKey && this.knotCacheKey !== cacheKey) {
      this.knotCacheKey = cacheKey;
      this.knotRanges = measureChapterKnots(sample, viewportHeight);
    }
    const ranges = this.knotRanges ?? authored;
    if (this.publishedRanges !== ranges) {
      this.publishedRanges = ranges;
      setExperienceRanges(ranges);
    }
    return ranges;
  }

  /**
   * Resize the scene only when width/height/DPR actually change.
   * Called on attach and from the single resize listener — never from scroll samples.
   */
  private syncSceneResize(force: boolean): void {
    const next = this.getViewportFn();
    if (!force && this.lastViewport && !viewportChanged(this.lastViewport, next)) {
      return;
    }
    this.lastViewport = next;
    invalidateWorldMeasurement();
    this.scene?.resize(next);
  }

  private readonly onScroll = (): void => {
    if (!this.attached) return;
    if (getExperienceSnapshot().locked && !this.seeking) return;
    this.schedule();
  };

  private readonly onResize = (): void => {
    if (!this.attached) return;
    this.syncSceneResize(false);
    // Coalesce sample first so consumers observe committed journey state.
    this.schedule({ alsoNotifyResize: true });
  };

  private schedule(options: { alsoNotifyResize?: boolean } = {}): void {
    const win = runtimeWindow();
    if (!win) return;
    this.dirty = true;
    if (options.alsoNotifyResize) this.pendingResizeNotify = true;
    if (this.rafId !== null) return;
    this.rafId = win.requestAnimationFrame((time) => {
      this.rafId = null;
      if (!this.dirty) return;
      this.dirty = false;
      const notifyResize = this.pendingResizeNotify;
      this.pendingResizeNotify = false;
      this.sample(false, time);
      notifyJourneyScroll();
      if (notifyResize) notifyJourneyResize();
    });
  }

  private sample(force: boolean, timestamp = performance.now()): void {
    const layout = this.getLayoutFn();
    setExperienceLayout(layout);

    const metrics = this.getScrollMetricsFn();
    const progress = progressFromRootScroll(metrics);
    const mapped = mapProgressToChapter(progress, this.rangesForLayout(layout, metrics));

    const dtSeconds = Math.max((timestamp - this.lastTimestamp) / 1000, 1 / 240);
    const dy = metrics.scrollY - this.lastScrollY;
    const velocity = dy / dtSeconds;
    let direction: ScrollDirection = 0;
    if (dy > 0.5) direction = 1;
    else if (dy < -0.5) direction = -1;
    else if (progress > this.lastProgress + 1e-6) direction = 1;
    else if (progress < this.lastProgress - 1e-6) direction = -1;

    applyScrollSample({
      progress,
      activeChapter: mapped.activeChapter,
      chapterProgress: mapped.chapterProgress,
      direction,
      velocity,
    });

    this.writeCss(
      progress,
      mapped.chapterProgress,
      mapped.activeChapter,
      direction,
      velocity,
      layout,
    );

    if (this.publishWaterSection && typeof document !== "undefined") {
      document.documentElement.dataset.waterSection = resolveDocumentWaterSection();
      document.documentElement.dataset.experienceChapter = mapped.activeChapter;
    }

    const deltaSeconds = force ? 0 : dtSeconds;
    this.scene?.seek(progress, deltaSeconds);

    if (this.sampleListeners.size > 0) {
      const payload = {
        progress,
        chapter: mapped.activeChapter,
        chapterProgress: mapped.chapterProgress,
        direction,
        velocity,
        scrollY: metrics.scrollY,
        maxScroll: metrics.authoredTravelPx,
      };
      for (const listener of this.sampleListeners) {
        listener(payload);
      }
    }

    this.lastScrollY = metrics.scrollY;
    this.lastTimestamp = timestamp;
    this.lastProgress = progress;

    // Force path (attach/seek): notify only after sample state is fully committed.
    if (force) {
      notifyJourneyScroll();
    }
  }

  private writeCss(
    progress: number,
    chapterProgress: number,
    chapter: ChapterId,
    direction: ScrollDirection,
    velocity: number,
    layout: LayoutMode,
  ): void {
    this.root.style.setProperty(CSS_PROGRESS, progress.toFixed(5));
    this.root.style.setProperty(CSS_CHAPTER_PROGRESS, chapterProgress.toFixed(5));
    this.root.style.setProperty(CSS_CHAPTER, chapter);
    this.root.style.setProperty(CSS_DIRECTION, String(direction));
    this.root.style.setProperty(CSS_VELOCITY, velocity.toFixed(2));
    this.root.dataset.experienceChapter = chapter;
    this.root.dataset.experienceLayout = layout;
  }
}

export function createScrollDirector(options: ScrollDirectorOptions): ScrollDirector {
  return new ScrollDirector(options);
}
