"use client";

import { useEffect } from "react";
import { emitLiquidScroll } from "@/lib/portfolio/liquid-interaction";

/**
 * SmoothScrollProvider
 * --------------------
 * Keeps native scrolling crisp while publishing throttled scroll state to the
 * liquid renderer. Anchor motion comes from CSS and is disabled when motion is
 * reduced, so this provider never adds a second continuous animation loop.
 */
export default function SmoothScrollProvider({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}) {
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let lastScrollTime = performance.now();
    let filteredVelocity = 0;
    let frame = 0;
    const root = document.documentElement;
    const previousInlineScrollBehavior = root.style.scrollBehavior;

    if (reducedMotion) root.style.scrollBehavior = "auto";
    else root.style.removeProperty("scroll-behavior");

    const emitNativeScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(8, Math.min(80, now - lastScrollTime));
      const rawVelocity = ((y - lastScrollY) / dt) * 1000 / Math.max(window.innerHeight, 1);
      const boundedVelocity = Math.max(-1.25, Math.min(1.25, rawVelocity));
      const smoothing = 1 - Math.exp(-dt / 58);
      filteredVelocity += (boundedVelocity - filteredVelocity) * smoothing;
      emitLiquidScroll({
        progress: y / max,
        velocity: filteredVelocity,
        depth: y / max,
      });
      lastScrollY = y;
      lastScrollTime = now;
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        emitNativeScroll();
      });
    };

    const alignmentTimers: number[] = [];
    let alignmentFrame = 0;
    let cancelled = false;

    const alignHashBelowNavigation = () => {
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
        // `behavior: auto` inherits the root's CSS `scroll-behavior`; briefly
        // force an instant correction so repeated layout checks cannot compete
        // with a still-running smooth anchor animation.
        const inlineBehavior = root.style.scrollBehavior;
        root.style.scrollBehavior = "auto";
        window.scrollTo({ top: Math.max(0, absoluteTop), behavior: "auto" });
        if (inlineBehavior) root.style.scrollBehavior = inlineBehavior;
        else root.style.removeProperty("scroll-behavior");
      }
    };

    const afterStableLayout = () => {
      if (cancelled) return;
      alignmentFrame = window.requestAnimationFrame(alignHashBelowNavigation);
      alignmentTimers.push(window.setTimeout(alignHashBelowNavigation, 250));
      alignmentTimers.push(window.setTimeout(alignHashBelowNavigation, 700));
    };

    const scheduleInitialHashAlignment = () => {
      void document.fonts.ready.then(afterStableLayout);
      if (document.readyState !== "complete") {
        window.addEventListener("load", afterStableLayout, { once: true });
      }
    };

    emitNativeScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    // Let Next own route history and browser restoration. We only align an
    // initial hash after this route's DOM has mounted; no history event is
    // intercepted or corrected while another route is still on screen.
    if (window.location.hash) scheduleInitialHashAlignment();

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (alignmentFrame) window.cancelAnimationFrame(alignmentFrame);
      alignmentTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("load", afterStableLayout);
      window.removeEventListener("scroll", onScroll);
      if (previousInlineScrollBehavior) {
        root.style.scrollBehavior = previousInlineScrollBehavior;
      } else {
        root.style.removeProperty("scroll-behavior");
      }
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
