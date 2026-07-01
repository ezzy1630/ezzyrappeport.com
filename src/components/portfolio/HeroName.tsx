"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

/**
 * HeroName
 * --------
 * The massive two-line "ELIEZER / RAPPEPORT" name that appears embedded
 * in the fluid simulation.
 *
 * Implementation strategy:
 *  - DOM text (semantic, accessible, screen-reader friendly)
 *  - WebKit background-clip:text with a vertical translucent-white gradient
 *    to fake the frosted-glass depth
 *  - Layered text-shadows: inner highlight + cool inner shadow + soft outer
 *    glow → suggests extruded, submerged lettering
 *  - SVG feTurbulence + feDisplacementMap filter (see <SvgFilters/>) applied
 *    on hover/near-cursor → live refraction distortion
 *  - Cursor-following blue radial glow (the "ripple origin" under RAPPEPORT)
 *
 * The letters don't literally displace the WebGPU fluid — that's a much
 * harder problem requiring SDF text in the GPU pipeline. Instead we lean on
 * CSS material properties that *read* as embedded-in-liquid, while keeping
 * the text accessible and crisp.
 */
export default function HeroName() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  // Track cursor proximity to scale the displacement + blue glow
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = wrapRef.current;
      if (!el) return;
      const { x: clientX, y: clientY } = pointerRef.current;
    const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
    el.style.setProperty("--cursor-x", `${x}px`);
    el.style.setProperty("--cursor-y", `${y}px`);
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const proximity = Math.max(0, 1 - dist / (rect.width * 0.5));
    el.style.setProperty("--proximity", proximity.toFixed(3));
    });
  };

  const handleLeave = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    el.style.setProperty("--proximity", "0");
  };

  return (
    <motion.h1
      ref={wrapRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="hero-name relative select-none w-full px-6 md:px-10 lg:px-14"
      style={{
        "--cursor-x": "50%",
        "--cursor-y": "50%",
        "--proximity": "0",
      } as React.CSSProperties}
      initial={{ opacity: 0, y: 30, filter: "blur(20px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Eliezer Rappeport"
    >
      <span className="hero-name-line" aria-hidden="true">
        <span data-text="ELIEZER">ELIEZER</span>
      </span>
      <span className="hero-name-line" aria-hidden="true">
        <span data-text="RAPPEPORT">RAPPEPORT</span>
      </span>

      {/* Cursor-following blue glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(240px 150px at var(--cursor-x) var(--cursor-y), rgba(0,102,255,0.20), rgba(102,168,255,0.08) 44%, transparent 72%)",
          opacity: "calc(0.28 + var(--proximity) * 0.45)",
          mixBlendMode: "screen",
          transition: "opacity 220ms ease",
        }}
      />
    </motion.h1>
  );
}
