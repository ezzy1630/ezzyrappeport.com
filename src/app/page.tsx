"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import { useCoarsePointer } from "@/hooks/portfolio/use-coarse-pointer";
import SmoothScrollProvider from "@/components/portfolio/SmoothScrollProvider";
import CustomCursor from "@/components/portfolio/CustomCursor";
import FluidBackground from "@/components/portfolio/FluidBackground";
import Navigation from "@/components/portfolio/Navigation";
import HeroName from "@/components/portfolio/HeroName";
import HeroIntro from "@/components/portfolio/HeroIntro";
import LocationCard from "@/components/portfolio/LocationCard";
import ScrollIndicator from "@/components/portfolio/ScrollIndicator";
import SectionAnchors from "@/components/portfolio/SectionAnchors";
import ProjectGrid from "@/components/portfolio/ProjectGrid";
import SvgFilters from "@/components/portfolio/SvgFilters";

const ProjectsSection = dynamic(() => import("@/components/portfolio/ProjectsSection"));
const ExperienceSection = dynamic(() => import("@/components/portfolio/ExperienceSection"));
const AboutSection = dynamic(() => import("@/components/portfolio/AboutSection"));
const ContactSection = dynamic(() => import("@/components/portfolio/ContactSection"));

export default function Home() {
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();

  // Custom cursor only on fine-pointer devices + when motion is allowed.
  // Both hooks start as `false` (no reduced motion, no coarse pointer) on
  // first render, then update after mount, so the cursor enables on the
  // first client paint and re-evaluates if the user's preference changes.
  const cursorEnabled = !reducedMotion && !coarsePointer;

  return (
    <SmoothScrollProvider reducedMotion={reducedMotion}>
      <div id="top" className="portfolio-root">
        {/* Hidden SVG filter defs */}
        <SvgFilters />

        {/* Custom cursor (desktop + motion-allowed only) */}
        <CustomCursor disabled={!cursorEnabled} />

        {/* Fluid canvas background */}
        <FluidBackground reducedMotion={reducedMotion} staticMode={coarsePointer} />

        {/* Content layer */}
        <div className="content-layer">
          <Navigation />
          <ScrollIndicator />

          {/* HERO */}
          <section aria-label="Hero" className="hero-shell">
            {/* Hero name — dominates upper-middle */}
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
              <ProjectGrid />
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
      </div>
    </SmoothScrollProvider>
  );
}
