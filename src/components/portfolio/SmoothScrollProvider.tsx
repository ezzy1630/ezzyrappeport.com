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
    let frame = 0;
    const root = document.documentElement;
    const previousInlineScrollBehavior = root.style.scrollBehavior;

    if (reducedMotion) root.style.scrollBehavior = "auto";
    else root.style.removeProperty("scroll-behavior");

    const emitNativeScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const now = performance.now();
      const y = window.scrollY;
      const dt = Math.max(16, now - lastScrollTime);
      const velocity = ((y - lastScrollY) / dt) * 16 / Math.max(window.innerHeight, 1);
      emitLiquidScroll({
        progress: y / max,
        velocity,
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

    emitNativeScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
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
