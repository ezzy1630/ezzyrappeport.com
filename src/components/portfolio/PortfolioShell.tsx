"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import SmoothScrollProvider from "./SmoothScrollProvider";
import Navigation from "./Navigation";
import ErrorBoundary from "./ErrorBoundary";

const FluidScene = dynamic(() => import("./FluidScene"), {
  ssr: false,
  loading: () => (
    <div
      className="fluid-canvas"
      data-fluid="poster"
      data-quality="shell"
      aria-hidden="true"
    />
  ),
});

type Props = {
  children: React.ReactNode;
  /** Render the giant submerged hero name inside the fluid shader. */
  heroName?: boolean;
  /** Show the floating top navigation. */
  showNav?: boolean;
  /** Keep the route to one viewport; modal content handles overflow. */
  screenLocked?: boolean;
};

/**
 * PortfolioShell
 * --------------
 * Shared chrome for every portfolio route: reduced-motion-aware Framer config,
 * Lenis smooth scroll, the unified fluid canvas, and the floating nav. Wrapping
 * both `/` and `/project/[slug]` in this keeps the surface one connected
 * material system (a core PRODUCT.md principle).
 *
 * The cursor is the native pointer — the only "cursor effect" is the live
 * ripple the pointer generates inside the fluid simulation (FluidScene).
 */
export default function PortfolioShell({
  children,
  heroName = true,
  showNav = true,
  screenLocked = false,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [motionPreference, setMotionPreference] = useState<boolean | null>(null);
  const motionEnabled = motionPreference ?? !reducedMotion;
  const motionReduced = !motionEnabled;
  const renderHeroName = heroName;

  useEffect(() => {
    const stored = window.localStorage.getItem("portfolio-motion");
    if (stored === "on" || stored === "off") setMotionPreference(stored === "on");
  }, []);

  const toggleMotion = () => {
    setMotionPreference((current) => {
      const next = !(current ?? !reducedMotion);
      window.localStorage.setItem("portfolio-motion", next ? "on" : "off");
      return next;
    });
  };

  return (
      <SmoothScrollProvider reducedMotion={motionReduced}>
        <div id="top" className={`portfolio-root ${screenLocked ? "portfolio-root--locked" : ""}`}>
          <ErrorBoundary>
            <FluidScene
              reducedMotion={motionReduced}
              staticMode={false}
              // The home hero owns the single WebGL title material. Case pages
              // keep the canvas ambient-only and use the static fallback path.
              heroName={renderHeroName}
            />
          </ErrorBoundary>

          {showNav && <Navigation motionEnabled={motionEnabled} onToggleMotion={toggleMotion} />}

          {children}
        </div>
      </SmoothScrollProvider>
  );
}
