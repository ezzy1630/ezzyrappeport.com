"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Project } from "@/lib/portfolio/content";
import {
  subscribeLiquidPointer,
  subscribeLiquidRipple,
} from "@/lib/portfolio/liquid-interaction";

const ACCENT_PRESETS = {
  "blue-strong": {
    causticOpacity: 0.24,
    causticScale: 1.08,
    causticBlur: "16px",
    edgeOpacity: 0.66,
  },
  "blue-medium": {
    causticOpacity: 0.18,
    causticScale: 0.92,
    causticBlur: "14px",
    edgeOpacity: 0.52,
  },
  "blue-low": {
    causticOpacity: 0.12,
    causticScale: 0.78,
    causticBlur: "12px",
    edgeOpacity: 0.42,
  },
  "blue-flow": {
    causticOpacity: 0.19,
    causticScale: 0.96,
    causticBlur: "14px",
    edgeOpacity: 0.54,
  },
} as const;

const SHAPE_PRESETS = [
  {
    radius: "66px 54px 60px 72px / 52px 50px 62px 58px",
    innerRadius: "54px 45px 50px 60px / 42px 39px 52px 47px",
    threadShift: "-3px",
  },
  {
    radius: "58px 72px 54px 64px / 48px 55px 50px 60px",
    innerRadius: "48px 60px 44px 54px / 38px 45px 40px 50px",
    threadShift: "5px",
  },
  {
    radius: "68px 60px 70px 54px / 56px 48px 60px 48px",
    innerRadius: "56px 50px 58px 44px / 46px 39px 50px 39px",
    threadShift: "-7px",
  },
  {
    radius: "62px 76px 58px 68px / 50px 58px 54px 60px",
    innerRadius: "51px 63px 48px 57px / 40px 48px 44px 50px",
    threadShift: "3px",
  },
] as const;

type Props = {
  project: Project;
  index: number;
  onOpen: (project: Project) => void;
};

export default function ProjectCard({ project, index, onOpen }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const accent = ACCENT_PRESETS[project.accent];
  const shape = SHAPE_PRESETS[index % SHAPE_PRESETS.length];

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

  useEffect(() => {
    const unsubscribePointer = subscribeLiquidPointer((state) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = state.x - rect.left;
      const y = state.y - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const proximity = Math.max(0, 1 - dist / (rect.width * 0.9));

      el.style.setProperty("--card-cursor-x", `${x}px`);
      el.style.setProperty("--card-cursor-y", `${y}px`);
      el.style.setProperty("--card-proximity", proximity.toFixed(3));
      el.style.setProperty("--card-speed", Math.min(state.speed, 1.6).toFixed(3));
    });

    const unsubscribeRipple = subscribeLiquidRipple((state) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = state.x - rect.left;
      const y = state.y - rect.top;
      const inside =
        x > -rect.width * 0.35 &&
        x < rect.width * 1.35 &&
        y > -rect.height * 1.0 &&
        y < rect.height * 1.8;

      if (!inside) return;
      el.style.setProperty("--card-ripple-x", `${x}px`);
      el.style.setProperty("--card-ripple-y", `${y}px`);
      el.style.setProperty("--card-ripple-strength", Math.min(1, state.intensity).toFixed(3));
      window.setTimeout(() => {
        if (ref.current === el) el.style.setProperty("--card-ripple-strength", "0");
      }, 620);
    });

    return () => {
      unsubscribePointer();
      unsubscribeRipple();
    };
  }, []);

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
      initial={false}
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
      style={
        {
          "--project-phase": `${index * 0.7}s`,
          "--project-caustic-opacity": accent.causticOpacity,
          "--project-caustic-scale": accent.causticScale,
          "--project-caustic-blur": accent.causticBlur,
          "--project-edge-opacity": accent.edgeOpacity,
          "--project-radius": shape.radius,
          "--project-inner-radius": shape.innerRadius,
          "--project-thread-shift": shape.threadShift,
          "--card-cursor-x": "50%",
          "--card-cursor-y": "50%",
          "--card-proximity": "0",
          "--card-speed": "0",
          "--card-ripple-x": "50%",
          "--card-ripple-y": "50%",
          "--card-ripple-strength": "0",
        } as React.CSSProperties
      }
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
          <span aria-hidden="true" className="project-liquid-surface" />
          <span aria-hidden="true" className="project-top-sheen" />
          <span aria-hidden="true" className="project-edge-caustics" />
          <span aria-hidden="true" className="project-blue-rim" />
          <svg
            aria-hidden="true"
            className="project-caustic-threads"
            viewBox="0 0 420 132"
            preserveAspectRatio="none"
          >
            <path d="M8 98 C68 122 118 92 174 108 S286 126 410 94" />
            <path d="M18 112 C78 127 124 103 186 116 S300 130 402 106" />
            <path d="M20 28 C84 10 126 28 174 18 S292 3 404 24" />
            <path d="M5 76 C62 64 112 84 160 72 S270 51 414 78" />
          </svg>
          <span aria-hidden="true" className="project-inner-contour" />
          <span aria-hidden="true" className="project-ripple-field" />

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
            className="project-hover-lens"
          />
        </motion.div>
      </motion.div>
    </motion.button>
  );
}
