"use client";

import { useEffect } from "react";
import { emitLiquidPress, emitLiquidWake } from "@/lib/portfolio/liquid-interaction";

/** One route-scoped plunge. It runs after a case page mounts, never on render. */
export default function CaseArrivalWater() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.querySelector(".portfolio-root[data-motion='off']")) return;
    const article = document.querySelector<HTMLElement>("[data-water-section='case']");
    if (!article) return;
    const rect = article.getBoundingClientRect();
    const x = rect.left + rect.width * 0.62;
    const y = Math.min(window.innerHeight * 0.58, rect.top + window.innerHeight * 0.54);
    emitLiquidWake({
      startX: x,
      startY: y + 44,
      endX: x,
      endY: y,
      strength: 0.34,
      radius: 72,
    });
    emitLiquidPress({ x, y, strength: 0.24, radius: 78 });
  }, []);

  return null;
}
