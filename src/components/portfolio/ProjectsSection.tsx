"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { projects, type Project, type ProjectSlug } from "@/lib/portfolio/content";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ProjectsSection.module.css";

type ArtifactComposition =
  | "full-frame"
  | "floating-device"
  | "diagram"
  | "evidence"
  | "typographic";

const COMPOSITIONS: ArtifactComposition[] = [
  "full-frame",
  "diagram",
  "floating-device",
  "typographic",
  "evidence",
  "full-frame",
  "floating-device",
];

function compositionFor(project: Project, index: number): ArtifactComposition {
  if (project.slug === "etch" || project.slug === "argyph") return "diagram";
  if (project.slug === "flowe" || project.slug === "velox") return "floating-device";
  if (project.slug === "mathpilot") return "typographic";
  if (project.slug === "nexarad") return "evidence";
  return COMPOSITIONS[index % COMPOSITIONS.length];
}

function artifactMedia(project: Project) {
  return project.media.gallery?.[0] ?? project.media.cover;
}

export default function ProjectsSection() {
  const [activeSlug, setActiveSlug] = useState<ProjectSlug>(projects[0].slug);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-artifact]"));
    const preload = (slug: string) => {
      const project = projects.find((entry) => entry.slug === slug);
      if (!project) return;
      const next = artifactMedia(project);
      const image = new window.Image();
      image.decoding = "async";
      image.src = next.src;
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const slug = entry.target.getAttribute("data-artifact") as ProjectSlug | null;
          if (!slug) continue;
          setActiveSlug(slug);
          const index = projects.findIndex((project) => project.slug === slug);
          const next = projects[index + 1];
          if (next) preload(next.slug);
        }
      },
      { root: null, rootMargin: "0px 0px -35% 0px", threshold: 0.35 },
    );
    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="projects"
      ref={rootRef}
      className={styles.section}
      aria-labelledby="work-title"
      data-active={activeSlug}
    >
      <header className={styles.header}>
        <p className={styles.kicker}>Selected work / {String(projects.length).padStart(2, "0")} projects</p>
        <h2 id="work-title">Systems built to survive contact with reality.</h2>
        <p className={styles.intro}>
          Artifacts discovered in the same water—agent security, hardware,
          education, medical imaging, and code intelligence—with evidence and
          constraints intact.
        </p>
      </header>

      <div className={styles.artifactStream}>
        {projects.map((project, index) => {
          const media = artifactMedia(project);
          const composition = compositionFor(project, index);
          const cue = project.proof.split("·")[0]?.trim() ?? project.status;
          return (
            <article
              key={project.slug}
              className={styles.artifact}
              data-artifact={project.slug}
              data-composition={composition}
              data-active={project.slug === activeSlug ? "true" : "false"}
            >
              <div className={styles.artifactCopy}>
                <div className={styles.stageMeta}>
                  <span>{project.status}</span>
                  <span>{project.year}</span>
                  <span>{project.role}</span>
                </div>
                <h3>{project.title}</h3>
                <p className={styles.stageTagline}>{project.tagline}</p>
                <p className={styles.stageProof}>{project.proof}</p>
                {project.cautionLabel ? (
                  <p className={styles.stageProof}>{project.cautionLabel}</p>
                ) : null}
                <ProjectTransitionLink
                  href={`/project/${project.slug}`}
                  className={styles.stageLink}
                  transitionName={`project-${project.slug}`}
                >
                  View case study <span aria-hidden="true">↗</span>
                </ProjectTransitionLink>
              </div>

              <ProjectTransitionLink
                href={`/project/${project.slug}`}
                className={styles.artifactMedia}
                transitionName={`project-${project.slug}`}
                aria-label={`Open the ${project.title} case study`}
              >
                <span className={styles.artifactLight} aria-hidden="true" />
                <Image
                  src={media.src}
                  alt={media.alt}
                  width={media.width}
                  height={media.height}
                  sizes="(max-width: 900px) 92vw, 54vw"
                  className={styles.artifactImage}
                  unoptimized={media.src.endsWith(".svg")}
                  priority={index === 0}
                />
                <span className={styles.artifactCue}>{cue}</span>
              </ProjectTransitionLink>
            </article>
          );
        })}
      </div>
    </section>
  );
}
