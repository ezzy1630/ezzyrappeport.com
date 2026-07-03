"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { type Project, projects, bio } from "@/lib/portfolio/content";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import LiquidGlassCard from "@/components/portfolio/LiquidGlassCard";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";

type Props = {
  project: Project;
};

export default function ProjectDetail({ project }: Props) {
  const reducedMotion = useReducedMotion();
  const i = projects.findIndex((p) => p.slug === project.slug);
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];

  return (
    <PortfolioShell heroName={false}>
      <div className="content-layer">
        <article className="relative z-10 mx-auto max-w-6xl px-6 pt-28 md:pt-36 pb-24 md:pb-32">
          <Link
            href="/#projects"
            className="liquid-button glass mb-10 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-ink-soft/80 transition hover:text-ink"
            data-cursor="hover"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="project-detail-hero"
          >
            <div className="project-detail-copy">
              <span className="text-[12px] font-mono tracking-[0.18em] text-electric">
                {project.index} / {project.year}
              </span>
              <h1 className="font-display mt-3 text-[48px] font-black leading-[0.92] tracking-[-0.035em] text-ink md:text-[86px]">
                {project.title}
              </h1>
              <p className="mt-5 max-w-2xl text-[17px] leading-[1.55] text-ink-soft/82 md:text-[21px]">
                {project.subtitle}
              </p>
              <p className="mt-3 text-[14px] italic text-ink-soft/60">{project.tagline}</p>
              <p className="mt-5 text-[12px] uppercase tracking-[0.18em] text-ink-soft/55">
                {project.role}
              </p>
            </div>
            <div className={`project-detail-artifact project-artifact--${project.personality}`} aria-hidden="false">
              <div className="project-artifact__orb" aria-hidden="true" />
              <div className="project-artifact__scan" aria-hidden="true" />
              <LiquidGlassCard
                project={project}
                personality={project.personality}
                reducedMotion={reducedMotion}
                className="project-artifact__card project-detail-card"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="proof-grid mt-14 grid gap-3 md:grid-cols-3"
          >
            {[["Problem", project.problem], ["Approach", project.approach], ["Outcome", project.outcome]].map(([label, value]) => (
              <div key={label} className="proof-cell">
                <p className="proof-label">{label}</p>
                <p className="text-[14px] leading-[1.65] text-ink-soft/85">{value}</p>
              </div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="project-overview-slab mt-10 p-8 md:p-12"
          >
            <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-ink-soft/55">Overview</p>
            <p className="text-[16px] leading-[1.7] text-ink-soft/90 md:text-[18px]">{project.description}</p>
            <div className="stack-river mt-8 flex flex-wrap gap-2">
              {project.stack.map((tech) => (
                <span key={tech} className="rounded-full px-4 py-1.5 text-[12px] font-medium text-ink-soft/80">{tech}</span>
              ))}
            </div>
          </motion.div>

          <nav className="mt-16 grid gap-4 sm:grid-cols-2" aria-label="Project navigation">
            <Link href={`/project/${prev.slug}`} className="glass group flex items-center gap-4 rounded-2xl p-5 transition hover:scale-[1.01]" data-cursor="hover">
              <ArrowLeft className="h-5 w-5 shrink-0 text-ink-soft/60 group-hover:text-ink transition-colors" />
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-soft/55">Previous</span>
                <span className="font-display truncate text-[15px] font-bold text-ink">{prev.title}</span>
              </span>
            </Link>
            <Link href={`/project/${next.slug}`} className="glass group flex items-center justify-end gap-4 rounded-2xl p-5 text-right transition hover:scale-[1.01]" data-cursor="hover">
              <span className="flex min-w-0 flex-col items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-soft/55">Next</span>
                <span className="font-display truncate text-[15px] font-bold text-ink">{next.title}</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-ink-soft/60 group-hover:text-ink transition-colors" />
            </Link>
          </nav>

          <footer className="mt-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-t border-white/40 pt-8">
            <p className="text-[12px] text-ink-soft/60">© {new Date().getFullYear()} {bio.name}</p>
            <a href={`mailto:${bio.email}`} className="text-[12px] font-mono tracking-[0.15em] text-ink-soft/55 uppercase hover:text-electric transition-colors" data-cursor="hover">{bio.email}</a>
          </footer>
        </article>
      </div>
    </PortfolioShell>
  );
}
