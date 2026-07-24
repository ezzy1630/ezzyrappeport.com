import HeroIntro from "@/components/portfolio/HeroIntro";
import HeroName from "@/components/portfolio/HeroName";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import ProjectsSection from "@/components/portfolio/ProjectsSection";
import AboutSection from "@/components/portfolio/AboutSection";
import ContactSection from "@/components/portfolio/ContactSection";
import DescentBeats from "@/components/portfolio/DescentBeats";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function Home() {
  return (
    <PortfolioShell heroName>
      <div className="content-layer">
        <section
          aria-labelledby="portfolio-title"
          className="hero-shell"
          data-depth-band="surface"
        >
          <div className="hero-name-stage">
            <HeroName />
          </div>

          <div className="hero-copy-row">
            <HeroIntro />
          </div>

          <div className="hero-annotations">
            <MapPin aria-hidden="true" />
            <span>{bio.location.title}</span>
          </div>
        </section>

        <main id="main-content">
          <ProjectsSection />
          <AboutSection />
          <ContactSection />
        </main>
      </div>
      <DescentBeats />
    </PortfolioShell>
  );
}
