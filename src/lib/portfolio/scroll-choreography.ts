"use client";

/**
 * Scroll choreography plumbing
 * ----------------------------
 * GSAP ScrollTrigger bound to the unified frame clock + Lenis. Prefer
 * depth-driven beats (world.depth) when Lenis already smooths the journey;
 * use a short pin only when a local scrub window clearly improves the beat.
 */

import type { ScrollTrigger as ScrollTriggerInstance } from "gsap/ScrollTrigger";

type ScrollTriggerStatic = typeof import("gsap/ScrollTrigger").ScrollTrigger;

export type PinnedBeatOptions = {
  trigger: string | Element;
  start?: string;
  end?: string;
  onProgress?: (progress: number) => void;
};

export type ScrubBeatOptions = {
  trigger: string | Element;
  start?: string;
  end?: string;
  /** When false (default), Lenis keeps scroll ownership — no pin. */
  pin?: boolean;
  onProgress?: (progress: number) => void;
};

let initialized = false;
let initPromise: Promise<void> | null = null;
let ScrollTriggerRef: ScrollTriggerStatic | null = null;

/**
 * Register ScrollTrigger and bind GSAP's root ticker to the unified frame
 * clock. Idempotent; SSR-safe (no window work at module top level).
 */
export function initScrollChoreography(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (initialized && ScrollTriggerRef) return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [{ default: gsap }, { ScrollTrigger }, { bindGsapToFrameClock }] = await Promise.all([
      import("gsap"),
      import("gsap/ScrollTrigger"),
      import("./frame-clock"),
    ]);
    gsap.registerPlugin(ScrollTrigger);
    ScrollTriggerRef = ScrollTrigger;
    await bindGsapToFrameClock();
    initialized = true;
  })().catch((error) => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}

export function getScrollTrigger(): ScrollTriggerStatic | null {
  return ScrollTriggerRef;
}

/**
 * Scrubbed ScrollTrigger beat. Pin is opt-in — hero→projects prefers
 * world-depth driving so Lenis stays buttery.
 */
export function createScrubBeat({
  trigger,
  start = "top top",
  end = "+=80%",
  pin = false,
  onProgress,
}: ScrubBeatOptions): () => void {
  if (typeof window === "undefined" || !ScrollTriggerRef) {
    return () => undefined;
  }

  const triggerInstance: ScrollTriggerInstance = ScrollTriggerRef.create({
    trigger,
    start,
    end,
    pin,
    scrub: true,
    onUpdate: (self) => {
      onProgress?.(self.progress);
    },
  });

  return () => {
    triggerInstance.kill();
  };
}

/**
 * Short pinned scrub beat. Prefer createScrubBeat({ pin: false }) or
 * world.depth unless a local pin clearly improves the cinematic.
 */
export function createPinnedBeat({
  trigger,
  start = "top top",
  end = "+=100%",
  onProgress,
}: PinnedBeatOptions): () => void {
  return createScrubBeat({ trigger, start, end, pin: true, onProgress });
}
