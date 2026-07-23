"use client";

import { useEffect, type RefObject } from "react";
import { usePortfolioMotion } from "@/components/portfolio/PortfolioMotionContext";
import {
  emitLiquidPress,
  emitLiquidRipple,
  liquidEmissionAllowed,
} from "@/lib/portfolio/liquid-interaction";

type PersistentSurfaceOptions = Readonly<{
  intervalMs?: number;
  phaseOffsetMs?: number;
  strength?: number;
  radius?: number;
}>;

function rendererIsReady() {
  return Boolean(document.querySelector(".fluid-canvas[data-fluid=\"ready\"]"));
}

function isCoarsePointer(event: PointerEvent) {
  return event.pointerType === "touch"
    || window.matchMedia("(pointer: coarse)").matches;
}

function surfaceCenter(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
  };
}

function isElementInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight
    && rect.right > 0 && rect.left < window.innerWidth;
}

export function useLiquidHoverDialogue() {
  const { reducedMotion } = usePortfolioMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let current: HTMLElement | null = null;
    const targetFor = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest<HTMLElement>("a,button,[data-liquid-hover]");
    };

    const onPointerOver = (event: PointerEvent) => {
      if (isCoarsePointer(event)) return;
      const next = targetFor(event.target);
      if (!next || next === current) return;
      if (event.relatedTarget instanceof Node && next.contains(event.relatedTarget)) return;
      current = next;
      const center = surfaceCenter(next);
      emitLiquidPress({ x: center.x, y: center.y, strength: 0.2, radius: 30 });
    };

    const onPointerOut = (event: PointerEvent) => {
      if (isCoarsePointer(event)) return;
      const previous = targetFor(event.target);
      if (!previous || previous !== current) return;
      if (event.relatedTarget instanceof Node && previous.contains(event.relatedTarget)) return;
      current = null;
      const center = surfaceCenter(previous);
      emitLiquidRipple({
        x: center.x,
        y: center.y,
        intensity: 0.16,
        time: performance.now(),
        age: 0,
      });
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      current = null;
    };
  }, [reducedMotion]);
}

export function useLiquidPersistentSurface(
  ref: RefObject<HTMLElement | null>,
  {
    intervalMs = 2400,
    phaseOffsetMs = 0,
    strength = 0.2,
    radius = 42,
  }: PersistentSurfaceOptions = {},
) {
  const { reducedMotion } = usePortfolioMotion();

  useEffect(() => {
    const element = ref.current;
    if (!element || reducedMotion) return;

    let disposed = false;
    let visible = false;
    let timer = 0;
    let bootstrapVisibilityTimer = 0;
    let observer: IntersectionObserver | null = null;

    // The renderer child effect can publish readiness before this parent hook's
    // effect subscribes. Read the marker as well as listening for the event so
    // a ready hero cannot strand a persistent surface in a silent state.
    const readyAtMount = rendererIsReady();
    const visibleAtMount = isElementInViewport(element);

    const cancel = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
    };

    const canEmit = () => !disposed && liquidEmissionAllowed({
      visible,
      pageVisible: !document.hidden,
      reducedMotion,
      rendererReady: rendererIsReady(),
    });

    const schedule = (delay: number) => {
      cancel();
      if (!canEmit()) return;
      timer = window.setTimeout(() => {
        timer = 0;
        if (canEmit()) {
          const center = surfaceCenter(element);
          emitLiquidPress({ x: center.x, y: center.y, strength, radius });
          const emissionCount = Number(element.dataset.liquidPersistentEmissions ?? 0) + 1;
          element.dataset.liquidPersistentEmissions = String(emissionCount);
          schedule(intervalMs);
        }
      }, Math.max(0, delay));
    };

    const setVisible = (next: boolean) => {
      if (visible === next) return;
      visible = next;
      if (visible) schedule(phaseOffsetMs);
      else cancel();
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
        { threshold: 0.12 },
      );
      observer.observe(element);
    } else {
      setVisible(true);
    }

    const onVisibilityChange = () => {
      if (document.hidden) cancel();
      else if (visible) schedule(phaseOffsetMs);
    };
    const onRendererReady = () => {
      if (visible) schedule(phaseOffsetMs);
    };
    const onViewportChange = () => setVisible(isElementInViewport(element));
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("liquid-renderer-ready", onRendererReady);
    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });

    // Re-check after listeners/observation are installed. The renderer may
    // have become ready between effect setup and this point.
    if (readyAtMount || rendererIsReady()) setVisible(visibleAtMount);
    else if (!observer) setVisible(true);
    // Hash scrolling and hydration can settle after both effects have run.
    // One bounded re-check closes that race without creating a polling loop.
    bootstrapVisibilityTimer = window.setTimeout(onViewportChange, 250);

    return () => {
      disposed = true;
      cancel();
      if (bootstrapVisibilityTimer) window.clearTimeout(bootstrapVisibilityTimer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("liquid-renderer-ready", onRendererReady);
      window.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [intervalMs, phaseOffsetMs, radius, reducedMotion, ref, strength]);
}
