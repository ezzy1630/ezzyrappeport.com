"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { projects } from "@/lib/portfolio/content";
import LiquidGlassCard, { type LiquidCardGeometryRegistrar } from "./LiquidGlassCard";

const HERO_PROJECTS = projects.slice(0, 4);

export default function ProjectButtonsRow() {
  const rowRef = useRef<HTMLDivElement>(null);
  const geometryCallbacksRef = useRef(new Set<() => void>());
  const geometryFrameRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const scheduleGeometryUpdate = useCallback(() => {
    if (geometryFrameRef.current) return;
    geometryFrameRef.current = window.requestAnimationFrame(() => {
      geometryFrameRef.current = 0;
      geometryCallbacksRef.current.forEach((measure) => measure());
    });
  }, []);

  const registerGeometry = useCallback<LiquidCardGeometryRegistrar>((measure) => {
    geometryCallbacksRef.current.add(measure);
    return () => geometryCallbacksRef.current.delete(measure);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", scheduleGeometryUpdate, { passive: true });
    window.addEventListener("scroll", scheduleGeometryUpdate, { passive: true });
    return () => {
      window.cancelAnimationFrame(geometryFrameRef.current);
      window.removeEventListener("resize", scheduleGeometryUpdate);
      window.removeEventListener("scroll", scheduleGeometryUpdate);
    };
  }, [scheduleGeometryUpdate]);

  const onScroll = useCallback(() => {
    scheduleGeometryUpdate();
    const row = rowRef.current;
    const firstCard = row?.querySelector<HTMLElement>(".project-buttons-row__card");
    if (!row || !firstCard) return;
    const stride = firstCard.offsetWidth + parseFloat(getComputedStyle(row).columnGap || "0");
    const nextIndex = Math.max(0, Math.min(HERO_PROJECTS.length - 1, Math.round(row.scrollLeft / Math.max(1, stride))));
    setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
  }, [scheduleGeometryUpdate]);

  return (
    <>
      <div ref={rowRef} className="project-buttons-row" onScroll={onScroll}>
        {HERO_PROJECTS.map((project) => (
          <LiquidGlassCard
            key={project.slug}
            project={{
              slug: project.slug,
              title: project.title,
              subtitle: project.subtitle,
              index: project.index,
              status: project.status,
            }}
            personality={project.personality}
            className="project-buttons-row__card"
            registerGeometry={registerGeometry}
          />
        ))}
      </div>
      <p className="project-buttons-row__position" aria-live="polite">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span> / {String(HERO_PROJECTS.length).padStart(2, "0")}
      </p>
    </>
  );
}
