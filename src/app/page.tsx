"use client";

import dynamic from "next/dynamic";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import ErrorBoundary from "@/components/portfolio/ErrorBoundary";
import HeroName from "@/components/portfolio/HeroName";
import HeroIntro from "@/components/portfolio/HeroIntro";
import LocationCard from "@/components/portfolio/LocationCard";
import ScrollIndicator from "@/components/portfolio/ScrollIndicator";
import SectionAnchors from "@/components/portfolio/SectionAnchors";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import { projects } from "@/lib/portfolio/content";

function SectionSkeleton() {
  return (
    <div className="px-6 md:px-10 lg:px-14 py-32 md:py-40" aria-hidden="true">
      <div className="max-w-7xl mx-auto animate-pulse">
        <div className="h-3 w-28 rounded-full bg-ink/10 mb-5" />
        <div className="h-14 w-72 rounded-2xl bg-ink/5" />
      </div>
    </div>
  );
}

const ProjectsSection = dynamic(() => import("@/components/portfolio/ProjectsSection"), {
  loading: () => <SectionSkeleton />,
});
const ExperienceSection = dynamic(() => import("@/components/portfolio/ExperienceSection"), {
  loading: () => <SectionSkeleton />,
});
const AboutSection = dynamic(() => import("@/components/portfolio/AboutSection"), {
  loading: () => <SectionSkeleton />,
});
const ContactSection = dynamic(() => import("@/components/portfolio/ContactSection"), {
  loading: () => <SectionSkeleton />,
});

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
  return (
    <PortfolioShell>
      <div className="content-layer">
        <ScrollIndicator />

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
              <ProjectGrid />
            </ErrorBoundary>
          </div>

          {/* Bottom anchors */}
          <SectionAnchors />
        </section>

        {/* MAIN SECTIONS */}
        <main>
          <ProjectsSection />
          <ExperienceSection />
          <AboutSection />
          <ContactSection />
        </main>
      </div>
    </PortfolioShell>
  );
}

