"use client";

import { useEffect } from "react";
import { subscribeFrameClock, unsubscribeFrameClock } from "./frame-clock";
import { usePortfolioMotion } from "@/components/portfolio/PortfolioMotionContext";

const CLOCK_ID = "portfolio.magnetic";
const ACTIVATION_RADIUS = 90;
const STIFFNESS = 340;
const DAMPING = 24;
const HOVER_SCALE = 1.02;
const PARALLAX_RATIO = 0.3;

type MagneticKind = "nav" | "button";

type MagneticEntry = {
  el: HTMLElement;
  label: HTMLElement | null;
  kind: MagneticKind;
  cx: number;
  cy: number;
  maxTranslate: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  scale: number;
  scaleV: number;
  targetTx: number;
  targetTy: number;
  targetScale: number;
  hovering: boolean;
  pointerX: number;
  pointerY: number;
};

const entries = new Map<HTMLElement, MagneticEntry>();
let pointerX = -9999;
let pointerY = -9999;
let pointerFine = false;
let motionOn = false;
let reducedMotion = false;
let clockBound = false;
let resizeObserver: ResizeObserver | null = null;

function magneticAllowed() {
  return pointerFine && motionOn && !reducedMotion;
}

function kindFor(element: HTMLElement): MagneticKind {
  return element.dataset.magnetic === "nav" ? "nav" : "button";
}

function maxTranslateFor(kind: MagneticKind) {
  return kind === "nav" ? 4 : 6;
}

function measureEntry(entry: MagneticEntry) {
  const rect = entry.el.getBoundingClientRect();
  entry.cx = rect.left + rect.width * 0.5;
  entry.cy = rect.top + rect.height * 0.5;
}

function setEnterCoords(element: HTMLElement, event: PointerEvent) {
  const rect = element.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
  const y = ((event.clientY - rect.top) / Math.max(rect.height, 1)) * 100;
  element.style.setProperty("--enter-x", `${x.toFixed(2)}%`);
  element.style.setProperty("--enter-y", `${y.toFixed(2)}%`);
}

function applyStyles(entry: MagneticEntry) {
  const { el, label, tx, ty, scale } = entry;
  el.style.setProperty("--mag-tx", `${tx.toFixed(3)}px`);
  el.style.setProperty("--mag-ty", `${ty.toFixed(3)}px`);
  el.style.setProperty("--mag-s", scale.toFixed(4));
  if (label) {
    label.style.setProperty("--mag-tx", `${(-tx * PARALLAX_RATIO).toFixed(3)}px`);
    label.style.setProperty("--mag-ty", `${(-ty * PARALLAX_RATIO).toFixed(3)}px`);
  }
}

function clearStyles(entry: MagneticEntry) {
  entry.el.style.removeProperty("--mag-tx");
  entry.el.style.removeProperty("--mag-ty");
  entry.el.style.removeProperty("--mag-s");
  entry.label?.style.removeProperty("--mag-tx");
  entry.label?.style.removeProperty("--mag-ty");
}

function registerElement(element: HTMLElement) {
  if (entries.has(element)) return;
  const kind = kindFor(element);
  const entry: MagneticEntry = {
    el: element,
    label: element.querySelector<HTMLElement>("[data-magnetic-label]"),
    kind,
    cx: 0,
    cy: 0,
    maxTranslate: maxTranslateFor(kind),
    tx: 0,
    ty: 0,
    vx: 0,
    vy: 0,
    scale: 1,
    scaleV: 0,
    targetTx: 0,
    targetTy: 0,
    targetScale: 1,
    hovering: false,
    pointerX: -9999,
    pointerY: -9999,
  };
  measureEntry(entry);
  entries.set(element, entry);
  ensureClock();
  resizeObserver?.observe(element);
}

function unregisterElement(element: HTMLElement) {
  const entry = entries.get(element);
  if (!entry) return;
  clearStyles(entry);
  entries.delete(element);
  resizeObserver?.unobserve(element);
  if (entries.size === 0) {
    unsubscribeFrameClock(CLOCK_ID);
    clockBound = false;
  }
}

function updateTargets(entry: MagneticEntry) {
  if (!magneticAllowed()) {
    entry.targetTx = 0;
    entry.targetTy = 0;
    entry.targetScale = 1;
    return;
  }

  const dx = pointerX - entry.cx;
  const dy = pointerY - entry.cy;
  const distance = Math.hypot(dx, dy);

  if (entry.hovering || distance < ACTIVATION_RADIUS) {
    const influence = entry.hovering
      ? 1
      : Math.max(0, 1 - distance / ACTIVATION_RADIUS);
    const nx = distance > 0.001 ? dx / distance : 0;
    const ny = distance > 0.001 ? dy / distance : 0;
    const pull = influence * entry.maxTranslate;
    entry.targetTx = nx * pull;
    entry.targetTy = ny * pull;
    entry.targetScale = entry.hovering ? HOVER_SCALE : 1 + (HOVER_SCALE - 1) * influence * 0.65;
  } else {
    entry.targetTx = 0;
    entry.targetTy = 0;
    entry.targetScale = 1;
  }
}

