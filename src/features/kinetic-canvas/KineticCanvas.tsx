"use client";

import { useEffect, useRef } from "react";
import {
  subscribeLiquidPhysics,
  getLiquidPhysics,
} from "./input/liquidInput";
import { resolveKineticQuality } from "./renderer/quality";

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

    const initialQuality = resolveKineticQuality(reducedMotion, staticMode);
    if (initialQuality.tier === "static") {
      container.dataset.fluid = "static";
      container.dataset.quality = "static";
      return () => {
        delete container.dataset.fluid;
        delete container.dataset.quality;
      };
    }

    let disposed = false;
    let cleanup = () => {};
    let rendererCanvas: HTMLCanvasElement | null = null;
    let unsubscribePhysics: (() => void) | null = null;
    let startTimer = 0;
    let idleCallback = 0;

    let currentPhysics = getLiquidPhysics();
    const getPhysics = () => currentPhysics;

    const attachRenderer = (
      canvas: HTMLCanvasElement,
      rendererCleanup: () => void,
      fluidState: "ready" | "starting" | "static",
    ) => {
      if (disposed) {
        rendererCleanup();
        canvas.remove();
        return;
      }
      cleanup();
      rendererCanvas?.remove();
      cleanup = rendererCleanup;
      rendererCanvas = canvas;
      container.appendChild(canvas);
      container.dataset.fluid = fluidState;
    };

    const startInteractiveRenderer = async () => {
      const quality = resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
      container.dataset.quality = quality.tier;
      if (quality.tier === "static") {
        if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
        container.dataset.fluid = "static";
        cleanup();
        cleanup = () => {};
        rendererCanvas?.remove();
        rendererCanvas = null;
        return;
      }

      container.dataset.fluid = "starting";
      if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;

      const canvas = document.createElement("canvas");
      canvas.dataset.quality = quality.tier;

      try {
        const useUnderwaterHero = heroNameRef.current
          && new URLSearchParams(window.location.search).get("heroRenderer") !== "legacy";
        const markReady = () => {
          if (!disposed) {
            container.dataset.fluid = "ready";
            if (heroNameRef.current) document.documentElement.dataset.heroRenderer = "ready";
          }
        };
        const recover = () => {
          if (disposed) return;
          container.dataset.fluid = "recovering";
          window.requestAnimationFrame(() => {
            if (!disposed) void startInteractiveRenderer();
          });
        };
        const fail = (error: unknown) => {
          if (disposed) return;
          container.dataset.rendererError = error instanceof Error ? error.name : "RendererLoadError";
          container.dataset.fluid = "failed";
          if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
        };
        let rendererCleanup: () => void;
        if (useUnderwaterHero) {
          const { startUnderwaterHeroRenderer } = await import(
            "./renderer/underwater/underwaterHeroRenderer"
          );
          if (disposed) {
            canvas.remove();
            return;
          }
          rendererCleanup = startUnderwaterHeroRenderer({
            canvas,
            getPhysics,
            reducedMotionRef,
            staticModeRef,
            quality,
            onReady: markReady,
            onFailure: fail,
            onRecover: recover,
          });
        } else {
          const { startFluidRenderer } = await import("./renderer/webglFluidRenderer");
          if (disposed) {
            canvas.remove();
            return;
          }
          rendererCleanup = startFluidRenderer(
            canvas,
            getPhysics,
            reducedMotionRef,
            staticModeRef,
            heroNameRef,
            quality,
            markReady,
            recover,
          );
        }
        attachRenderer(canvas, rendererCleanup, "starting");
      } catch (error) {
        container.dataset.rendererError =
          error instanceof Error ? error.name : "RendererStartError";
        canvas.remove();
        container.dataset.fluid = "failed";
        if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
      }
    };

    const queueRendererStart = () => {
      const quality = resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
      container.dataset.fluid = quality.tier === "static" ? "static" : "poster";
      container.dataset.quality = quality.tier;
      if (quality.tier === "static") return;
      startTimer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleCallback = window.requestIdleCallback(() => {
            void startInteractiveRenderer();
          }, { timeout: 700 });
        } else {
          void startInteractiveRenderer();
        }
      }, quality.startDelayMs);
    };

    unsubscribePhysics = subscribeLiquidPhysics((physics) => {
      currentPhysics = physics;
      if (container.dataset.fluid === "static") {
        // First frame after a static state — try (re)starting the renderer.
        if (!reducedMotionRef.current && !staticModeRef.current) {
          void startInteractiveRenderer();
        }
      }
    });

    queueRendererStart();

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      if (idleCallback) window.cancelIdleCallback(idleCallback);
      cleanup();
      unsubscribePhysics?.();
      if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
      rendererCanvas?.remove();
      delete container.dataset.fluid;
    };
  }, [reducedMotion, staticMode]);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
