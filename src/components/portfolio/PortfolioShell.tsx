"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { MotionConfig } from "framer-motion";
import { Waves } from "lucide-react";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import { useCoarsePointer } from "@/hooks/portfolio/use-coarse-pointer";
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
  const coarsePointer = useCoarsePointer();
  const [motionEnabled, setMotionEnabled] = useState(!reducedMotion);
  const motionReduced = reducedMotion || !motionEnabled;

  return (
    <MotionConfig reducedMotion={motionReduced ? "always" : "never"}>
      <SmoothScrollProvider reducedMotion={motionReduced}>
        <div id="top" className={`portfolio-root ${screenLocked ? "portfolio-root--locked" : ""}`}>
          <ErrorBoundary>
            <FluidScene
              reducedMotion={motionReduced}
              staticMode={coarsePointer}
              heroName={heroName}
            />
          </ErrorBoundary>

          {showNav && <Navigation />}
          {showNav && (
            <button
              type="button"
              className="motion-toggle glass"
              aria-pressed={motionEnabled && !reducedMotion}
              aria-label={
                motionEnabled && !reducedMotion
                  ? "Turn motion off"
                  : "Turn motion on"
              }
              title={
                motionEnabled && !reducedMotion
                  ? "Turn motion off"
                  : "Turn motion on"
              }
              onClick={() => setMotionEnabled((enabled) => !enabled)}
            >
              <Waves aria-hidden="true" className="motion-toggle__icon" strokeWidth={2.2} />
              <span className="motion-toggle__label">
                {motionEnabled && !reducedMotion ? "Motion" : "Still"}
              </span>
            </button>
          )}

          {children}
        </div>
      </SmoothScrollProvider>
    </MotionConfig>
  );
}
