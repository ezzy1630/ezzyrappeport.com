"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import { useCoarsePointer } from "@/hooks/portfolio/use-coarse-pointer";
import SmoothScrollProvider from "@/components/portfolio/SmoothScrollProvider";
import CustomCursor from "@/components/portfolio/CustomCursor";
import Navigation from "@/components/portfolio/Navigation";
import HeroName from "@/components/portfolio/HeroName";
import HeroIntro from "@/components/portfolio/HeroIntro";
import LocationCard from "@/components/portfolio/LocationCard";
import ScrollIndicator from "@/components/portfolio/ScrollIndicator";
import SectionAnchors from "@/components/portfolio/SectionAnchors";
import ProjectsSection from "@/components/portfolio/ProjectsSection";
import ExperienceSection from "@/components/portfolio/ExperienceSection";
import AboutSection from "@/components/portfolio/AboutSection";
import ContactSection from "@/components/portfolio/ContactSection";
import SvgFilters from "@/components/portfolio/SvgFilters";

// WebGPU canvas must be client-only — never SSR'd.
// The dynamic import itself defers mounting to the client, so we don't need
// a separate `mounted` flag — the component only renders after hydration.
const FluidBackground = dynamic(
  () => import("@/components/portfolio/FluidBackground"),
  {
    ssr: false,
    loading: () => (
      <div
        className="fluid-canvas"
        style={{ background: "linear-gradient(180deg, #f7f9fc 0%, #edf1f7 100%)" }}
        aria-hidden="true"
      />
    ),
  }
);

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

        {/* WebGPU fluid background */}
        <FluidBackground reducedMotion={reducedMotion} />

        {/* Content layer */}
        <div className="content-layer">
          <Navigation />
          <ScrollIndicator />

          {/* HERO */}
          <section
            aria-label="Hero"
            className="relative min-h-screen flex flex-col justify-between pt-32 md:pt-36 pb-28 md:pb-32 px-6 md:px-10 lg:px-14"
          >
            {/* Hero name — dominates upper-middle */}
            <div className="mt-6 md:mt-10">
              <HeroName />
            </div>

            {/* Lower hero — intro on left, location card on right */}
            <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-8 items-end max-w-7xl mx-auto w-full">
              <HeroIntro />
              <div className="flex md:justify-end">
                <LocationCard />
              </div>
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
