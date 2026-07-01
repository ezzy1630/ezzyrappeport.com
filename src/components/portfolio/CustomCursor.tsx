"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * CustomCursor
 * ------------
 * Replaces the native cursor with a soft electric-blue dot + ring.
 * On hover over interactive elements ([data-cursor="hover"]) the ring expands.
 * Hidden entirely on coarse-pointer devices and when prefers-reduced-motion.
 *
 * Note: the actual *fluid* ripple from the cursor is handled by the
 * FluidBackground's pointer listener. This component only renders the visual
 * cursor element.
 */
export default function CustomCursor({
  disabled,
}: {
  disabled: boolean;
}) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 220, damping: 26, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 220, damping: 26, mass: 0.6 });

  useEffect(() => {
    if (disabled) return;

    let raf = 0;
    let pendingX = -100;
    let pendingY = -100;

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          x.set(pendingX);
          y.set(pendingY);
          raf = 0;
        });
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${pendingX - 5.5}px, ${pendingY - 5.5}px)`;
      }
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      const interactive = t.closest('a, button, [data-cursor="hover"], input, textarea, [tabindex]');
      if (ringRef.current) {
        if (interactive) {
          ringRef.current.style.width = "60px";
          ringRef.current.style.height = "60px";
          ringRef.current.style.opacity = "0.62";
        } else {
          ringRef.current.style.width = "88px";
          ringRef.current.style.height = "88px";
          ringRef.current.style.opacity = "0.34";
        }
      }
    };

    const onLeave = () => {
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };
    const onEnter = () => {
      if (dotRef.current) dotRef.current.style.opacity = "1";
      if (ringRef.current) ringRef.current.style.opacity = "0.34";
    };

    document.body.classList.add("custom-cursor-active");
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      document.body.classList.remove("custom-cursor-active");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [disabled, x, y]);

  if (disabled) return null;

  return (
    <>
      <div ref={dotRef} className="custom-cursor" aria-hidden="true" style={{ opacity: 0 }} />
      <motion.div
        ref={ringRef}
        className="custom-cursor-ring"
        aria-hidden="true"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
          opacity: 0,
        }}
      />
    </>
  );
}
