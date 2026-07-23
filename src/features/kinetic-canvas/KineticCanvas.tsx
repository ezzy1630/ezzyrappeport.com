"use client";

import { useEffect, useRef } from "react";
import {
  subscribeLiquidPhysics,
  getLiquidPhysics,
} from "./input/liquidInput";
import { resolveKineticQuality } from "./renderer/quality";
import { HERO_GLB_URL } from "./renderer/underwater/config";
import {
  crossfadeMsForVisit,
  nextBootPhase,
  readBootVisitKind,
  shouldEarlyFetchGlb,
  type HeroBootPhase,
} from "./boot/heroBootState";

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

    const visitKind = readBootVisitKind();
    const crossfadeMs = crossfadeMsForVisit(visitKind);
    container.style.setProperty("--boot-crossfade-ms", `${crossfadeMs}ms`);

    let bootPhase: HeroBootPhase = "poster";
    const setBoot = (phase: HeroBootPhase) => {
      bootPhase = phase;
      container.dataset.boot = phase;
    };
    setBoot("poster");

    const initialQuality = resolveKineticQuality(reducedMotion, staticMode);
    if (initialQuality.tier === "static") {
      container.dataset.fluid = "static";
      container.dataset.quality = "static";
      setBoot("static");
      return () => {
        delete container.dataset.fluid;
        delete container.dataset.quality;
        delete container.dataset.boot;
      };
    }

    let disposed = false;
    let cleanup = () => {};
    let rendererCanvas: HTMLCanvasElement | null = null;
    let unsubscribePhysics: (() => void) | null = null;
    let startTimer = 0;
    let idleCallback = 0;
    let crossfadeTimer = 0;

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
        setBoot("static");
        cleanup();
        cleanup = () => {};
        rendererCanvas?.remove();
        rendererCanvas = null;
        return;
      }

      container.dataset.fluid = "starting";
      setBoot(nextBootPhase(bootPhase, "chunk"));
      if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;

      const canvas = document.createElement("canvas");
      canvas.dataset.quality = quality.tier;
      canvas.style.opacity = "0";

      try {
        const markReady = () => {
          if (disposed) return;
          setBoot("hiddenFrame");
          // One complete hidden frame is already rendered by onReady; begin crossfade.
          requestAnimationFrame(() => {
            if (disposed) return;
            setBoot("crossfade");
            container.dataset.fluid = "ready";
            canvas.style.opacity = "1";
            if (heroNameRef.current) document.documentElement.dataset.heroRenderer = "ready";
            window.dispatchEvent(new Event("liquid-renderer-ready"));
            window.clearTimeout(crossfadeTimer);
            crossfadeTimer = window.setTimeout(() => {
              if (disposed) return;
              setBoot(heroNameRef.current ? "breach" : "live");
              window.setTimeout(() => {
                if (!disposed) setBoot("live");
              }, heroNameRef.current ? (visitKind === "repeat" ? 420 : 780) : 0);
            }, crossfadeMs);
          });
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
          setBoot("failed");
          if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
        };

        if (shouldEarlyFetchGlb(quality.tier, quality.saveData)) {
          void fetch(HERO_GLB_URL, { cache: "force-cache" }).catch(() => undefined);
        }

        setBoot("assets");
        const { startUnderwaterHeroRenderer } = await import(
          "./renderer/underwater/underwaterHeroRenderer"
        );
        if (disposed) {
          canvas.remove();
          return;
        }
        const rendererCleanup = startUnderwaterHeroRenderer({
          canvas,
          getPhysics,
          reducedMotionRef,
          staticModeRef,
          quality,
          renderHeroGlyphs: heroNameRef.current,
          onReady: markReady,
          onFailure: fail,
          onRecover: recover,
        });
        attachRenderer(canvas, rendererCleanup, "starting");
      } catch (error) {
        container.dataset.rendererError =
          error instanceof Error ? error.name : "RendererStartError";
        canvas.remove();
        container.dataset.fluid = "failed";
        setBoot("failed");
        if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
      }
    };

    const queueRendererStart = () => {
      const quality = resolveKineticQuality(reducedMotionRef.current, staticModeRef.current);
      container.dataset.fluid = quality.tier === "static" ? "static" : "poster";
      container.dataset.quality = quality.tier;
      if (quality.tier === "static") {
        setBoot("static");
        return;
      }
      // First paint → waterline cue, then load the renderer chunk.
      requestAnimationFrame(() => {
        if (disposed) return;
        setBoot("waterline");
        startTimer = window.setTimeout(() => {
          if ("requestIdleCallback" in window) {
            idleCallback = window.requestIdleCallback(() => {
              void startInteractiveRenderer();
            }, { timeout: 700 });
          } else {
            void startInteractiveRenderer();
          }
        }, quality.startDelayMs);
      });
    };

    unsubscribePhysics = subscribeLiquidPhysics((physics) => {
      currentPhysics = physics;
      if (container.dataset.fluid === "static") {
        if (!reducedMotionRef.current && !staticModeRef.current) {
          void startInteractiveRenderer();
        }
      }
    });

    queueRendererStart();

    return () => {
      disposed = true;
      window.clearTimeout(startTimer);
      window.clearTimeout(crossfadeTimer);
      if (idleCallback) window.cancelIdleCallback(idleCallback);
      cleanup();
      unsubscribePhysics?.();
      if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
      rendererCanvas?.remove();
      delete container.dataset.fluid;
      delete container.dataset.boot;
    };
  }, [reducedMotion, staticMode]);

  return <div ref={mountRef} className={`fluid-canvas ${className ?? ""}`} aria-hidden="true" />;
}
