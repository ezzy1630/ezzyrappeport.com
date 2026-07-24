/**
 * Cached element geometry for high-cadence pointer subscribers.
 * Invalidate via ResizeObserver / visibility — never measure every tick.
 */

export type CachedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
};

export type GeometryCacheHandle = {
  /** Latest rect, or null when offscreen / unmeasured */
  getRect: () => CachedRect | null;
  /** True when the element intersects an expanded viewport */
  isNearViewport: () => boolean;
  dispose: () => void;
};

function toCached(rect: DOMRectReadOnly): CachedRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right,
    bottom: rect.bottom,
    cx: rect.left + rect.width * 0.5,
    cy: rect.top + rect.height * 0.5,
  };
}

/**
 * Observe an element and keep a rect cache. Skips measurement while far
 * offscreen (margin). Call getRect() from pointer publishers instead of
 * getBoundingClientRect().
 */
export function createGeometryCache(
  element: HTMLElement,
  options: { marginPx?: number } = {},
): GeometryCacheHandle {
  const marginPx = options.marginPx ?? 120;
  let cached: CachedRect | null = null;
  let nearViewport = false;
  let disposed = false;
  let measureFrame = 0;

  const measure = () => {
    if (disposed) return;
    measureFrame = 0;
    if (!nearViewport) {
      cached = null;
      return;
    }
    cached = toCached(element.getBoundingClientRect());
  };

  const scheduleMeasure = () => {
    if (disposed || measureFrame) return;
    measureFrame = window.requestAnimationFrame(measure);
  };

  const visibilityObserver = typeof IntersectionObserver === "undefined"
    ? null
    : new IntersectionObserver(
      (entries) => {
        nearViewport = entries.some((entry) => entry.isIntersecting);
        if (nearViewport) scheduleMeasure();
        else cached = null;
      },
      { rootMargin: `${marginPx}px 0px ${marginPx}px 0px` },
    );

  visibilityObserver?.observe(element);

  const resizeObserver = typeof ResizeObserver === "undefined"
    ? null
    : new ResizeObserver(() => {
      if (nearViewport) scheduleMeasure();
    });
  resizeObserver?.observe(element);

  const onScrollOrResize = () => {
    if (nearViewport) scheduleMeasure();
  };
  window.addEventListener("scroll", onScrollOrResize, { passive: true });
  window.addEventListener("resize", onScrollOrResize, { passive: true });

  // Seed: if IO is missing, treat as near and measure once.
  if (!visibilityObserver) {
    nearViewport = true;
    measure();
  } else {
    // Synchronous first paint may precede IO callback — measure once if visible.
    const seed = element.getBoundingClientRect();
    nearViewport = seed.bottom >= -marginPx && seed.top <= window.innerHeight + marginPx;
    if (nearViewport) cached = toCached(seed);
  }

  return {
    getRect: () => (nearViewport ? cached : null),
    isNearViewport: () => nearViewport,
    dispose: () => {
      disposed = true;
      if (measureFrame) window.cancelAnimationFrame(measureFrame);
      visibilityObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      cached = null;
    },
  };
}
