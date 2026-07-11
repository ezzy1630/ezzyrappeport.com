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

    const alignHashBelowNavigation = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      const navigation = document.querySelector<HTMLElement>(".site-nav");
      if (!target || !navigation) return;
      const minimumTop = navigation.getBoundingClientRect().bottom + 10;
      const targetTop = target.getBoundingClientRect().top;
      if (targetTop < minimumTop) {
        window.scrollBy({ top: targetTop - minimumTop, behavior: "auto" });
      }
    };

    const scheduleHashAlignment = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(alignHashBelowNavigation);
      });
      window.setTimeout(alignHashBelowNavigation, 120);
    };

    emitNativeScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pageshow", scheduleHashAlignment);
    window.addEventListener("popstate", scheduleHashAlignment);
    if (window.location.hash) scheduleHashAlignment();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pageshow", scheduleHashAlignment);
      window.removeEventListener("popstate", scheduleHashAlignment);
      if (previousInlineScrollBehavior) {
        root.style.scrollBehavior = previousInlineScrollBehavior;
      } else {
        root.style.removeProperty("scroll-behavior");
      }
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
