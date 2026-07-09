"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";

type Props = {
  project: Project | null;
  onClose: () => void;
};

export default function ProjectModal({ project, onClose }: Props) {
  useEffect(() => {
    if (!project) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [project, onClose]);

  return (
    <AnimatePresence>
      {project && (
        <motion.div
          className="project-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="project-modal__scrim"
            aria-label="Close project details"
            onClick={onClose}
          />
          <motion.article
            className="project-modal__panel"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              className="project-modal__close"
              aria-label="Close project details"
              onClick={onClose}
            >
              <X aria-hidden="true" size={18} strokeWidth={2.3} />
            </button>

            <div className="project-modal__header">
              <span className="project-modal__index">{project.index} / {project.year}</span>
              <h2 id="project-modal-title" className="project-modal__title">
                {project.title}
              </h2>
              <p className="project-modal__subtitle">{project.subtitle}</p>
              <p className="project-modal__tagline">{project.tagline}</p>
            </div>

            <div className="project-modal__body">
              <p className="project-modal__description">{project.description}</p>
              <div className="project-modal__proof-grid">
                {[
                  ["Problem", project.problem],
                  ["Approach", project.approach],
                  ["Outcome", project.outcome],
                ].map(([label, value]) => (
                  <section key={label} className="project-modal__proof">
                    <h3>{label}</h3>
                    <p>{value}</p>
                  </section>
                ))}
              </div>
              <div className="project-modal__stack" aria-label="Technology stack">
                {project.stack.map((tech) => (
                  <span key={tech}>{tech}</span>
                ))}
              </div>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
