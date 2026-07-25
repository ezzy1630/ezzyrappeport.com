/**
 * Journey scroll ownership bus.
 * ScrollDirector is the sole window scroll/resize listener for journey geometry.
 * Secondary consumers subscribe here instead of attaching competing listeners.
 */

export type JourneyScrollListener = () => void;

const scrollListeners = new Set<JourneyScrollListener>();
const resizeListeners = new Set<JourneyScrollListener>();

/** Subscribe to coalesced document scroll samples owned by ScrollDirector. */
export function subscribeJourneyScroll(listener: JourneyScrollListener): () => void {
  scrollListeners.add(listener);
  return () => {
    scrollListeners.delete(listener);
  };
}

/** Subscribe to viewport resize owned by ScrollDirector. */
export function subscribeJourneyResize(listener: JourneyScrollListener): () => void {
  resizeListeners.add(listener);
  return () => {
    resizeListeners.delete(listener);
  };
}

/** Invoked only by ScrollDirector after a scroll sample is scheduled/taken. */
export function notifyJourneyScroll(): void {
  for (const listener of scrollListeners) {
    try {
      listener();
    } catch {
      // Consumer faults must not break the sole owner.
    }
  }
}

/** Invoked only by ScrollDirector from its resize listener. */
export function notifyJourneyResize(): void {
  for (const listener of resizeListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

/** Test/diagnostic: active secondary consumer counts. */
export function journeyScrollListenerCount(): number {
  return scrollListeners.size;
}

export function journeyResizeListenerCount(): number {
  return resizeListeners.size;
}

/** Test helper. */
export function resetJourneyScrollBus(): void {
  scrollListeners.clear();
  resizeListeners.clear();
}
