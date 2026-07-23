"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import SmoothScrollProvider from "./SmoothScrollProvider";
import Navigation from "./Navigation";
import ErrorBoundary from "./ErrorBoundary";
import { PortfolioMotionProvider } from "./PortfolioMotionContext";
import { useLiquidHoverDialogue } from "@/hooks/portfolio/use-liquid-dialogue";
import { invalidateWorldMeasurement } from "@/lib/portfolio/world-state";

type WaterSection = "hero" | "projects" | "about" | "contact" | "case";

const WATER_SECTION_SELECTORS: ReadonlyArray<readonly [WaterSection, string]> = [
  ["hero", ".hero-shell"],
  ["projects", "#projects"],
  ["about", "#about"],
  ["contact", "#contact"],
  ["case", "[data-water-section='case']"],
];

function useWaterSection() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewportLine = window.innerHeight * 0.48;
      let active: WaterSection = document.querySelector("[data-water-section='case']") ? "case" : "hero";
      let nearest = Number.POSITIVE_INFINITY;
      for (const [section, selector] of WATER_SECTION_SELECTORS) {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= viewportLine && rect.bottom >= viewportLine) {
          active = section;
          nearest = 0;
          break;
        }
        const distance = Math.min(Math.abs(rect.top - viewportLine), Math.abs(rect.bottom - viewportLine));
        if (distance < nearest) {
          active = section;
          nearest = distance;
        }
      }
      document.documentElement.dataset.waterSection = active;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const layoutRoot = document.querySelector<HTMLElement>(".content-layer");
    const layoutObserver = typeof ResizeObserver === "undefined" || !layoutRoot
      ? null
      : new ResizeObserver(() => {
          invalidateWorldMeasurement();
          onScroll();
        });
    if (layoutObserver && layoutRoot) layoutObserver.observe(layoutRoot);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
      layoutObserver?.disconnect();
      delete document.documentElement.dataset.waterSection;
    };
  }, []);
}

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
  /** Seed the shallow dock before client effects and the renderer mount. */
  routeMode?: "index" | "case";
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
  routeMode = "index",
}: Props) {
  const reducedMotion = useReducedMotion();
  const [motionPreference, setMotionPreference] = useState<boolean | null>(null);
  const motionEnabled = !reducedMotion && (motionPreference ?? true);
  const motionReduced = !motionEnabled;
  const renderHeroName = heroName;
  const routeStyle: CSSProperties | undefined = routeMode === "case"
    ? {
        "--world-depth": "0.22",
        "--world-light": "0.9056",
        "--world-calm": "0.25",
      } as CSSProperties
    : undefined;
  useWaterSection();
  useLiquidHoverDialogue();

  useEffect(() => {
    const stored = window.localStorage.getItem("portfolio-motion");
    if (!reducedMotion && (stored === "on" || stored === "off")) {
      setMotionPreference(stored === "on");
    }
  }, [reducedMotion]);

  const toggleMotion = () => {
    if (reducedMotion) return;
    setMotionPreference((current) => {
      const next = !(current ?? !reducedMotion);
      window.localStorage.setItem("portfolio-motion", next ? "on" : "off");
      return next;
    });
  };

  const motionState = useMemo(
    () => ({ motionEnabled, reducedMotion: motionReduced }),
    [motionEnabled, motionReduced],
  );

  return (
    <PortfolioMotionProvider value={motionState}>
      <SmoothScrollProvider reducedMotion={motionReduced}>
        <div
          id="top"
          className={`portfolio-root ${screenLocked ? "portfolio-root--locked" : ""}`}
          data-motion={motionEnabled ? "on" : "off"}
          data-route={routeMode}
          style={routeStyle}
        >
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
    </PortfolioMotionProvider>
  );
}
