"use client";

import { projects } from "@/lib/portfolio/content";
import type { Project } from "@/lib/portfolio/content";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import LiquidGlassCard from "./LiquidGlassCard";

type Props = {
  onProjectSelect?: (project: Project) => void;
};

export default function ProjectButtonsRow({ onProjectSelect }: Props) {
  const reducedMotion = useReducedMotion();
  const heroProjects = projects.slice(0, 4);

  return (
    <div className="project-buttons-row">
      {heroProjects.map((project) => (
        <LiquidGlassCard
          key={project.slug}
          project={project}
          personality={project.personality}
          reducedMotion={reducedMotion}
          className="project-buttons-row__card"
          onOpen={onProjectSelect}
        />
      ))}
    </div>
  );
}