function tick(_timeMs: number, deltaMs: number) {
  if (entries.size === 0) return;
  const dt = Math.min(32, Math.max(8, deltaMs)) / 1000;
  const spring = STIFFNESS;
  const damp = DAMPING;

  for (const entry of entries.values()) {
    if (!magneticAllowed()) {
      entry.targetTx = 0;
      entry.targetTy = 0;
      entry.targetScale = 1;
    } else {
      updateTargets(entry);
    }

    const ax = (entry.targetTx - entry.tx) * spring - entry.vx * damp;
    const ay = (entry.targetTy - entry.ty) * spring - entry.vy * damp;
    entry.vx += ax * dt;
    entry.vy += ay * dt;
    entry.tx += entry.vx * dt;
    entry.ty += entry.vy * dt;

    const scaleDelta = entry.targetScale - entry.scale;
    entry.scaleV += (scaleDelta * spring - entry.scaleV * damp) * dt;
    entry.scale += entry.scaleV * dt;

    if (
      !magneticAllowed()
      && Math.abs(entry.tx) < 0.02
      && Math.abs(entry.ty) < 0.02
      && Math.abs(entry.scale - 1) < 0.001
    ) {
      entry.tx = 0;
      entry.ty = 0;
      entry.scale = 1;
      entry.vx = 0;
      entry.vy = 0;
      entry.scaleV = 0;
      clearStyles(entry);
      continue;
    }

    applyStyles(entry);
  }
}

function ensureClock() {
  if (clockBound || entries.size === 0) return;
  subscribeFrameClock(CLOCK_ID, tick);
  clockBound = true;
}

function onPointerMove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
}

function onPointerOver(event: PointerEvent) {
  const target = (event.target as Element).closest<HTMLElement>("[data-magnetic]");
  if (!target || !entries.has(target)) return;
  const entry = entries.get(target)!;
  entry.hovering = true;
  setEnterCoords(target, event);
}

function onPointerOut(event: PointerEvent) {
  const target = (event.target as Element).closest<HTMLElement>("[data-magnetic]");
  if (!target || !entries.has(target)) return;
  const related = event.relatedTarget;
  if (related instanceof Node && target.contains(related)) return;
  const entry = entries.get(target)!;
  entry.hovering = false;
}

function bindDocumentListeners() {
  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerover", onPointerOver, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
}

function unbindDocumentListeners() {
  document.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerover", onPointerOver);
  document.removeEventListener("pointerout", onPointerOut);
}

function observeElements(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[data-magnetic]").forEach(registerElement);
}

function scanMutations(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches("[data-magnetic]")) registerElement(node);
      observeElements(node);
    });
    mutation.removedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (entries.has(node)) unregisterElement(node);
      node.querySelectorAll<HTMLElement>("[data-magnetic]").forEach(unregisterElement);
    });
  }
}

export function useMagneticInteractions() {
  const { motionEnabled, reducedMotion: motionReduced } = usePortfolioMotion();

  useEffect(() => {
    reducedMotion = motionReduced;
    motionOn = motionEnabled;
    pointerFine = window.matchMedia("(pointer: fine)").matches;

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((observed) => {
        for (const target of observed) {
          const entry = entries.get(target.target as HTMLElement);
          if (entry) measureEntry(entry);
        }
      });
    }

    const motionRoot = document.querySelector(".portfolio-root");
    if (!motionRoot) return;

    observeElements(motionRoot);
    bindDocumentListeners();

    const mutationObserver = new MutationObserver(scanMutations);
    mutationObserver.observe(motionRoot, { childList: true, subtree: true });

    const onResize = () => {
      for (const entry of entries.values()) measureEntry(entry);
    };
    window.addEventListener("resize", onResize, { passive: true });

    const fineMedia = window.matchMedia("(pointer: fine)");
    const onFineChange = () => {
      pointerFine = fineMedia.matches;
    };
    fineMedia.addEventListener("change", onFineChange);

    if (entries.size > 0) ensureClock();

    return () => {
      mutationObserver.disconnect();
      window.removeEventListener("resize", onResize);
      fineMedia.removeEventListener("change", onFineChange);
      unbindDocumentListeners();
      for (const element of [...entries.keys()]) unregisterElement(element);
      resizeObserver?.disconnect();
      resizeObserver = null;
    };
  }, [motionEnabled, motionReduced]);
}
