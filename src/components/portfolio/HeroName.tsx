"use client";

import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  subscribeLiquidPointer,
  subscribeLiquidRipple,
} from "@/lib/portfolio/liquid-interaction";

const HERO_LINES = ["ELIEZER", "RAPPEPORT"] as const;

const LETTER_WIDTH: Record<string, number> = {
  A: 86,
  E: 82,
  I: 42,
  L: 74,
  O: 92,
  P: 82,
  R: 88,
  T: 78,
  Z: 84,
};

function WaterLetter({
  char,
  lineIndex,
  charIndex,
}: {
  char: string;
  lineIndex: number;
  charIndex: number;
}) {
  const width = LETTER_WIDTH[char] ?? 84;
  const ratio = width / 126;
  const id = `hero-water-${lineIndex}-${charIndex}-${char}`;

  return (
    <span
      className="hero-letter"
      style={
        {
          "--letter-ratio": ratio.toFixed(4),
          "--letter-phase": `${(lineIndex * 7 + charIndex) * -0.42}s`,
        } as React.CSSProperties
      }
      aria-hidden="true"
    >
      <svg
        className="hero-letter-svg"
        viewBox={`0 0 ${width} 126`}
        preserveAspectRatio="xMidYMid meet"
        focusable="false"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="34%" stopColor="#eef5ff" stopOpacity="0.78" />
            <stop offset="70%" stopColor="#afc2df" stopOpacity="0.54" />
            <stop offset="100%" stopColor="#f8fbff" stopOpacity="0.80" />
          </linearGradient>
          <radialGradient id={`${id}-lens`} cx="68%" cy="67%" r="62%">
            <stop offset="0%" stopColor="#5b97ff" stopOpacity="0.20" />
            <stop offset="48%" stopColor="#d9e8ff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-swim`} x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.018"
              numOctaves="2"
              seed={`${lineIndex * 11 + charIndex + 5}`}
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="0.7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <g
          className="hero-letter-glyph"
          filter={`url(#${id}-swim)`}
          style={{ animationDelay: `var(--letter-phase)` }}
        >
          <text className="hero-letter-depth" x="50%" y="92">
            {char}
          </text>
          <text className="hero-letter-body" x="50%" y="92" fill={`url(#${id}-body)`}>
            {char}
          </text>
          <text className="hero-letter-lens" x="50%" y="92" fill={`url(#${id}-lens)`}>
            {char}
          </text>
          <text className="hero-letter-meniscus" x="50%" y="92">
            {char}
          </text>
          <text className="hero-letter-trough" x="50%" y="92">
            {char}
          </text>
        </g>
      </svg>
    </span>
  );
}

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
  const wrapRef = useRef<HTMLHeadingElement>(null);
  const rafRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const unsubscribePointer = subscribeLiquidPointer((state) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = state.x - rect.left;
      const y = state.y - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const proximity = Math.max(0, 1 - dist / (rect.width * 0.62));

      el.style.setProperty("--cursor-x", `${x}px`);
      el.style.setProperty("--cursor-y", `${y}px`);
      el.style.setProperty("--proximity", proximity.toFixed(3));
      el.style.setProperty("--liquid-local-speed", Math.min(state.speed, 1.6).toFixed(3));
    });

    const unsubscribeRipple = subscribeLiquidRipple((state) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = state.x - rect.left;
      const y = state.y - rect.top;
      const inside =
        x > -rect.width * 0.1 &&
        x < rect.width * 1.1 &&
        y > -rect.height * 0.25 &&
        y < rect.height * 1.25;

      if (!inside) return;
      el.style.setProperty("--ripple-x", `${x}px`);
      el.style.setProperty("--ripple-y", `${y}px`);
      el.style.setProperty("--ripple-strength", Math.min(1, state.intensity).toFixed(3));
      window.setTimeout(() => {
        if (wrapRef.current === el) el.style.setProperty("--ripple-strength", "0");
      }, 700);
    });

    return () => {
      unsubscribePointer();
      unsubscribeRipple();
    };
  }, []);

  const handleMove = (e: React.PointerEvent<HTMLHeadingElement>) => {
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
      const proximity = Math.max(0, 1 - dist / (rect.width * 0.58));
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
        "--ripple-x": "50%",
        "--ripple-y": "50%",
        "--ripple-strength": "0",
        "--liquid-local-speed": "0",
      } as React.CSSProperties}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Eliezer Rappeport"
    >
      <span aria-hidden="true" className="hero-name-ripple-field" />
      <span aria-hidden="true" className="hero-name-caustic-field" />
      {HERO_LINES.map((line, lineIndex) => (
        <span className="hero-name-line" aria-hidden="true" key={line}>
          {Array.from(line).map((char, charIndex) => (
            <WaterLetter
              key={`${line}-${charIndex}-${char}`}
              char={char}
              lineIndex={lineIndex}
              charIndex={charIndex}
            />
          ))}
        </span>
      ))}

      {/* Cursor-following blue glow */}
      <span aria-hidden="true" className="hero-name-pointer-glow" />
    </motion.h1>
  );
}
