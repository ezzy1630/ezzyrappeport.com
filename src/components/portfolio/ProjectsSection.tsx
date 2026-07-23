import type { CSSProperties } from "react";
import { projects } from "@/lib/portfolio/content";
import ProjectIdentity from "./ProjectIdentity";
import ProjectTransitionLink from "./ProjectTransitionLink";
import ProjectsInteraction from "./ProjectsInteraction";
import VeloxMark from "./VeloxMark";
import styles from "./ProjectsSection.module.css";

export default function ProjectsSection() {
  return (
    <section id="projects" className={styles.section} aria-labelledby="work-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Selected work / {String(projects.length).padStart(2, "0")} projects</p>
          <h2 id="work-title">Systems built to survive contact with reality.</h2>
        </div>
        <p className={styles.intro}>
          A selected body of work across agent security, hardware, education,
          medical imaging, and code intelligence—presented with the evidence,
          constraints, and current state intact.
        </p>
      </header>

      <ol className={styles.index}>
        {projects.map((project) => (
          <li key={project.slug}>
            <article
              id={`project-${project.slug}`}
              className={styles.row}
              data-project-row
            >
              <div className={styles.rail} aria-label={`Project ${project.index}, ${project.year}`}>
                <span>{project.index}</span>
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
                  aria-label={`Explore the ${project.title} project`}
                  transitionName={`project-${project.slug}`}
                >
                  {project.slug === "velox" ? (
                    <VeloxMark className={styles.veloxMark} />
                  ) : (
                    <ProjectIdentity
                      slug={project.slug}
                      media={project.media.cover}
                      className={styles.projectIdentity}
                    />
                  )}
                </ProjectTransitionLink>
                <span className={styles.mediaCue} aria-hidden="true">
                  View project <span>↗</span>
                </span>
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
      <ProjectsInteraction />
    </section>
  );
}
