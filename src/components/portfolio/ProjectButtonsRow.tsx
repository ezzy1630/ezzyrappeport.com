import { projects } from "@/lib/portfolio/content";
import LiquidGlassCard from "./LiquidGlassCard";

export default function ProjectButtonsRow() {
  const heroProjects = projects.slice(0, 4);

  return (
    <div className="project-buttons-row">
      {heroProjects.map((project) => (
        <LiquidGlassCard
          key={project.slug}
          project={{
            slug: project.slug,
            title: project.title,
            subtitle: project.subtitle,
            index: project.index,
          }}
          personality={project.personality}
          className="project-buttons-row__card"
        />
      ))}
    </div>
  );
}
