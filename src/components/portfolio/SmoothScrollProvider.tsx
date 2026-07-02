"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

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
    if (reducedMotion) {
      // No smooth scroll — let native instant scroll handle it
      return;
    }

    let rafId = 0;

    const startLenis = () => {
      if (lenisRef.current) return lenisRef.current;

      const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      lerp: 0.08,
      });
      lenisRef.current = lenis;

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
    window.addEventListener("keydown", onFirstScrollIntent, { once: true });
    document.addEventListener("click", onClick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("wheel", onFirstScrollIntent);
      window.removeEventListener("touchmove", onFirstScrollIntent);
      window.removeEventListener("keydown", onFirstScrollIntent);
      document.removeEventListener("click", onClick);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
