"use client";

import { useEffect, useRef } from "react";
import {
  subscribeLiquidPhysics,
  getLiquidPhysics,
} from "./input/liquidInput";
import { startFluidRenderer } from "./renderer/webglFluidRenderer";

type Props = {
  reducedMotion?: boolean;
  staticMode?: boolean;
  heroName?: boolean;
  className?: string;
};

export default function KineticCanvas({
  reducedMotion = false,
  staticMode = false,
  heroName = true,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(reducedMotion);
  const staticModeRef = useRef(staticMode);
  const heroNameRef = useRef(heroName);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    staticModeRef.current = staticMode;
    heroNameRef.current = heroName;
  }, [reducedMotion, staticMode, heroName]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let cleanup = () => {};
    let rendererCanvas: HTMLCanvasElement | null = null;
    let unsubscribePhysics: (() => void) | null = null;

    let currentPhysics = getLiquidPhysics();
    const getPhysics = () => currentPhysics;

    const attachRenderer = (
      canvas: HTMLCanvasElement,
      rendererCleanup: () => void,
      fluidState: "ready" | "static",
    ) => {
      if (disposed) {
        rendererCleanup();
        canvas.remove();
        return;
      }
      cleanup();
      cleanup = rendererCleanup;
      rendererCanvas = canvas;
      container.appendChild(canvas);
      container.dataset.fluid = fluidState;
    };

    const startInteractiveRenderer = () => {
      const frozen = reducedMotionRef.current || staticModeRef.current;
      container.dataset.fluid = frozen ? "static" : "starting";

      const canvas = document.createElement("canvas");
      canvas.dataset.renderer = "webgl2-fluid";

      try {
        const rendererCleanup = startFluidRenderer(canvas, getPhysics, reducedMotionRef, staticModeRef, heroNameRef);
        attachRenderer(canvas, rendererCleanup, frozen ? "static" : "ready");
      } catch (error) {
        console.warn("Fluid renderer failed to start", error);
        canvas.remove();
        container.dataset.fluid = "failed";
      }
    };

    unsubscribePhysics = subscribeLiquidPhysics((physics) => {
      currentPhysics = physics;
      if (container.dataset.fluid === "static") {
        // First frame after a static state — try (re)starting the renderer.
        if (!reducedMotionRef.current && !staticModeRef.current) {
          startInteractiveRenderer();
        }
      }
    });

    startInteractiveRenderer();

    return () => {
      disposed = true;
      cleanup();
      unsubscribePhysics?.();
      rendererCanvas?.remove();
      delete container.dataset.fluid;
    };
  }, [reducedMotion, staticMode]);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
