"use client";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    finished?: Promise<void>;
  };
};

type ProjectNavigationOptions = {
  motionEnabled: boolean;
  navigate: () => void;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasPersistedMotionOptOut() {
  return typeof window !== "undefined" && window.localStorage.getItem("portfolio-motion") === "off";
}

function getStartViewTransition() {
  if (typeof document === "undefined") return undefined;
  const transitionDocument = document as ViewTransitionDocument;
  return transitionDocument.startViewTransition;
}

export function canUseProjectViewTransition(motionEnabled: boolean) {
  if (!motionEnabled || prefersReducedMotion() || hasPersistedMotionOptOut()) return false;
  const quality = document.querySelector<HTMLElement>(".fluid-canvas")?.dataset.quality;
  if (quality === "low" || quality === "static") return false;
  return Boolean(getStartViewTransition());
}

/**
 * Runs a short internal project transition when the browser and the site's
 * motion policy allow it. Every caller keeps a normal client-navigation path.
 */
export function navigateWithProjectTransition({
  motionEnabled,
  navigate,
}: ProjectNavigationOptions) {
  if (!canUseProjectViewTransition(motionEnabled)) {
    navigate();
    return;
  }

  const startViewTransition = getStartViewTransition();
  if (!startViewTransition) {
    navigate();
    return;
  }

  try {
    const transition = startViewTransition.call(document, navigate);
    void transition?.finished?.catch(() => undefined);
  } catch {
    navigate();
  }
}
