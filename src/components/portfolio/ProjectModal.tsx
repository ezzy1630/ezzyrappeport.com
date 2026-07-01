"use client";

import {
  AnimatePresence,
  motion,
  type MotionProps,
} from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { Project } from "@/lib/portfolio/content";

type Props = {
  project: Project | null;
  onClose: () => void;
};

const TRANSITION: MotionProps["transition"] = {
  type: "spring",
  stiffness: 280,
  damping: 28,
};

export default function ProjectModal({ project, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!project) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [project, onClose]);

  return (
    <AnimatePresence>
      {project ? (
        <motion.div
          key={project.slug}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6"
        >
          <motion.button
            type="button"
            aria-label="Close project details"
            className="absolute inset-0 bg-[rgba(238,244,255,0.62)] backdrop-blur-2xl"
            onClick={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            data-no-focus-ring
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            layoutId={`project-shell-${project.slug}`}
            transition={TRANSITION}
            className="project-capsule relative z-10 flex max-h-[min(86vh,860px)] w-full max-w-4xl flex-col overflow-hidden border border-white/72 bg-white/72 shadow-[0_32px_120px_-42px_rgba(17,34,68,0.58)] outline-none backdrop-blur-2xl"
          >
            <div className="pointer-events-none absolute inset-x-[6%] top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,255,255,0.18)_66%,transparent_100%)] blur-xl" />
            <div className="pointer-events-none absolute inset-x-[10%] bottom-[-12%] h-56 bg-[radial-gradient(110%_100%_at_50%_100%,rgba(0,102,255,0.20)_0%,transparent_70%)] blur-3xl" />

            <div className="relative flex items-start justify-between gap-4 border-b border-white/35 px-5 py-5 sm:px-7 sm:py-6">
              <div className="min-w-0">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.24em] text-ink-soft/55">
                  {project.index} / {project.year}
                </p>
                <motion.h3
                  id={titleId}
                  layoutId={`project-title-${project.slug}`}
                  className="text-[28px] font-semibold leading-[0.98] text-ink sm:text-[36px]"
                  style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
                >
                  {project.title}
                </motion.h3>
                <motion.p
                  layoutId={`project-subtitle-${project.slug}`}
                  className="mt-2 max-w-2xl text-[14px] text-ink-soft/72 sm:text-[15px]"
                >
                  {project.subtitle}
                </motion.p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/70 bg-white/72 text-ink shadow-[0_12px_30px_-18px_rgba(8,35,82,0.45)] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/45"
                  aria-label="Close modal"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              </div>
            </div>

            <div className="relative overflow-y-auto px-5 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(260px,0.85fr)] lg:gap-8">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-white/55 bg-white/38 px-4 py-4 backdrop-blur-md sm:px-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft/48">
                      Tagline
                    </p>
                    <p className="mt-2 text-[18px] leading-[1.45] text-ink-soft/92 sm:text-[20px]">
                      {project.tagline}
                    </p>
                  </div>

                  <section>
                    <p className="mb-2 text-[11px] uppercase tracking-[0.22em] text-ink-soft/48">
                      Overview
                    </p>
                    <p
                      id={descriptionId}
                      className="text-[14px] leading-[1.75] text-ink-soft/88 sm:text-[15px]"
                    >
                      {project.description}
                    </p>
                  </section>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      ["Problem", project.problem],
                      ["Approach", project.approach],
                      ["Outcome", project.outcome],
                    ].map(([label, value]) => (
                      <section
                        key={label}
                        className="rounded-[26px] border border-white/50 bg-white/34 px-4 py-4 backdrop-blur-md"
                      >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-soft/45">
                          {label}
                        </p>
                        <p className="mt-2 text-[13px] leading-[1.65] text-ink-soft/82">
                          {value}
                        </p>
                      </section>
                    ))}
                  </div>
                </div>

                <aside className="space-y-4">
                  <div className="rounded-[28px] border border-white/55 bg-white/40 px-4 py-4 backdrop-blur-md sm:px-5">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft/48">
                      Role
                    </p>
                    <p className="mt-2 text-[16px] font-medium text-ink-soft/90">
                      {project.role}
                    </p>

                    <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-ink-soft/48">
                      Year
                    </p>
                    <p className="mt-2 text-[16px] font-medium text-ink-soft/90">
                      {project.year}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-white/55 bg-white/38 px-4 py-4 backdrop-blur-md sm:px-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-soft/48">
                        Stack
                      </p>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full border border-white/60 bg-white/68 px-3 py-1 text-[11px] font-medium text-ink-soft/76 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric/45"
                      >
                        Done
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {project.stack.map((tech) => (
                        <span
                          key={tech}
                          className="rounded-full border border-white/60 bg-white/62 px-3 py-1 text-[11px] font-medium text-ink-soft/78"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
