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
  const line = HERO_LINES[lineIndex];
  const progress = line.length <= 1 ? 0 : charIndex / (line.length - 1);
  const blueBias = lineIndex === 1 ? Math.max(0.18, progress ** 1.55) : Math.max(0, progress - 0.62) * 0.35;

  return (
    <span
      className="hero-letter"
      style={
        {
          "--letter-ratio": ratio.toFixed(4),
          "--letter-phase": `${(lineIndex * 7 + charIndex) * -0.42}s`,
          "--letter-blue": blueBias.toFixed(3),
          "--letter-line-weight": lineIndex === 1 ? "1" : "0",
          "--letter-hot": "0",
          "--letter-ripple": "0",
          "--letter-push-x": "0px",
          "--letter-push-y": "0px",
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
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
            <stop offset="18%" stopColor="#eef6ff" stopOpacity="0.90" />
            <stop offset="46%" stopColor="#aebdd2" stopOpacity="0.82" />
            <stop offset="70%" stopColor="#d7e5f4" stopOpacity="0.86" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id={`${id}-specular`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="24%" stopColor="#ffffff" stopOpacity="0.50" />
            <stop offset="54%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
            <stop offset="43%" stopColor="#8ec6ff" stopOpacity="0.66" />
            <stop offset="78%" stopColor="#ffffff" stopOpacity="0.78" />
          </linearGradient>
          <radialGradient id={`${id}-lens`} cx="68%" cy="67%" r="62%">
            <stop offset="0%" stopColor="#73b5ff" stopOpacity={0.18 + blueBias * 0.18} />
            <stop offset="48%" stopColor="#f3f8ff" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-swim`} x="-18%" y="-18%" width="136%" height="136%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.010 0.016"
              numOctaves="2"
              seed={`${lineIndex * 11 + charIndex + 5}`}
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.009 0.014;0.013 0.019;0.009 0.014"
                dur="12s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feMorphology in="SourceGraphic" operator="dilate" radius="0.45" result="inflated" />
            <feDisplacementMap
              in="inflated"
              in2="noise"
              scale="5.1"
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
          <text className="hero-letter-ridge" x="50%" y="92">
            {char}
          </text>
          <text className="hero-letter-volume" x="50%" y="92">
            {char}
          </text>
          <text className="hero-letter-body" x="50%" y="92" fill={`url(#${id}-body)`}>
            {char}
          </text>
          <text className="hero-letter-caustic" x="50%" y="92" fill={`url(#${id}-lens)`}>
            {char}
          </text>
          <text className="hero-letter-specular" x="50%" y="92" fill={`url(#${id}-specular)`}>
            {char}
          </text>
          <text className="hero-letter-meniscus" x="50%" y="92">
            {char}
          </text>
          <text className="hero-letter-edge" x="50%" y="92" stroke={`url(#${id}-edge)`}>
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

  const updateLetters = (el: HTMLElement, clientX: number, clientY: number, source: "pointer" | "ripple") => {
    const letters = el.querySelectorAll<HTMLElement>(".hero-letter");
    for (const letter of letters) {
      const rect = letter.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - clientX;
      const dy = cy - clientY;
      const dist = Math.hypot(dx, dy);
      const radius = Math.max(rect.width, rect.height) * (source === "ripple" ? 1.75 : 1.28);
      const value = Math.max(0, 1 - dist / radius);
      letter.style.setProperty(source === "ripple" ? "--letter-ripple" : "--letter-hot", value.toFixed(3));
      if (source === "pointer") {
        const safeDist = Math.max(dist, 1);
        const push = value ** 1.45;
        letter.style.setProperty("--letter-push-x", `${((dx / safeDist) * push * 5.8).toFixed(2)}px`);
        letter.style.setProperty("--letter-push-y", `${((dy / safeDist) * push * 3.8 - push * 1.2).toFixed(2)}px`);
      }
    }
  };

  const resetLetters = (el: HTMLElement, property: "--letter-hot" | "--letter-ripple") => {
    const letters = el.querySelectorAll<HTMLElement>(".hero-letter");
    for (const letter of letters) {
      letter.style.setProperty(property, "0");
      if (property === "--letter-hot") {
        letter.style.setProperty("--letter-push-x", "0px");
        letter.style.setProperty("--letter-push-y", "0px");
      }
    }
  };

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
      updateLetters(el, state.x, state.y, "pointer");
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
      updateLetters(el, state.x, state.y, "ripple");
      window.setTimeout(() => {
        if (wrapRef.current === el) {
          el.style.setProperty("--ripple-strength", "0");
          resetLetters(el, "--letter-ripple");
        }
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
      updateLetters(el, clientX, clientY, "pointer");
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
    resetLetters(el, "--letter-hot");
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
        <span className={`hero-name-line hero-name-line-${lineIndex + 1}`} aria-hidden="true" key={line}>
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
