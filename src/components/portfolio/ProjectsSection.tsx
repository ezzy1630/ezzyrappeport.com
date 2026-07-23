"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { projects, type ProjectSlug } from "@/lib/portfolio/content";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ProjectsSection.module.css";

export default function ProjectsSection() {
  const [activeSlug, setActiveSlug] = useState<ProjectSlug>(projects[0].slug);
  const activeProject = useMemo(
    () => projects.find((project) => project.slug === activeSlug) ?? projects[0],
    [activeSlug],
  );
  const activeMedia = activeProject.media.gallery?.[0] ?? activeProject.media.cover;

  return (
    <section id="projects" className={styles.section} aria-labelledby="work-title">
      <header className={styles.header}>
        <p className={styles.kicker}>Selected work</p>
        <h2 id="work-title">Systems built to survive contact with reality.</h2>
        <p className={styles.intro}>
          Security, hardware, education, medical imaging, and code intelligence.
          Each case shows what shipped, what was verified, and what remains bounded.
        </p>
      </header>

      <div className={styles.explorer}>
        <article className={styles.stage} data-project={activeProject.slug}>
          <div className={styles.stageCopy}>
            <div className={styles.stageMeta}>
              <span>{activeProject.year}</span>
              <span>{activeProject.role}</span>
            </div>
            <h3>{activeProject.title}</h3>
            <p className={styles.stageTagline}>{activeProject.tagline}</p>
            <p className={styles.stageProof}>{activeProject.proof.split("·").join(" / ")}</p>
            <ProjectTransitionLink
              href={`/project/${activeProject.slug}`}
              className={styles.stageLink}
              transitionName={`project-${activeProject.slug}`}
            >
              View case study <span aria-hidden="true">↗</span>
            </ProjectTransitionLink>
          </div>

          <ProjectTransitionLink
            href={`/project/${activeProject.slug}`}
            className={styles.stageMedia}
            transitionName={`project-${activeProject.slug}`}
            aria-label={`Open the ${activeProject.title} case study`}
          >
            <Image
              key={activeMedia.src}
              src={activeMedia.src}
              alt={activeMedia.alt}
              width={activeMedia.width}
              height={activeMedia.height}
              sizes="(max-width: 900px) 100vw, 62vw"
              className={styles.stageImage}
              unoptimized={activeMedia.src.endsWith(".svg")}
            />
          </ProjectTransitionLink>
        </article>

        <ol className={styles.index} aria-label="Project index">
          {projects.map((project) => {
            const active = project.slug === activeProject.slug;
            const preview = project.media.gallery?.[0] ?? project.media.cover;
            return (
              <li key={project.slug}>
                <ProjectTransitionLink
                  href={`/project/${project.slug}`}
                  className={styles.indexLink}
                  data-active={active ? "true" : "false"}
                  onPointerEnter={() => setActiveSlug(project.slug)}
                  onFocus={() => setActiveSlug(project.slug)}
                >
                  <Image
                    src={preview.src}
                    alt=""
                    width={preview.width}
                    height={preview.height}
                    sizes="96px"
                    className={styles.indexThumb}
                    unoptimized={preview.src.endsWith(".svg")}
                  />
                  <span className={styles.indexTitle}>{project.title}</span>
                  <span className={styles.indexYear}>{project.year}</span>
                  <span className={styles.indexArrow} aria-hidden="true">↗</span>
                </ProjectTransitionLink>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
