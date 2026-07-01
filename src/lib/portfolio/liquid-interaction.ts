"use client";

export type LiquidPointerState = {
  x: number;
  y: number;
  active: boolean;
  speed: number;
  time: number;
};

export type LiquidRippleState = {
  x: number;
  y: number;
  intensity: number;
  time: number;
};

type PointerSubscriber = (state: LiquidPointerState) => void;
type RippleSubscriber = (state: LiquidRippleState) => void;

const pointerSubscribers = new Set<PointerSubscriber>();
const rippleSubscribers = new Set<RippleSubscriber>();

let pointerState: LiquidPointerState = {
  x: 0,
  y: 0,
  active: false,
  speed: 0,
  time: 0,
};

function setRootPointerVars(state: LiquidPointerState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--liquid-x", `${state.x}px`);
  root.style.setProperty("--liquid-y", `${state.y}px`);
  root.style.setProperty("--liquid-speed", state.speed.toFixed(3));
  root.style.setProperty("--liquid-active", state.active ? "1" : "0");
}

export function emitLiquidPointer(state: LiquidPointerState) {
  pointerState = state;
  setRootPointerVars(state);
  pointerSubscribers.forEach((subscriber) => subscriber(state));
}

export function emitLiquidRipple(state: LiquidRippleState) {
  rippleSubscribers.forEach((subscriber) => subscriber(state));
}

export function subscribeLiquidPointer(subscriber: PointerSubscriber) {
  pointerSubscribers.add(subscriber);
  subscriber(pointerState);
  return () => {
    pointerSubscribers.delete(subscriber);
  };
}

export function subscribeLiquidRipple(subscriber: RippleSubscriber) {
  rippleSubscribers.add(subscriber);
  return () => {
    rippleSubscribers.delete(subscriber);
  };
}
