"use client";

import { createContext, useContext } from "react";

export type PortfolioMotionState = {
  motionEnabled: boolean;
  reducedMotion: boolean;
};

const defaultMotionState: PortfolioMotionState = {
  motionEnabled: true,
  reducedMotion: false,
};

const PortfolioMotionContext = createContext<PortfolioMotionState>(defaultMotionState);

export function PortfolioMotionProvider({
  value,
  children,
}: { value: PortfolioMotionState; children: React.ReactNode }) {
  return <PortfolioMotionContext.Provider value={value}>{children}</PortfolioMotionContext.Provider>;
}

export function usePortfolioMotion() {
  return useContext(PortfolioMotionContext);
}
