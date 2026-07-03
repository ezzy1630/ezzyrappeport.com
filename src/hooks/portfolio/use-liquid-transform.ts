"use client";

import { useEffect, useRef } from "react";
import { subscribeLiquidPhysics, sampleLiquidField } from "@/lib/portfolio/liquid-interaction";

export type LiquidTransformOptions = {
  /** Maximum translation in pixels. */
  maxMove?: number;
  /** Maximum rotation in degrees. */
  maxRotate?: number;
  /** Scale factor for the displacement. */
  scale?: number;
  /** Vertical scroll parallax multiplier (positive = move up on scroll). */
  scrollMultiplier?: number;
  /** Disable when true. */
  reduce?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function scrollOffset(multiplier = 0) {
  if (typeof window === "undefined") return 0;
  const vh = Math.max(window.innerHeight, 1);
  return (window.scrollY / vh) * multiplier * 15;
}

/**
 * Subscribe an element to the shared liquid field and update its CSS transform
 * directly. Safe with Framer Motion because it writes to a dedicated wrapper.
 */
export function useLiquidTransform<T extends HTMLElement>(
  options: LiquidTransformOptions = {}
) {
  const ref = useRef<T>(null);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    if (options.reduce) return;
    let rafId = 0;

    const update = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const field = sampleLiquidField(cx, cy);
        const { maxMove = 8, maxRotate = 2, scale = 1, scrollMultiplier = 0 } = opts.current;
        const dx = clamp(field.x * scale, -maxMove, maxMove);
        const dy = clamp(field.y * scale, -maxMove, maxMove) - scrollOffset(scrollMultiplier);
        const rx = clamp(-field.y * scale * 0.12, -maxRotate, maxRotate);
        const ry = clamp(field.x * scale * 0.12, -maxRotate, maxRotate);
        el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        el.style.setProperty("--liquid-intensity", Math.min(1, field.intensity).toFixed(3));
      });
    };

    const unsubscribe = subscribeLiquidPhysics(update);

    const onScroll = () => {
      update();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      unsubscribe();
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [options.reduce, options.maxMove, options.maxRotate, options.scale, options.scrollMultiplier]);

  return ref;
}


