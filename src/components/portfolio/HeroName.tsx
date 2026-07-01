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

  // Track cursor proximity to scale the displacement + blue glow
  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty("--cursor-x", `${x}px`);
    el.style.setProperty("--cursor-y", `${y}px`);
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    const proximity = Math.max(0, 1 - dist / (rect.width * 0.5));
    el.style.setProperty("--proximity", proximity.toFixed(3));
  };

  const handleLeave = () => {
    const el = wrapRef.current;
    if (!el) return;
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
        ELIEZER
      </span>
      <span className="hero-name-line" aria-hidden="true">
        RAPPEPORT
      </span>

      {/* Cursor-following blue glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(220px 140px at var(--cursor-x) var(--cursor-y), rgba(0,102,255,0.28), transparent 70%)",
          opacity: "calc(0.4 + var(--proximity) * 0.6)",
          mixBlendMode: "screen",
          transition: "opacity 220ms ease",
        }}
      />
    </motion.h1>
  );
}
