"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import type { Project } from "@/lib/portfolio/content";

/**
 * ProjectCard
 * -----------
 * A "liquid blob" project card. Default state: organic uneven border-radius
 * to suggest a viscous liquid puddle. On hover: edges tighten into a cleaner
 * geometric rectangle. Click is a navigation affordance (#projects slug).
 *
 * Each card gets a per-accent blue caustic intensity under its bottom rim:
 *  - blue-strong: most intense blue under-edges (cards 1 and 4)
 *  - blue-medium: moderate (used sparingly here)
 *  - blue-low: thin restrained line (card 2)
 *  - blue-flow: soft flowing curve (card 3)
 *
 * The card uses a per-card organic border-radius array. On hover the values
 * interpolate to a uniform "geometric" radius (tightened). The micro
 * tilt-on-pointer-move gives a tactile 3D feel.
 */

const ACCENT_PRESETS = {
  "blue-strong": {
    causticOpacity: 0.55,
    glowSize: "100%",
    blur: 24,
  },
  "blue-medium": {
    causticOpacity: 0.4,
    glowSize: "80%",
    blur: 18,
  },
  "blue-low": {
    causticOpacity: 0.22,
    glowSize: "60%",
    blur: 12,
  },
  "blue-flow": {
    causticOpacity: 0.38,
    glowSize: "85%",
    blur: 20,
  },
} as const;

type Props = {
  project: Project;
  index: number;
};

export default function ProjectCard({ project, index }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const accent = ACCENT_PRESETS[project.accent];

  // Pointer-driven micro tilt
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const rotX = useSpring(useTransform(mvY, [-0.5, 0.5], [4, -4]), {
    stiffness: 150,
    damping: 20,
  });
  const rotY = useSpring(useTransform(mvX, [-0.5, 0.5], [-4, 4]), {
    stiffness: 150,
    damping: 20,
  });

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mvX.set(x);
    mvY.set(y);
  };

  const onLeave = () => {
    mvX.set(0);
    mvY.set(0);
  };

  return (
    <motion.a
      ref={ref}
      href={`#project-${project.slug}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-cursor="hover"
      initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{
        duration: 0.9,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover="hover"
      className="group relative block h-[200px] md:h-[220px] [perspective:1200px]"
      aria-label={`${project.title} — ${project.subtitle}`}
    >
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className="relative h-full w-full"
      >
        {/* Outer container — morphs border-radius on hover */}
        <motion.div
          variants={{
            rest: {
              borderRadius: [
                "38% 62% 56% 44% / 48% 38% 62% 52%",
                "56% 44% 38% 62% / 56% 62% 38% 44%",
                "44% 56% 62% 38% / 38% 52% 48% 62%",
                "62% 38% 44% 56% / 44% 56% 62% 38%",
                "38% 62% 56% 44% / 48% 38% 62% 52%",
              ],
            },
            hover: {
              borderRadius: "20px",
            },
          }}
          transition={{
            rest: {
              borderRadius: {
                duration: 14,
                ease: "linear",
                repeat: Infinity,
                repeatType: "mirror",
              },
            },
            hover: {
              borderRadius: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
            },
          }}
          initial="rest"
          animate="rest"
          className="absolute inset-0 glass-strong overflow-hidden"
        >
          {/* Top specular streak */}
          <span
            aria-hidden="true"
            className="absolute top-0 left-0 right-0 h-1/3 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%)",
            }}
          />

          {/* Bottom blue caustic underglow */}
          <span
            aria-hidden="true"
            className="absolute -bottom-6 left-0 right-0 h-1/2 pointer-events-none"
            style={{
              background: `radial-gradient(120% 100% at 50% 100%, rgba(0,102,255,${accent.causticOpacity}) 0%, transparent ${accent.glowSize})`,
              filter: `blur(${accent.blur}px)`,
              transform: "translateY(8px)",
            }}
          />

          {/* Inner content */}
          <div
            className="relative h-full w-full flex items-center justify-between px-7 md:px-9 py-7"
            style={{ transform: "translateZ(40px)" }}
          >
            {/* Left text block */}
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-[11px] font-mono tracking-[0.15em] text-ink-soft/45">
                {project.index}
              </span>
              <h3
                className="text-[20px] md:text-[22px] font-bold tracking-[-0.01em] text-ink truncate"
                style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
              >
                {project.title}
              </h3>
              <p className="text-[12px] md:text-[13px] text-ink-soft/65 leading-[1.4]">
                {project.subtitle}
              </p>
            </div>

            {/* Right arrow control */}
            <motion.span
              variants={{
                rest: { scale: 1, backgroundColor: "rgba(255,255,255,0.85)" },
                hover: {
                  scale: 1.12,
                  backgroundColor: "rgba(255,255,255,1)",
                },
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid place-items-center w-11 h-11 md:w-12 md:h-12 rounded-full border border-white/70 shadow-[0_4px_18px_-4px_rgba(20,35,70,0.2)]"
            >
              <ArrowUpRight
                className="w-[18px] h-[18px] text-ink"
                strokeWidth={2.2}
              />
            </motion.span>
          </div>

          {/* Hover ripple */}
          <motion.span
            aria-hidden="true"
            variants={{
              rest: { opacity: 0, scale: 0.6 },
              hover: { opacity: 1, scale: 1.4 },
            }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-1/2 right-[20%] w-24 h-24 -translate-y-1/2 rounded-full pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, rgba(0,102,255,0.18), transparent 70%)",
            }}
          />
        </motion.div>
      </motion.div>
    </motion.a>
  );
}
