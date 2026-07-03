"use client";

import { MotionConfig } from "framer-motion";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import { useCoarsePointer } from "@/hooks/portfolio/use-coarse-pointer";
import SmoothScrollProvider from "./SmoothScrollProvider";
import FluidScene from "./FluidScene";
import Navigation from "./Navigation";
import ErrorBoundary from "./ErrorBoundary";

type Props = {
  children: React.ReactNode;
  /** Render the giant submerged hero name inside the fluid shader. */
  heroName?: boolean;
  /** Show the floating top navigation. */
  showNav?: boolean;
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
}: Props) {
  const reducedMotion = useReducedMotion();
  const coarsePointer = useCoarsePointer();

  return (
    <MotionConfig reducedMotion="user">
      <SmoothScrollProvider reducedMotion={reducedMotion}>
        <div id="top" className="portfolio-root">
          <ErrorBoundary>
            <FluidScene
              reducedMotion={reducedMotion}
              staticMode={coarsePointer}
              heroName={heroName}
            />
          </ErrorBoundary>

          {showNav && <Navigation />}

          {children}
        </div>
      </SmoothScrollProvider>
    </MotionConfig>
  );
}
