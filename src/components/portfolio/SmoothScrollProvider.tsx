"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { emitLiquidScroll } from "@/lib/portfolio/liquid-interaction";

/**
 * SmoothScrollProvider
 * --------------------
 * Wraps the app with Lenis for damped, cinematic scrolling.
 * Respects prefers-reduced-motion (skips Lenis entirely).
 * Anchors with href^="#..." get smooth-scroll-to behavior.
 */
export default function SmoothScrollProvider({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let lastScrollTime = typeof performance !== "undefined" ? performance.now() : 0;

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

    emitNativeScroll();
    window.addEventListener("scroll", emitNativeScroll, { passive: true });

    if (reducedMotion) {
      // No smooth scroll — let native instant scroll handle it
      return () => window.removeEventListener("scroll", emitNativeScroll);
    }

    let rafId = 0;

    const startLenis = () => {
      if (lenisRef.current) return lenisRef.current;

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.82,
        touchMultiplier: 1.35,
        lerp: 0.075,
      });
      lenisRef.current = lenis;
      lenis.on("scroll", ({ scroll, velocity, progress }: { scroll: number; velocity: number; progress: number }) => {
        const normalizedVelocity = velocity / Math.max(window.innerHeight, 1);
        emitLiquidScroll({
          progress,
          velocity: normalizedVelocity,
          depth: progress,
          section: Math.round(progress * 3),
          time: performance.now(),
        });
        lastScrollY = scroll;
        lastScrollTime = performance.now();
      });

      function raf(time: number) {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);

      return lenis;
    };

    const onFirstScrollIntent = () => {
      startLenis();
    };

    // Only wake Lenis on actual scroll keys (not Tab / Cmd / etc.)
    const SCROLL_KEYS = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
    ]);
    const onFirstKey = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      startLenis();
      window.removeEventListener("keydown", onFirstKey);
    };

    // Smooth anchor scrolling
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const el = document.querySelector(href);
      if (!el) return;
      e.preventDefault();
      const lenis = startLenis();
      lenis.scrollTo(el as HTMLElement, { offset: -40, duration: 1.4 });
    };

    window.addEventListener("wheel", onFirstScrollIntent, { once: true, passive: true });
    window.addEventListener("touchmove", onFirstScrollIntent, { once: true, passive: true });
    window.addEventListener("keydown", onFirstKey, { passive: true });
    document.addEventListener("click", onClick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", emitNativeScroll);
      window.removeEventListener("wheel", onFirstScrollIntent);
      window.removeEventListener("touchmove", onFirstScrollIntent);
      window.removeEventListener("keydown", onFirstKey);
      document.removeEventListener("click", onClick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
