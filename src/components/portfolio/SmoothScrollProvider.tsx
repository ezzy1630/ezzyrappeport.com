"use client";

import { useEffect } from "react";
import { subscribeFrameClock, unsubscribeFrameClock } from "@/lib/portfolio/frame-clock";
import { emitLiquidScroll } from "@/lib/portfolio/liquid-interaction";
import {
  getScrollTrigger,
  initScrollChoreography,
} from "@/lib/portfolio/scroll-choreography";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

const SCROLL_CLOCK_ID = "smooth-scroll-lenis";

function emitFromNativeScroll(last: { y: number; time: number; velocity: number }) {
  if (!readMotionPolicy().liquidAllowed) return;
  const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const now = performance.now();
  const y = window.scrollY;
  const dt = Math.max(8, Math.min(80, now - last.time));
  const rawVelocity = ((y - last.y) / dt) * 1000 / Math.max(window.innerHeight, 1);
  const boundedVelocity = Math.max(-1.25, Math.min(1.25, rawVelocity));
  const smoothing = 1 - Math.exp(-dt / 58);
  last.velocity += (boundedVelocity - last.velocity) * smoothing;
  emitLiquidScroll({
    progress: y / max,
    velocity: last.velocity,
    depth: Math.max(0, Math.min(1, y / Math.max(window.innerHeight, 1))),
  });
  last.y = y;
  last.time = now;
}

function bindNativeScrollFallback(options: {
  cancelled: () => boolean;
  alignmentTimers: number[];
  setAlignmentFrame: (id: number) => void;
  alignHashBelowNavigation: (scrollToFn?: (top: number) => void) => void;
  previousInlineScrollBehavior: string;
  root: HTMLElement;
}) {
  const {
    cancelled,
    alignmentTimers,
    setAlignmentFrame,
    alignHashBelowNavigation,
    previousInlineScrollBehavior,
    root,
  } = options;
  root.style.scrollBehavior = "auto";
  const last = { y: window.scrollY, time: performance.now(), velocity: 0 };
  let frame = 0;

  const onScroll = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      emitFromNativeScroll(last);
    });
  };

  const afterStableLayout = () => {
    if (cancelled()) return;
    setAlignmentFrame(window.requestAnimationFrame(() => alignHashBelowNavigation()));
    alignmentTimers.push(window.setTimeout(() => alignHashBelowNavigation(), 250));
    alignmentTimers.push(window.setTimeout(() => alignHashBelowNavigation(), 700));
  };

  emitFromNativeScroll(last);
  window.addEventListener("scroll", onScroll, { passive: true });
  if (window.location.hash) {
    void document.fonts.ready.then(afterStableLayout);
    if (document.readyState !== "complete") {
      window.addEventListener("load", afterStableLayout, { once: true });
    }
  }

  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    window.removeEventListener("load", afterStableLayout);
    window.removeEventListener("scroll", onScroll);
    if (previousInlineScrollBehavior) {
      root.style.scrollBehavior = previousInlineScrollBehavior;
    } else {
      root.style.removeProperty("scroll-behavior");
    }
  };
}

/**
 * SmoothScrollProvider
 * --------------------
 * Lenis inertial scroll on the native document. GSAP/Lenis init failures fall
 * back to native scrolling with readable content preserved.
 */
