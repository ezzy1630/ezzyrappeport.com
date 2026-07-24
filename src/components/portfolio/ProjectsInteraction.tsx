"use client";

import { useEffect } from "react";
import { subscribeFrameClock, unsubscribeFrameClock } from "@/lib/portfolio/frame-clock";
import {
  emitLiquidPress,
  emitLiquidWake,
} from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

const FLOAT_CLOCK_ID = "portfolio.project-float";
const MAX_TILT = 3;
const MAX_LIFT = 4;
const FLOAT_STIFFNESS = 220;
const FLOAT_DAMPING = 18;
const WAKE_INTERVAL_MS = 140;

type FloatEntry = {
  media: HTMLElement;
  inner: HTMLElement;
  hovering: boolean;
  tiltX: number;
  tiltY: number;
  lift: number;
  vTiltX: number;
  vTiltY: number;
  vLift: number;
  targetTiltX: number;
  targetTiltY: number;
  targetLift: number;
  lastWakeAt: number;
};

/**
 * ProjectsInteraction
 * -------------------
 * Turns the project index into objects suspended in the shared water.
 * The float spring clock binds only while media is hovered or springs settle.
 */
export default function ProjectsInteraction() {
  useEffect(() => {
    const section = document.getElementById("projects");
    if (!section) return;
    const rows = [...section.querySelectorAll<HTMLElement>("[data-project-row]")];
    if (rows.length === 0) return;

    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const floats = new Map<HTMLElement, FloatEntry>();
    let clockBound = false;

    const mediaCenter = (row: HTMLElement) => {
      const media = row.querySelector<HTMLElement>("[data-project-media]");
      if (!media) return null;
      const rect = media.getBoundingClientRect();
      if (rect.bottom < -80 || rect.top > window.innerHeight + 80) return null;
      return {
        x: rect.left + rect.width * 0.5,
        y: Math.max(24, Math.min(window.innerHeight - 24, rect.top + rect.height * 0.56)),
      };
    };

    const arrivalBand = (row: HTMLElement) => {
      const rect = row.getBoundingClientRect();
      return rect.top < window.innerHeight * 0.92 && rect.bottom > window.innerHeight * 0.05;
    };
    for (const row of rows) {
      row.dataset.resolved = arrivalBand(row) ? "true" : "false";
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = entry.target as HTMLElement;
          if (!entry.isIntersecting || row.dataset.resolved === "true") continue;
          row.dataset.resolved = "true";
          if (!readMotionPolicy().liquidAllowed) continue;
          const center = mediaCenter(row);
          if (center) {
            emitLiquidPress({ x: center.x, y: center.y, strength: 0.22, radius: 64 });
          }
        }
      },
      { rootMargin: "-14% 0px -14% 0px", threshold: 0.16 },
    );
    rows.forEach((row) => observer.observe(row));

    const applyFloatStyles = (entry: FloatEntry) => {
      entry.inner.style.willChange = "transform";
      entry.inner.style.setProperty("--float-tilt-x", `${entry.tiltX.toFixed(3)}deg`);
      entry.inner.style.setProperty("--float-tilt-y", `${entry.tiltY.toFixed(3)}deg`);
      entry.inner.style.setProperty("--float-lift", `${entry.lift.toFixed(3)}px`);
    };

    const clearFloatStyles = (entry: FloatEntry) => {
      entry.inner.style.removeProperty("--float-tilt-x");
      entry.inner.style.removeProperty("--float-tilt-y");
      entry.inner.style.removeProperty("--float-lift");
      entry.inner.style.willChange = "";
    };

    const ensureFloatClock = () => {
      if (clockBound || floats.size === 0) return;
      subscribeFrameClock(FLOAT_CLOCK_ID, tickFloat);
      clockBound = true;
    };

    const stopFloatClockIfIdle = () => {
      if (floats.size > 0) return;
      if (clockBound) {
        unsubscribeFrameClock(FLOAT_CLOCK_ID);
        clockBound = false;
      }
    };

    const registerFloat = (media: HTMLElement) => {
      if (floats.has(media)) return;
      const inner = media.querySelector<HTMLElement>("a") ?? media;
      floats.set(media, {
        media,
        inner,
        hovering: false,
        tiltX: 0,
        tiltY: 0,
        lift: 0,
        vTiltX: 0,
        vTiltY: 0,
        vLift: 0,
        targetTiltX: 0,
        targetTiltY: 0,
        targetLift: 0,
        lastWakeAt: 0,
      });
      ensureFloatClock();
    };

    const unregisterFloat = (media: HTMLElement) => {
      const entry = floats.get(media);
      if (!entry) return;
      clearFloatStyles(entry);
      floats.delete(media);
      stopFloatClockIfIdle();
    };

    const motionAllowed = () => finePointer && readMotionPolicy().effectsAllowed;

    const tickFloat = (_timeMs: number, deltaMs: number) => {
      if (!motionAllowed()) {
        for (const entry of floats.values()) {
          entry.targetTiltX = 0;
          entry.targetTiltY = 0;
          entry.targetLift = 0;
          entry.hovering = false;
        }
      }
      const dt = Math.min(32, Math.max(8, deltaMs)) / 1000;
      for (const [media, entry] of [...floats.entries()]) {
        const spring = FLOAT_STIFFNESS;
        const damp = FLOAT_DAMPING;
        const ax = (entry.targetTiltX - entry.tiltX) * spring - entry.vTiltX * damp;
        const ay = (entry.targetTiltY - entry.tiltY) * spring - entry.vTiltY * damp;
        const al = (entry.targetLift - entry.lift) * spring - entry.vLift * damp;
        entry.vTiltX += ax * dt;
        entry.vTiltY += ay * dt;
        entry.vLift += al * dt;
        entry.tiltX += entry.vTiltX * dt;
        entry.tiltY += entry.vTiltY * dt;
        entry.lift += entry.vLift * dt;

        if (
          !entry.hovering
          && Math.abs(entry.tiltX) < 0.02
          && Math.abs(entry.tiltY) < 0.02
          && Math.abs(entry.lift) < 0.02
          && Math.abs(entry.vTiltX) < 0.02
          && Math.abs(entry.vTiltY) < 0.02
          && Math.abs(entry.vLift) < 0.02
        ) {
          entry.tiltX = 0;
          entry.tiltY = 0;
          entry.lift = 0;
          entry.vTiltX = 0;
          entry.vTiltY = 0;
          entry.vLift = 0;
          unregisterFloat(media);
          continue;
        }
        applyFloatStyles(entry);
      }
    };

    let currentRow: HTMLElement | null = null;
    const onPointerOver = (event: PointerEvent) => {
      const row = (event.target as HTMLElement).closest?.("[data-project-row]") as HTMLElement | null;
      if (row === currentRow) return;
      const next = row && row.contains(event.target as Node) && (event.target as HTMLElement).closest("[data-project-media]")
        ? row
        : null;
      if (next && next !== currentRow && readMotionPolicy().liquidAllowed) {
        const nextCenter = mediaCenter(next);
        const previousCenter = currentRow ? mediaCenter(currentRow) : null;
        if (nextCenter && previousCenter) {
          emitLiquidWake({
            startX: previousCenter.x,
            startY: previousCenter.y,
            endX: nextCenter.x,
            endY: nextCenter.y,
            strength: 0.32,
            radius: 44,
          });
        } else if (nextCenter) {
          emitLiquidPress({ x: nextCenter.x, y: nextCenter.y, strength: 0.26, radius: 56 });
        }
      }
      if (next) currentRow = next;
      else if (currentRow && !row) currentRow = null;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!motionAllowed() || event.pointerType === "touch") return;
      const media = (event.target as HTMLElement).closest<HTMLElement>("[data-project-media]");
      if (!media) return;
      registerFloat(media);
      const entry = floats.get(media);
      if (!entry) return;
      entry.hovering = true;
      const rect = media.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const ny = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      entry.targetTiltY = nx * MAX_TILT;
      entry.targetTiltX = -ny * MAX_TILT * 0.72;
      entry.targetLift = MAX_LIFT;
      const now = performance.now();
      if (readMotionPolicy().liquidAllowed && now - entry.lastWakeAt > WAKE_INTERVAL_MS) {
        entry.lastWakeAt = now;
        emitLiquidWake({
          startX: event.clientX - nx * 18,
          startY: event.clientY - ny * 12,
          endX: event.clientX,
          endY: event.clientY,
          strength: 0.18 + Math.abs(nx) * 0.06,
          radius: 36,
        });
      }
    };

    const onPointerLeaveMedia = (event: PointerEvent) => {
      const media = (event.target as HTMLElement).closest<HTMLElement>("[data-project-media]");
      if (!media || !floats.has(media)) return;
      const related = event.relatedTarget;
      if (related instanceof Node && media.contains(related)) return;
      const entry = floats.get(media)!;
      entry.hovering = false;
      entry.targetTiltX = 0;
      entry.targetTiltY = 0;
      entry.targetLift = 0;
      ensureFloatClock();
    };

    const onPointerLeave = () => {
      currentRow = null;
    };

    section.addEventListener("pointerover", onPointerOver);
    section.addEventListener("pointermove", onPointerMove, { passive: true });
    section.addEventListener("pointerout", onPointerLeaveMedia);
    section.addEventListener("pointerleave", onPointerLeave);
    return () => {
      observer.disconnect();
      section.removeEventListener("pointerover", onPointerOver);
      section.removeEventListener("pointermove", onPointerMove);
      section.removeEventListener("pointerout", onPointerLeaveMedia);
      section.removeEventListener("pointerleave", onPointerLeave);
      if (clockBound) unsubscribeFrameClock(FLOAT_CLOCK_ID);
      for (const media of [...floats.keys()]) unregisterFloat(media);
    };
  }, []);

  return null;
}
