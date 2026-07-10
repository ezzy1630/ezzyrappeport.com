"use client";

import { useRef, useState } from "react";
import { projects } from "@/lib/portfolio/content";
import LiquidGlassCard from "./LiquidGlassCard";

export default function ProjectButtonsRow() {
  const heroProjects = projects.slice(0, 4);
  const rowRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = () => {
    const row = rowRef.current;
    const firstCard = row?.querySelector<HTMLElement>(".project-buttons-row__card");
    if (!row || !firstCard) return;
    const stride = firstCard.offsetWidth + parseFloat(getComputedStyle(row).columnGap || "0");
    setActiveIndex(Math.max(0, Math.min(heroProjects.length - 1, Math.round(row.scrollLeft / Math.max(1, stride)))));
  };

  return (
    <>
      <div ref={rowRef} className="project-buttons-row" onScroll={onScroll}>
        {heroProjects.map((project) => (
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
          />
        ))}
      </div>
      <p className="project-buttons-row__position" aria-live="polite">
        <span>{String(activeIndex + 1).padStart(2, "0")}</span> / {String(heroProjects.length).padStart(2, "0")}
      </p>
    </>
  );
}
