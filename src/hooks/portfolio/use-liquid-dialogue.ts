"use client";

import { useEffect, type RefObject } from "react";
import { usePortfolioMotion } from "@/components/portfolio/PortfolioMotionContext";
import {
  emitLiquidPress,
  emitLiquidRipple,
  liquidEmissionAllowed,
} from "@/lib/portfolio/liquid-interaction";
import { playSound } from "@/lib/portfolio/sound";

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

function targetFor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>("a,button,[data-liquid-hover]");
}

function isSoundTarget(element: HTMLElement) {
  return element.matches(
    ".site-nav-links a, .site-nav-cta, [data-magnetic=\"cta\"], [data-sound-hover]",
  );
}

function isPillFillTarget(element: HTMLElement) {
  return element.matches(
    ".site-nav-cta, [data-magnetic=\"cta\"], [data-pill-fill]",
  ) || element.classList.contains("cta");
}

function pressIntensity(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const area = rect.width * rect.height;
  return Math.max(0.2, Math.min(1, area / 12000));
}

function setEnterCoords(element: HTMLElement, event: PointerEvent) {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  element.style.setProperty("--enter-x", `${x.toFixed(2)}%`);
  element.style.setProperty("--enter-y", `${y.toFixed(2)}%`);
}

export function useLiquidHoverDialogue() {
  const { reducedMotion, motionEnabled } = usePortfolioMotion();

  useEffect(() => {
    if (reducedMotion) return;

    let current: HTMLElement | null = null;

    const onPointerOver = (event: PointerEvent) => {
      if (isCoarsePointer(event)) return;
      const next = targetFor(event.target);
      if (!next || next === current) return;
      if (event.relatedTarget instanceof Node && next.contains(event.relatedTarget)) return;
      current = next;
      const center = surfaceCenter(next);
      emitLiquidPress({ x: center.x, y: center.y, strength: 0.2, radius: 30 });
      if (motionEnabled && isSoundTarget(next)) {
        playSound("hover");
      }
      if (isPillFillTarget(next)) {
        setEnterCoords(next, event);
      }
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

    const onPointerDown = (event: PointerEvent) => {
      const element = targetFor(event.target);
      if (!element) return;
      // Coarse: no hover path — tap still sets enter coords + press sound so
      // pill fills and CTAs acknowledge the finger without hover-only cues.
      if (isPillFillTarget(element)) {
        setEnterCoords(element, event);
      }
      if (isCoarsePointer(event)) {
        if (motionEnabled && (isSoundTarget(element) || element.matches("[data-magnetic]"))) {
          playSound("press", { intensity: pressIntensity(element) });
        }
        return;
      }
      const center = surfaceCenter(element);
      emitLiquidPress({
        x: center.x,
        y: center.y,
        strength: 0.28 + pressIntensity(element) * 0.18,
        radius: 34 + pressIntensity(element) * 18,
      });
      if (isSoundTarget(element) || element.matches("[data-magnetic]")) {
        playSound("press", { intensity: pressIntensity(element) });
      }
    };

    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      current = null;
    };
  }, [motionEnabled, reducedMotion]);
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

    if (readyAtMount || rendererIsReady()) setVisible(visibleAtMount);
    else if (!observer) setVisible(true);
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
