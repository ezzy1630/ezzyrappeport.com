"use client";

import { useEffect } from "react";
import {
  emitLiquidPress,
  emitLiquidWake,
} from "@/lib/portfolio/liquid-interaction";

/**
 * ProjectsInteraction
 * -------------------
 * Turns the project index into objects suspended in the shared water:
 *  - Each object resolves from water-softened to sharp as it approaches
 *    (progressive enhancement — without JS every row stays fully resolved).
 *  - Arriving objects displace the water beneath them (a soft press into the
 *    same heightfield the hero name floats in).
 *  - Moving the cursor from one object to the next redirects the current: a
 *    directional wake travels from the previous object toward the next.
 */
export default function ProjectsInteraction() {
  useEffect(() => {
    const section = document.getElementById("projects");
    if (!section) return;
    const rows = [...section.querySelectorAll<HTMLElement>("[data-project-row]")];
    if (rows.length === 0) return;

    const mediaCenter = (row: HTMLElement) => {
      const media = row.querySelector<HTMLElement>("[data-project-media]");
      if (!media) return null;
      const rect = media.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > window.innerHeight + 80) return null;
      return {
        x: rect.left + rect.width * 0.5,
        y: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height * 0.56)),
      };
    };

    // Rows below the arrival band start water-softened; rows already near the
    // viewport stay sharp so mid-page loads never re-blur visible content.
    const arrivalBand = (row: HTMLElement) => {
      const rect = row.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > window.innerHeight * 0.05;
    };
    for (const row of rows) {
      row.dataset.resolved = arrivalBand(row) ? "true" : "false";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target as HTMLElement;
          if (!entry.isIntersecting || row.dataset.resolved === "true") continue;
          row.dataset.resolved = "true";
          // The object displaces the water as it breaks the surface of view.
          const center = mediaCenter(row);
          if (center) emitLiquidPress({ x: center.x, y: center.y, strength: 0.2, radius: 60 });
        }
      },
      { rootMargin: "-14% 0px -14% 0px", threshold: 0.16 },
    );
    rows.forEach((row) => observer.observe(row));

    let currentRow: HTMLElement | null = null;
    const onPointerOver = (event: PointerEvent) => {
      const row = (event.target as HTMLElement).closest?.("[data-project-row]") as HTMLElement | null;
      if (row === currentRow) return;
      const next = row && row.contains(event.target as Node) && (event.target as HTMLElement).closest("[data-project-media]")
        ? row
        : null;
      if (next && next !== currentRow) {
        const nextCenter = mediaCenter(next);
        const previousCenter = currentRow ? mediaCenter(currentRow) : null;
        if (nextCenter && previousCenter) {
          // Redirect the current from the settling object toward the new one.
          emitLiquidWake({
            startX: previousCenter.x,
            startY: previousCenter.y,
            endX: nextCenter.x,
            endY: nextCenter.y,
            strength: 0.32,
            radius: 44,
          });
        } else if (nextCenter) {
          emitLiquidPress({ x: nextCenter.x, y: nextCenter.y, strength: 0.26, radius: 56 });
        }
      }
      if (next) currentRow = next;
      else if (currentRow && !row) currentRow = null;
    };
    const onPointerLeave = () => {
      currentRow = null;
    };

    section.addEventListener("pointerover", onPointerOver);
    section.addEventListener("pointerleave", onPointerLeave);
    return () => {
      observer.disconnect();
      section.removeEventListener("pointerover", onPointerOver);
      section.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return null;
}
