import ErrorBoundary from "@/components/portfolio/ErrorBoundary";
import HeroIntro from "@/components/portfolio/HeroIntro";
import HeroName from "@/components/portfolio/HeroName";
import LocationCard from "@/components/portfolio/LocationCard";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import ProjectsSection from "@/components/portfolio/ProjectsSection";
import ExperienceSection from "@/components/portfolio/ExperienceSection";
import AboutSection from "@/components/portfolio/AboutSection";
import ContactSection from "@/components/portfolio/ContactSection";
import SectionAnchors from "@/components/portfolio/SectionAnchors";
import { projects } from "@/lib/portfolio/content";

function ProjectListFallback() {
  return (
    <div className="project-buttons-row">
      {projects.slice(0, 4).map((project) => (
        <a
          key={project.slug}
          href={`/project/${project.slug}`}
          className="project-buttons-row__card liquid-glass-card"
        >
          <span className="liquid-glass-content">
            <span className="liquid-glass-index">{project.index}</span>
            <span className="liquid-glass-title">{project.title}</span>
            <span className="liquid-glass-subtitle">{project.subtitle}</span>
          </span>
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <PortfolioShell heroName>
      <div className="content-layer">
        <section aria-labelledby="portfolio-title" className="hero-shell">
          <div className="hero-scroll-cue" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>

          <div className="hero-name-stage">
            <HeroName />
          </div>

          <div className="hero-copy-row">
            <HeroIntro />
            <LocationCard />
          </div>

          <div className="hero-projects" aria-label="Featured projects">
            <ErrorBoundary fallback={<ProjectListFallback />}>
              <ProjectGrid />
            </ErrorBoundary>
          </div>

          <SectionAnchors />
        </section>

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
