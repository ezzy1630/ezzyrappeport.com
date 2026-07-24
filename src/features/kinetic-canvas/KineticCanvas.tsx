"use client";

import { useEffect, useRef } from "react";
import {
  subscribeLiquidPhysics,
  getLiquidPhysics,
} from "./input/liquidInput";
import { resolveKineticQuality } from "./renderer/quality";
import { HERO_GLB_URL } from "./renderer/underwater/assetUrls";
import {
  crossfadeMsForVisit,
  breachMsForVisit,
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

/**
 * Resolve reduced-motion before any renderer boot. The React prop can lag one
 * frame behind matchMedia / localStorage; starting animated then tearing down
 * flashes a live breach for motion-sensitive users.
 */
function resolveEffectiveReducedMotion(propReduced: boolean): boolean {
  if (propReduced) return true;
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  try {
    return window.localStorage.getItem("portfolio-motion") === "off";
  } catch {
    return false;
  }
}

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
    reducedMotionRef.current = resolveEffectiveReducedMotion(reducedMotion);
    staticModeRef.current = staticMode;
    heroNameRef.current = heroName;
  }, [reducedMotion, staticMode, heroName]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Prefer OS / stored preference over the possibly-stale first paint prop.
    reducedMotionRef.current = resolveEffectiveReducedMotion(reducedMotion);
    staticModeRef.current = staticMode;

    const visitKind = readBootVisitKind();
    const crossfadeMs = crossfadeMsForVisit(visitKind);
    container.style.setProperty("--boot-crossfade-ms", `${crossfadeMs}ms`);

    let bootPhase: HeroBootPhase = "poster";
    const setBoot = (phase: HeroBootPhase) => {
      bootPhase = phase;
      container.dataset.boot = phase;
    };
    setBoot("poster");

    const initialQuality = resolveKineticQuality(reducedMotionRef.current, staticMode);
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
    let breachTimer = 0;
    let startGeneration = 0;
    let startInFlight: Promise<void> | null = null;

    let currentPhysics = getLiquidPhysics();
    const getPhysics = () => currentPhysics;

    const clearBootTimers = () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(crossfadeTimer);
      window.clearTimeout(breachTimer);
      startTimer = 0;
      crossfadeTimer = 0;
      breachTimer = 0;
      if (idleCallback) {
        window.cancelIdleCallback(idleCallback);
        idleCallback = 0;
      }
    };

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

    const startInteractiveRenderer = (): Promise<void> => {
      if (disposed) return Promise.resolve();
      if (startInFlight) return startInFlight;

      const generation = ++startGeneration;
      startInFlight = (async () => {
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
            if (disposed || generation !== startGeneration) return;
            setBoot("hiddenFrame");
            // One complete hidden frame is already rendered by onReady; begin crossfade.
            requestAnimationFrame(() => {
              if (disposed || generation !== startGeneration) return;
              setBoot("crossfade");
              container.dataset.fluid = "ready";
              canvas.style.opacity = "1";
              if (heroNameRef.current) document.documentElement.dataset.heroRenderer = "ready";
              window.dispatchEvent(new Event("liquid-renderer-ready"));
              window.clearTimeout(crossfadeTimer);
              crossfadeTimer = window.setTimeout(() => {
                if (disposed || generation !== startGeneration) return;
                setBoot(heroNameRef.current ? "breach" : "live");
                const breachMs = heroNameRef.current ? breachMsForVisit(visitKind) : 0;
                window.clearTimeout(breachTimer);
                breachTimer = window.setTimeout(() => {
                  if (disposed || generation !== startGeneration) return;
                  setBoot("live");
                  // DOM copy reveals after the WebGL breach settles — not mid-crossfade.
                  window.dispatchEvent(new Event("hero-breach-complete"));
                }, breachMs);
              }, crossfadeMs);
            });
          };
          const recover = () => {
            if (disposed || generation !== startGeneration) return;
            if (startInFlight) return;
            container.dataset.fluid = "recovering";
            window.requestAnimationFrame(() => {
              if (!disposed && generation === startGeneration) void startInteractiveRenderer();
            });
          };
          const fail = (error: unknown) => {
            if (disposed || generation !== startGeneration) return;
            const message = error instanceof Error ? `${error.name}: ${error.message}` : "RendererLoadError";
            container.dataset.rendererError = message.slice(0, 240);
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
          if (disposed || generation !== startGeneration) {
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
          if (disposed || generation !== startGeneration) {
            canvas.remove();
            return;
          }
          container.dataset.rendererError =
            error instanceof Error ? error.name : "RendererStartError";
          canvas.remove();
          container.dataset.fluid = "failed";
          setBoot("failed");
          if (heroNameRef.current) delete document.documentElement.dataset.heroRenderer;
        }
      })().finally(() => {
        if (generation === startGeneration) startInFlight = null;
      });

      return startInFlight;
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
          // Defer chunk + GL compile past first contentful paint. Timeout keeps
          // the cinematic breach from stalling on busy main threads / LH TBT.
          if ("requestIdleCallback" in window) {
            idleCallback = window.requestIdleCallback(() => {
              void startInteractiveRenderer();
            }, { timeout: quality.tier === "high" ? 900 : 1400 });
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
      startGeneration += 1;
      clearBootTimers();
      startInFlight = null;
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
