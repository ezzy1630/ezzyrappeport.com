import type { CSSProperties } from "react";
import {
  projectDepthBand,
  projectLayoutFamily,
  projects,
} from "@/lib/portfolio/content";
import LazyProjectIdentity from "./LazyProjectIdentity";
import ProjectTransitionLink from "./ProjectTransitionLink";
import ProjectsInteraction from "./ProjectsInteraction";
import styles from "./ProjectsSection.module.css";

export default function ProjectsSection() {
  return (
    <section
      id="projects"
      className={styles.section}
      aria-labelledby="work-title"
      data-depth-band="shallow"
    >
      <header className={styles.header} data-section-reveal>
        <h2 id="work-title">Systems built to survive contact with reality.</h2>
        <p className={styles.intro}>
          A selected body of work across agent security, hardware, education,
          medical imaging, and code intelligence - presented with the evidence,
          constraints, and current state intact.
        </p>
      </header>

      <ol className={styles.index}>
        {projects.map((project) => {
          const layout = projectLayoutFamily[project.slug];
          const band = projectDepthBand(project.slug);
          return (
            <li key={project.slug}>
              <article
                id={`project-${project.slug}`}
                className={styles.row}
                data-project-row
                data-layout={layout}
                data-depth-band={band}
                data-split={layout === "split" && Number(project.index) % 2 === 0 ? "end" : "start"}
              >
                <div
                  className={styles.rail}
                  aria-label={`Project depth mark, ${project.year}`}
                >
                  <span className={styles.railTick} aria-hidden="true" />
                  <span>{project.year}</span>
                </div>

                <figure
                  className={styles.media}
                  data-project={project.slug}
                  data-project-media
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
                    aria-label={`Dive into the ${project.title} project`}
                    transitionName={`project-${project.slug}`}
                  >
                    <LazyProjectIdentity
                      slug={project.slug}
                      media={project.media.cover}
                      className={styles.projectIdentity}
                    />
                  </ProjectTransitionLink>
                  <figcaption className={styles.mediaCaption}>
                    <span className={styles.mediaCaptionTitle}>{project.title}</span>
                    <span className={styles.mediaCaptionLine}>{project.subtitle}</span>
                  </figcaption>
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
                  <ProjectTransitionLink
                    href={`/project/${project.slug}`}
                    className={`${styles.primaryAction} rv-pill-fill`}
                    transitionName={`project-${project.slug}`}
                    data-magnetic="button"
                    data-pill-fill
                  >
                    Dive in <span aria-hidden="true">↗</span>
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
          );
        })}
      </ol>
      <ProjectsInteraction />
    </section>
  );
}
