"use client";

import { motion } from "framer-motion";
import { projects } from "@/lib/portfolio/content";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";
import LiquidGlassCard from "./LiquidGlassCard";

/**
 * ProjectsSection
 * ---------------
 * Full projects detail section with per-project problem / approach / outcome
 * write-ups. The featured glass capsules live in the first viewport.
 */
export default function ProjectsSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="projects"
      className="relative px-6 md:px-10 lg:px-14 py-32 md:py-40"
      aria-label="Featured projects"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="section-heading max-w-7xl mx-auto mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-soft/55 mb-4">
            Featured Work
          </p>
          <h2
            className="text-[44px] md:text-[68px] leading-[0.95] font-black tracking-[-0.03em] text-ink"
            style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
          >
            Projects
          </h2>
        </div>
        <p className="max-w-md text-[14px] md:text-[15px] leading-[1.7] text-ink-soft/75">
          Five systems at the intersection of agents, workflow software, evidence,
          and real deployment boundaries. Each one is grounded in working code.
        </p>
      </motion.div>

      <div className="max-w-6xl mx-auto flex flex-col gap-28 md:gap-36">
        {projects.map((project) => (
          <article
            key={project.slug}
            id={`project-${project.slug}`}
            className="project-evidence-stage scroll-mt-24 grid md:grid-cols-12 gap-8 md:gap-12"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-20% 0px" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="md:col-span-5 flex flex-col gap-5"
            >
              <div className={`project-artifact project-artifact--${project.personality}`}>
                <div className="project-artifact__orb" aria-hidden="true" />
                <div className="project-artifact__scan" aria-hidden="true" />
                <LiquidGlassCard
                  project={project}
                  personality={project.personality}
                  reducedMotion={reducedMotion}
                  className="project-artifact__card"
                />
              </div>
              <div className="project-title-stack">
                <span className="text-[12px] font-mono tracking-[0.18em] text-electric">
                  {project.index} / {project.year}
                </span>
                <h3 className="font-display text-[34px] md:text-[46px] leading-[0.98] font-black tracking-[-0.03em] text-ink">
                  {project.title}
                </h3>
                <p className="text-[14px] md:text-[15px] text-ink-soft/70">
                  {project.subtitle}
                </p>
                <p className="mt-2 text-[13px] italic text-ink-soft/60">
                  {project.tagline}
                </p>
                <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-ink-soft/62">
                  {project.role}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-20% 0px" }}
              transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="md:col-span-7 flex flex-col gap-7"
            >
              <p className="project-lede text-[17px] md:text-[20px] leading-[1.58] text-ink-soft/90">
                {project.description}
              </p>

              <div className="proof-grid grid sm:grid-cols-3 gap-3 mt-2">
                <div className="proof-cell">
                  <p className="proof-label">
                    Problem
                  </p>
                  <p className="text-[13px] leading-[1.62] text-ink-soft/80">
                    {project.problem}
                  </p>
                </div>
                <div className="proof-cell">
                  <p className="proof-label">
                    Approach
                  </p>
                  <p className="text-[13px] leading-[1.62] text-ink-soft/80">
                    {project.approach}
                  </p>
                </div>
                <div className="proof-cell">
                  <p className="proof-label">
                    Outcome
                  </p>
                  <p className="text-[13px] leading-[1.62] text-ink-soft/80">
                    {project.outcome}
                  </p>
                </div>
              </div>

              <div className="stack-river flex flex-wrap gap-2 mt-2">
                {project.stack.map((tech) => (
                  <span
                    key={tech}
                    className="px-3 py-1 rounded-full text-[11px] font-medium text-ink-soft/75"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </motion.div>
          </article>
        ))}
      </div>
    </section>
  );
}
