"use client";

import { useEffect } from "react";
import { createGeometryCache } from "@/lib/portfolio/geometry-cache";
import { subscribeLiquidPointer } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

/**
 * Depth-plane pointer parallax for #about.
 * Kept as a tiny client adapter so AboutSection markup can stay on the server.
 */
export default function AboutDepthPlanes() {
  useEffect(() => {
    const section = document.getElementById("about");
    if (!section) return;
    if (!readMotionPolicy().effectsAllowed) return;

    const planes = [...section.querySelectorAll<HTMLElement>("[data-depth-plane]")];
    if (planes.length === 0) return;

    const geometry = createGeometryCache(section, { marginPx: 120 });
    let disposed = false;

    const unsubscribe = subscribeLiquidPointer((pointer) => {
      if (disposed) return;
      if (!readMotionPolicy().effectsAllowed) return;
      if (!geometry.isNearViewport()) return;
      const rect = geometry.getRect();
      if (!rect) return;

      const nx = (pointer.x / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (pointer.y / Math.max(window.innerHeight, 1) - 0.5) * 2;
      const energy = Math.min(1, 0.35 + pointer.energy);
      for (const plane of planes) {
        const depth = Number(plane.dataset.depthPlane || "0");
        const x = (-nx * depth * 7 * energy).toFixed(2);
        const y = (-ny * depth * 5 * energy).toFixed(2);
        plane.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        plane.style.willChange = "transform";
      }
    });

    return () => {
      disposed = true;
      unsubscribe();
      geometry.dispose();
      for (const plane of planes) {
        plane.style.transform = "";
        plane.style.willChange = "";
      }
    };
  }, []);

  return null;
}
