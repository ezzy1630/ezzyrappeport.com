import Image from "next/image";
import type { CSSProperties } from "react";
import { projects } from "@/lib/portfolio/content";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ProjectsSection.module.css";

export default function ProjectsSection() {
  return (
    <section id="projects" className={styles.section} aria-labelledby="work-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Selected work / {String(projects.length).padStart(2, "0")} projects</p>
          <h2 id="work-title">Seven systems. One standard: show the work.</h2>
        </div>
        <p className={styles.intro}>
          Products across agent security, hardware, education, medical imaging,
          and code intelligence. Each entry separates what is shipped, what is
          demonstrated, and what is still in progress.
        </p>
      </header>

      <ol className={styles.index}>
        {projects.map((project) => (
          <li key={project.slug}>
            <article
              id={`project-${project.slug}`}
              className={styles.row}
            >
              <div className={styles.rail} aria-hidden="true">
                <span>{project.index}</span>
                <span>{project.year}</span>
              </div>

              <figure
                className={styles.media}
                data-project={project.slug}
                style={
                  {
                    "--project-aspect": project.mediaPresentation.aspectRatio,
                    "--project-fit": project.mediaPresentation.fit,
                    "--project-scale": project.mediaPresentation.scale,
                    "--project-position": project.mediaPresentation.position,
                    "--project-offset-y": project.mediaPresentation.offsetY,
                    "--project-well": project.mediaPresentation.wellColor,
                  } as CSSProperties
                }
              >
                <ProjectTransitionLink
                  href={`/project/${project.slug}`}
                  className={styles.mediaLink}
                  aria-label={`Explore the ${project.title} project`}
                  transitionName={`project-${project.slug}`}
                >
                  <Image
                    src={project.media.cover.src}
                    alt={project.media.cover.alt}
                    width={project.media.cover.width}
                    height={project.media.cover.height}
                    sizes="(max-width: 900px) 90vw, (max-width: 1440px) 28vw, 400px"
                    className={styles.mediaImage}
                    unoptimized={project.media.cover.src.endsWith(".svg")}
                  />
                </ProjectTransitionLink>
              </figure>

              <div className={styles.content}>
                <div className={styles.meta}>
                  <span>{project.status}</span>
                  {project.cautionLabel ? <span>{project.cautionLabel}</span> : null}
                </div>
                <div className={styles.heading}>
                  <h3>{project.title}</h3>
                  <p>{project.subtitle}</p>
                </div>
                <p className={styles.tagline}>{project.tagline}</p>
                <div className={styles.details}>
                  <p><span>Role</span>{project.role}</p>
                  <p><span>Proof</span>{project.proof}</p>
                </div>
              </div>

              <div className={styles.actions}>
                <ProjectTransitionLink href={`/project/${project.slug}`} className={styles.primaryAction}>
                  Explore project <span aria-hidden="true">↗</span>
                </ProjectTransitionLink>
                {project.verifiedLinks.slice(0, 1).map((link) => (
                  <a
                    key={`${project.slug}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.secondaryAction}
                  >
                    {link.label} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </article>
          </li>
        ))}
      </ol>
    </section>
  );
}
