"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import SmoothScrollProvider from "./SmoothScrollProvider";
import Navigation from "./Navigation";
import ErrorBoundary from "./ErrorBoundary";
import { PortfolioMotionProvider } from "./PortfolioMotionContext";
import { useLiquidHoverDialogue } from "@/hooks/portfolio/use-liquid-dialogue";
import { useMagneticInteractions } from "@/lib/portfolio/use-magnetic";
import {
  disposeDeviceTilt,
  enableDeviceTiltFromGesture,
  setDeviceTiltAllowed,
} from "@/lib/portfolio/device-tilt";
import {
  invalidateWorldMeasurement,
  resolveDocumentWaterSection,
} from "@/lib/portfolio/world-state";
import LoadingVeil from "./LoadingVeil";

/**
 * Bootstrap + layout-invalidation path for `data-water-section`.
 * Liquid physics also publishes the same value every frame; this keeps nav
 * correct before the clock starts and after content reflows.
 */
function useWaterSection() {
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      document.documentElement.dataset.waterSection = resolveDocumentWaterSection();
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
 * Shared chrome for every portfolio route: reduced-motion-aware native scroll
 * (SmoothScrollProvider), the unified fluid canvas, and the floating nav.
 * Wrapping both `/` and `/project/[slug]` in this keeps the surface one
 * connected material system (a core PRODUCT.md principle).
 *
 * Pointer input uses the native cursor; the only pointer-driven visual is the
 * live ripple inside the fluid simulation (FluidScene).
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
  const siteMotionEnabled = motionPreference ?? true;
  const motionEnabled = !reducedMotion && siteMotionEnabled;
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
  useMagneticInteractions();

  useEffect(() => {
    const stored = window.localStorage.getItem("portfolio-motion");
    if (!reducedMotion && (stored === "on" || stored === "off")) {
      setMotionPreference(stored === "on");
    }
  }, [reducedMotion]);

  // Device tilt: allowed only while motion is on. Never request permission on
  // load — the first user gesture opts in via enableDeviceTiltFromGesture.
  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    setDeviceTiltAllowed(motionEnabled && coarse);
    if (!(motionEnabled && coarse)) return;

    let armed = false;
    const onFirstGesture = () => {
      if (armed) return;
      armed = true;
      void enableDeviceTiltFromGesture();
      window.removeEventListener("pointerdown", onFirstGesture);
    };
    window.addEventListener("pointerdown", onFirstGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onFirstGesture);
      setDeviceTiltAllowed(false);
    };
  }, [motionEnabled]);

  useEffect(() => () => {
    disposeDeviceTilt();
  }, []);

  const toggleMotion = () => {
    if (reducedMotion) return;
    setMotionPreference((current) => {
      const next = !(current ?? true);
      window.localStorage.setItem("portfolio-motion", next ? "on" : "off");
      return next;
    });
  };

  const motionState = useMemo(
    () => ({
      motionEnabled,
      reducedMotion: motionReduced,
      osReducedMotion: reducedMotion,
      siteMotionEnabled: !reducedMotion && siteMotionEnabled,
    }),
    [motionEnabled, motionReduced, reducedMotion, siteMotionEnabled],
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
          <a className="skip-link" href="#main-content">Skip to content</a>
          <ErrorBoundary>
            <FluidScene
              reducedMotion={motionReduced}
              staticMode={false}
              // The home hero owns the single WebGL title material. Case pages
              // keep the canvas ambient-only and use the static fallback path.
              heroName={renderHeroName}
            />
          </ErrorBoundary>

          {heroName ? <LoadingVeil /> : null}

          {showNav && <Navigation motionEnabled={motionEnabled} onToggleMotion={toggleMotion} />}

          {children}
        </div>
      </SmoothScrollProvider>
    </PortfolioMotionProvider>
  );
}
