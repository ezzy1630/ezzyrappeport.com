"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useRef } from "react";
import type { Project } from "@/lib/portfolio/content";

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
  onOpen: (project: Project) => void;
};

export default function ProjectCard({ project, index, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const accent = ACCENT_PRESETS[project.accent];

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

  const onMove = (e: React.PointerEvent<HTMLButtonElement>) => {
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
    <motion.button
      ref={ref}
      type="button"
      onClick={() => onOpen(project)}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-cursor="hover"
      data-no-focus-ring
      initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      whileTap={{ scale: 0.985 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{
        duration: 0.9,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="project-card-button group relative block h-[122px] w-full text-left md:h-[132px] [perspective:1200px]"
      aria-label={`Open ${project.title} details`}
    >
      <motion.div
        style={{ rotateX: rotX, rotateY: rotY, transformStyle: "preserve-3d" }}
        className="relative h-full w-full"
      >
        <motion.div
          layoutId={`project-shell-${project.slug}`}
          transition={{
            type: "spring",
            stiffness: 280,
            damping: 28,
          }}
          className="project-capsule project-capsule-card absolute inset-0 overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-[8%] right-[10%] h-[46%]"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.20) 56%, transparent 100%)",
              filter: "blur(10px)",
            }}
          />

          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-5 left-[4%] right-[4%] h-[56%]"
            style={{
              background: `radial-gradient(120% 100% at 50% 100%, rgba(0,102,255,${accent.causticOpacity}) 0%, transparent ${accent.glowSize})`,
              filter: `blur(${accent.blur}px)`,
              transform: "translateY(8px)",
            }}
          />

          <div
            className="relative flex h-full w-full items-center justify-between px-7 py-5 md:px-8"
            style={{ transform: "translateZ(34px)" }}
          >
            <div className="flex min-w-0 flex-col gap-1.5 pr-4">
              <span className="text-[11px] font-medium text-ink-soft/58">
                {project.index}
              </span>
              <motion.h3
                layoutId={`project-title-${project.slug}`}
                className="truncate text-[16px] font-semibold tracking-normal text-ink md:text-[17px]"
                style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
              >
                {project.title}
              </motion.h3>
              <motion.p
                layoutId={`project-subtitle-${project.slug}`}
                className="text-[12px] leading-[1.4] text-ink-soft/65 md:text-[13px]"
              >
                {project.subtitle}
              </motion.p>
            </div>

            <motion.span
              layoutId={`project-arrow-${project.slug}`}
              whileHover={{
                scale: 1.08,
                backgroundColor: "rgba(255,255,255,1)",
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/88 text-ink shadow-[0_10px_28px_-18px_rgba(8,35,82,0.45),0_1px_1px_rgba(255,255,255,0.8)_inset] md:h-12 md:w-12"
            >
              <ArrowUpRight className="h-[18px] w-[18px] text-ink" strokeWidth={2.2} />
            </motion.span>
          </div>

          <motion.span
            aria-hidden="true"
            initial={{ opacity: 0, scale: 0.75 }}
            whileHover={{ opacity: 1, scale: 1.25 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute top-1/2 right-[20%] h-24 w-24 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(0,102,255,0.18), transparent 70%)",
            }}
          />
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
