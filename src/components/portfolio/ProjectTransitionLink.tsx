"use client";

import { useRef, type ComponentProps } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { emitLiquidPress, emitLiquidWake, getLiquidPhysics } from "@/lib/portfolio/liquid-interaction";
import { readMotionPolicy } from "@/lib/portfolio/motion-policy";

type DiveDirection = "forward" | "back";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  transitionName?: string;
  transitionDirection?: DiveDirection;
};

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => void;
};

const WATER_WIPE_MS = 720;
let activeWipeTimer: number | null = null;

function emitTransitionWake(element: HTMLElement, direction: DiveDirection) {
  if (!readMotionPolicy().liquidAllowed) return;
  const rect = element.getBoundingClientRect();
  const targetX = rect.left + rect.width * 0.5;
  const targetY = rect.top + rect.height * 0.5;
  const pointer = getLiquidPhysics().pointer;
  const startX = pointer.present ? pointer.x : targetX;
  const startY = pointer.present
    ? pointer.y
    : targetY + (direction === "forward" ? 34 : -34);
  emitLiquidWake({
    startX,
    startY,
    endX: targetX,
    endY: targetY,
    strength: 0.28,
    radius: Math.max(26, Math.min(58, rect.width * 0.18)),
  });
}

function emitTransitionPress(element: HTMLElement) {
  if (!readMotionPolicy().liquidAllowed) return;
  const rect = element.getBoundingClientRect();
  emitLiquidPress({
    x: rect.left + rect.width * 0.5,
    y: rect.top + rect.height * 0.5,
    strength: 0.16,
    radius: Math.max(24, Math.min(52, rect.width * 0.14)),
  });
}

/** Sets a short-lived CSS wipe on <html>; cleared after WATER_WIPE_MS. */
export function playWaterWipe(direction: DiveDirection) {
  const root = document.documentElement;
  root.dataset.waterWipe = direction;
  if (activeWipeTimer !== null) window.clearTimeout(activeWipeTimer);
  activeWipeTimer = window.setTimeout(() => {
    activeWipeTimer = null;
    if (root.dataset.waterWipe === direction) delete root.dataset.waterWipe;
  }, WATER_WIPE_MS);
}

export function canStartViewTransition(): boolean {
  if (typeof document === "undefined") return false;
  if (!("startViewTransition" in document)) return false;
  if (!readMotionPolicy().effectsAllowed) return false;
  return true;
}

function runDiveNavigation(navigate: () => void): void {
  if (!canStartViewTransition()) {
    navigate();
    return;
  }
  (document as DocumentWithViewTransition).startViewTransition?.(navigate);
}

export function navigateWithDive(
  router: { push: (href: string) => void },
  href: string,
  direction: DiveDirection = "forward",
): void {
  playWaterWipe(direction);
  runDiveNavigation(() => {
    router.push(href);
  });
}

function styleWithTransitionName(
  style: React.CSSProperties | undefined,
  transitionName: string | undefined,
): React.CSSProperties | undefined {
  if (!transitionName) return style;
  return { ...style, viewTransitionName: transitionName };
}

export default function ProjectTransitionLink({
  href,
  transitionName,
  transitionDirection = "forward",
  style,
  children,
  onPointerEnter,
  onPointerDown,
  onPointerCancel,
  onClick,
  ...props
}: Props) {
  const pointerDownRef = useRef(false);
  const router = useRouter();

  return (
    <Link
      {...props}
      href={href}
      data-liquid-hover
      style={styleWithTransitionName(style, transitionName)}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const isFinePointer = event.pointerType !== "touch";
        pointerDownRef.current = isFinePointer;
        if (isFinePointer) emitTransitionWake(event.currentTarget, transitionDirection);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        pointerDownRef.current = false;
      }}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        if (!pointerDownRef.current) {
          emitTransitionWake(event.currentTarget, transitionDirection);
        }
        emitTransitionPress(event.currentTarget);
        playWaterWipe(transitionDirection);

        if (canStartViewTransition()) {
          event.preventDefault();
          runDiveNavigation(() => {
            router.push(href);
          });
        }

        pointerDownRef.current = false;
      }}
    >
      {children}
    </Link>
  );
}
