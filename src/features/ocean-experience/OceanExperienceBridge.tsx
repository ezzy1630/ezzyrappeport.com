"use client";

/**
 * OceanExperienceBridge
 * ---------------------
 * Milestone 0 runtime owner mount: attaches the sole ScrollDirector for journey
 * geometry + water-section chrome, without changing visible homepage layout.
 * KineticCanvas remains the live renderer until later milestones migrate it.
 */

import { useEffect, useRef } from "react";
import { createScrollDirector } from "./scroll/ScrollDirector.ts";
import { setActiveScrollDirector, getActiveScrollDirector } from "./scroll/active-scroll-director.ts";
import { installExperienceDebugApi } from "./diagnostics/experience-debug.ts";
import { hydratePreferencesStore, setPreferences } from "./state/preferences-store.ts";
import { resetExperienceStore } from "./state/experience-store.ts";
import { invalidateWorldMeasurement } from "../../lib/portfolio/world-state.ts";

export { getActiveScrollDirector } from "./scroll/active-scroll-director.ts";

export default function OceanExperienceBridge() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root =
      document.querySelector<HTMLElement>(".portfolio-root")
      ?? rootRef.current
      ?? document.documentElement;

    hydratePreferencesStore();
    // Bridge legacy portfolio-motion toggle into ocean prefs so M0 does not
    // introduce a conflicting motion source of truth.
    try {
      const legacyMotion = window.localStorage.getItem("portfolio-motion");
      if (legacyMotion === "off") setPreferences({ motion: "off" });
      else if (legacyMotion === "on") setPreferences({ motion: "full" });
    } catch {
      /* ignore */
    }
    const director = createScrollDirector({ root });
    setActiveScrollDirector(director);
    director.attach();
    const uninstallDebug = installExperienceDebugApi(director);

    // Content reflows (fonts, images) must invalidate measured world knots.
    // Owned here so PortfolioShell does not add a competing scroll listener.
    const layoutRoot = document.querySelector<HTMLElement>(".content-layer");
    const layoutObserver =
      typeof ResizeObserver === "undefined" || !layoutRoot
        ? null
        : new ResizeObserver(() => {
            invalidateWorldMeasurement();
            director.requestSample();
          });
    if (layoutObserver && layoutRoot) layoutObserver.observe(layoutRoot);

    return () => {
      layoutObserver?.disconnect();
      uninstallDebug();
      director.dispose();
      if (getActiveScrollDirector() === director) setActiveScrollDirector(null);
      resetExperienceStore();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="ocean-experience-bridge"
      hidden
      aria-hidden="true"
      data-ocean-bridge="attached"
    />
  );
}
