"use client";

import { createContext, useContext, useMemo } from "react";
import { createMotionPolicy, type MotionPolicy } from "@/lib/portfolio/motion-policy";

export type PortfolioMotionState = {
  /** Combined: site toggle on and OS not reduced */
  motionEnabled: boolean;
  /** True when effects should not run (OS PRM or site off) */
  reducedMotion: boolean;
  /** Live typed policy used by arrivals, liquid, sound, choreography */
  policy: MotionPolicy;
};

const defaultMotionState: PortfolioMotionState = {
  motionEnabled: true,
  reducedMotion: false,
  policy: createMotionPolicy({ osReducedMotion: false, siteMotionEnabled: true }),
};

const PortfolioMotionContext = createContext<PortfolioMotionState>(defaultMotionState);

export function PortfolioMotionProvider({
  value,
  children,
}: {
  value: {
    motionEnabled: boolean;
    reducedMotion: boolean;
    osReducedMotion: boolean;
    siteMotionEnabled: boolean;
  };
  children: React.ReactNode;
}) {
  const merged = useMemo<PortfolioMotionState>(() => ({
    motionEnabled: value.motionEnabled,
    reducedMotion: value.reducedMotion,
    policy: createMotionPolicy({
      osReducedMotion: value.osReducedMotion,
      siteMotionEnabled: value.siteMotionEnabled,
    }),
  }), [value]);

  return <PortfolioMotionContext.Provider value={merged}>{children}</PortfolioMotionContext.Provider>;
}

export function usePortfolioMotion() {
  return useContext(PortfolioMotionContext);
}
