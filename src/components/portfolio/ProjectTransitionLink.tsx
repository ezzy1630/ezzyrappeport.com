"use client";

import { useRef, type ComponentProps } from "react";
import Link from "next/link";
import { emitLiquidPress, emitLiquidWake, getLiquidPhysics } from "@/lib/portfolio/liquid-interaction";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  transitionName?: string;
  transitionDirection?: "forward" | "back";
};

function emitTransitionWake(element: HTMLElement, direction: "forward" | "back") {
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
  const rect = element.getBoundingClientRect();
  const targetX = rect.left + rect.width * 0.5;
  const targetY = rect.top + rect.height * 0.5;
  emitLiquidPress({
    x: targetX,
    y: targetY,
    strength: 0.16,
    radius: Math.max(24, Math.min(52, rect.width * 0.14)),
  });
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
  return (
    <Link
      {...props}
      href={href}
      data-liquid-hover
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        pointerDownRef.current = event.pointerType !== "touch";
        if (pointerDownRef.current) emitTransitionWake(event.currentTarget, transitionDirection);
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        pointerDownRef.current = false;
      }}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          // Keyboard activation has no pointerdown; preserve the wake there,
          // while pointer activation gets one wake plus one arrival press.
          if (!pointerDownRef.current) emitTransitionWake(event.currentTarget, transitionDirection);
          emitTransitionPress(event.currentTarget);
        }
        pointerDownRef.current = false;
      }}
      style={{ ...style, viewTransitionName: transitionName }}
    >
      {children}
    </Link>
  );
}
