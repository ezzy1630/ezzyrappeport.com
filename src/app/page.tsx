"use client";

import { useState } from "react";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import ErrorBoundary from "@/components/portfolio/ErrorBoundary";
import HeroName from "@/components/portfolio/HeroName";
import HeroIntro from "@/components/portfolio/HeroIntro";
import LocationCard from "@/components/portfolio/LocationCard";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import ProjectModal from "@/components/portfolio/ProjectModal";
import { projects, type Project } from "@/lib/portfolio/content";

/** Plain-link fallback if the WebGL project cards fail to initialize. */
function ProjectListFallback() {
  return (
    <div className="project-buttons-row">
      {projects.map((project) => (
        <a
          key={project.slug}
          href={`/project/${project.slug}`}
          className="project-buttons-row__card glass rounded-[28px] px-6 py-5 flex flex-col justify-center gap-1"
          data-cursor="hover"
        >
          <span className="text-[11px] font-medium text-ink-soft/60">{project.index}</span>
          <span className="font-display text-[15px] font-bold text-ink">{project.title}</span>
          <span className="text-[12px] text-ink-soft/70">{project.subtitle}</span>
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <PortfolioShell heroName={false} screenLocked>
      <div className="content-layer">
        {/* HERO */}
        <section aria-label="Hero" className="hero-shell">
          {/* Hero name — dominates upper-middle (shader + CSS fallback) */}
          <div className="hero-name-stage">
            <HeroName />
          </div>

          {/* Lower hero — intro on left, location card on right */}
          <div className="hero-copy-row">
            <HeroIntro />
            <div className="flex md:justify-end">
              <LocationCard />
            </div>
          </div>

          <div className="hero-projects">
            <ErrorBoundary fallback={<ProjectListFallback />}>
              <ProjectGrid onProjectSelect={setSelectedProject} />
            </ErrorBoundary>
          </div>
        </section>
      </div>
      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </PortfolioShell>
  );
}