export default function SmoothScrollProvider({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previousInlineScrollBehavior = root.style.scrollBehavior;
    let cancelled = false;
    const alignmentTimers: number[] = [];
    let alignmentFrame = 0;
    let nativeCleanup: (() => void) | null = null;

    const alignHashBelowNavigation = (scrollToFn?: (top: number) => void) => {
      if (cancelled) return;
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      const navigation = document.querySelector<HTMLElement>(".site-nav");
      if (!target || !navigation) return;
      const minimumTop = navigation.getBoundingClientRect().bottom + 12;
      const targetTop = target.getBoundingClientRect().top;
      if (Math.abs(targetTop - minimumTop) > 2) {
        const absoluteTop = window.scrollY + targetTop - minimumTop;
        const top = Math.max(0, absoluteTop);
        if (scrollToFn) {
          scrollToFn(top);
          return;
        }
        const inlineBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo({ top, behavior: "auto" });
        if (inlineBehavior) root.style.scrollBehavior = inlineBehavior;
        else root.style.removeProperty("scroll-behavior");
      }
    };

    if (reducedMotion || !readMotionPolicy().choreographyAllowed) {
      nativeCleanup = bindNativeScrollFallback({
        cancelled: () => cancelled,
        alignmentTimers,
        setAlignmentFrame: (id) => { alignmentFrame = id; },
        alignHashBelowNavigation,
        previousInlineScrollBehavior,
        root,
      });

      return () => {
        cancelled = true;
        if (alignmentFrame) window.cancelAnimationFrame(alignmentFrame);
        alignmentTimers.forEach((timer) => window.clearTimeout(timer));
        nativeCleanup?.();
      };
    }

    root.style.removeProperty("scroll-behavior");
    let lenis: import("lenis").default | null = null;
    let removeLenisScroll: (() => void) | null = null;
    let lastFrameDelta = 1000 / 60;
    let loadAlignHandler: (() => void) | null = null;

    const setup = async () => {
      try {
        await initScrollChoreography();
        if (cancelled) return;

        const { default: Lenis } = await import("lenis");
        if (cancelled) return;

        lenis = new Lenis({
          wrapper: window,
          content: document.documentElement,
          lerp: 0.1,
          wheelMultiplier: 1,
          touchMultiplier: 1,
          syncTouch: false,
          autoRaf: false,
          anchors: {
            offset: 0,
            lerp: 0.12,
          },
          stopInertiaOnNavigate: true,
        });
        if (cancelled) {
          lenis.destroy();
          lenis = null;
          return;
        }

        const scrollImmediate = (top: number) => {
          lenis?.scrollTo(top, { immediate: true, force: true });
        };

        const afterStableLayout = () => {
          if (cancelled) return;
          alignmentFrame = window.requestAnimationFrame(() => {
            alignHashBelowNavigation(scrollImmediate);
          });
          alignmentTimers.push(window.setTimeout(() => alignHashBelowNavigation(scrollImmediate), 250));
          alignmentTimers.push(window.setTimeout(() => alignHashBelowNavigation(scrollImmediate), 700));
        };

        loadAlignHandler = () => afterStableLayout();

        removeLenisScroll = lenis.on("scroll", (instance) => {
          if (!readMotionPolicy().liquidAllowed) return;
          const max = Math.max(1, instance.limit);
          const y = instance.scroll;
          const rawVelocity = (instance.velocity / Math.max(lastFrameDelta, 1))
            * 1000
            / Math.max(window.innerHeight, 1);
          emitLiquidScroll({
            progress: y / max,
            velocity: Math.max(-1.25, Math.min(1.25, rawVelocity)),
            depth: Math.max(0, Math.min(1, y / Math.max(window.innerHeight, 1))),
          });
          getScrollTrigger()?.update();
        });

        subscribeFrameClock(SCROLL_CLOCK_ID, (timeMs, deltaMs) => {
          lastFrameDelta = deltaMs;
          lenis?.raf(timeMs);
        });

        lenis.resize();
        const max = Math.max(1, lenis.limit);
        if (readMotionPolicy().liquidAllowed) {
          emitLiquidScroll({
            progress: lenis.scroll / max,
            velocity: 0,
            depth: Math.max(0, Math.min(1, lenis.scroll / Math.max(window.innerHeight, 1))),
          });
        }

        if (window.location.hash) {
          void document.fonts.ready.then(afterStableLayout);
          if (document.readyState !== "complete" && loadAlignHandler) {
            window.addEventListener("load", loadAlignHandler, { once: true });
          }
        }
      } catch (error) {
        // Lenis/GSAP failed — keep native scrolling and readable content.
        try {
          if (typeof console !== "undefined" && typeof console.warn === "function") {
            console.warn("[portfolio] smooth scroll init failed; using native scroll", error);
          }
        } catch {
          /* ignore */
        }
        unsubscribeFrameClock(SCROLL_CLOCK_ID);
        removeLenisScroll?.();
        lenis?.destroy();
        lenis = null;
        if (!cancelled) {
          nativeCleanup = bindNativeScrollFallback({
            cancelled: () => cancelled,
            alignmentTimers,
            setAlignmentFrame: (id) => { alignmentFrame = id; },
            alignHashBelowNavigation,
            previousInlineScrollBehavior,
            root,
          });
        }
      }
    };

    void setup();

    return () => {
      cancelled = true;
      unsubscribeFrameClock(SCROLL_CLOCK_ID);
      removeLenisScroll?.();
      lenis?.destroy();
      lenis = null;
      if (alignmentFrame) window.cancelAnimationFrame(alignmentFrame);
      alignmentTimers.forEach((timer) => window.clearTimeout(timer));
      if (loadAlignHandler) window.removeEventListener("load", loadAlignHandler);
      nativeCleanup?.();
      if (previousInlineScrollBehavior) {
        root.style.scrollBehavior = previousInlineScrollBehavior;
      } else {
        root.style.removeProperty("scroll-behavior");
      }
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
