/**
 * MotionPolicy — single live source of truth for site + OS motion gates.
 * Used by arrivals, liquid emissions, sound, choreography, and UI effects.
 */

export type MotionPolicy = {
  /** OS prefers-reduced-motion */
  osReducedMotion: boolean;
  /** Site motion toggle (`data-motion` on `.portfolio-root`) */
  siteMotionEnabled: boolean;
  /** Transform / depth / float effects may run */
  effectsAllowed: boolean;
  /** Liquid presses / wakes / scroll emissions may fire */
  liquidAllowed: boolean;
  /** WebAudio bed and ticks may play (still requires user sound enable) */
  soundAllowed: boolean;
  /** GSAP / Lenis / scroll-beat choreography may run */
  choreographyAllowed: boolean;
};

const DEFAULT_POLICY: MotionPolicy = {
  osReducedMotion: false,
  siteMotionEnabled: true,
  effectsAllowed: true,
  liquidAllowed: true,
  soundAllowed: true,
  choreographyAllowed: true,
};

function readSiteMotionEnabled(): boolean {
  if (typeof document === "undefined") return true;
  const root = document.querySelector(".portfolio-root");
  if (!root) return true;
  return root.getAttribute("data-motion") !== "off";
}

function readOsReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Build a MotionPolicy from explicit flags (React context / tests). */
export function createMotionPolicy(input: {
  osReducedMotion: boolean;
  siteMotionEnabled: boolean;
}): MotionPolicy {
  const allowed = !input.osReducedMotion && input.siteMotionEnabled;
  return {
    osReducedMotion: input.osReducedMotion,
    siteMotionEnabled: input.siteMotionEnabled,
    effectsAllowed: allowed,
    liquidAllowed: allowed,
    soundAllowed: allowed,
    choreographyAllowed: allowed,
  };
}

/** Live DOM/OS snapshot — prefer this outside React. */
export function readMotionPolicy(): MotionPolicy {
  if (typeof window === "undefined") return DEFAULT_POLICY;
  return createMotionPolicy({
    osReducedMotion: readOsReducedMotion(),
    siteMotionEnabled: readSiteMotionEnabled(),
  });
}

/** Subscribe to OS + site motion changes. Returns unsubscribe. */
export function subscribeMotionPolicy(
  onChange: (policy: MotionPolicy) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const emit = () => onChange(readMotionPolicy());
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  const onMedia = () => emit();
  media.addEventListener("change", onMedia);

  const root = document.querySelector(".portfolio-root");
  const observer = root
    ? new MutationObserver(emit)
    : null;
  observer?.observe(root!, { attributes: true, attributeFilter: ["data-motion"] });

  emit();
  return () => {
    media.removeEventListener("change", onMedia);
    observer?.disconnect();
  };
}
