import Image from "next/image";
import { projects } from "@/lib/portfolio/content";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ProjectsSection.module.css";

export default function ProjectsSection() {
  return (
    <section id="projects" className={styles.section} aria-labelledby="work-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Selected work / 05 projects</p>
          <h2 id="work-title">Systems with evidence behind them.</h2>
        </div>
        <p className={styles.intro}>
          A compact index of products across agent security, research,
          education, medical imaging, and hardware design. Open any case study
          for the full boundary between shipped, demonstrated, and pending.
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

              <figure className={styles.media} data-project={project.slug}>
                <ProjectTransitionLink
                  href={`/project/${project.slug}`}
                  className={styles.mediaLink}
                  aria-label={`View the ${project.title} case study`}
                  transitionName={`project-${project.slug}`}
                >
                  <Image
                    src={project.media.cover.src}
                    alt={project.media.cover.alt}
                    width={project.media.cover.width}
                    height={project.media.cover.height}
                    sizes="(max-width: 680px) 28vw, 15vw"
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
                  Case study <span aria-hidden="true">↗</span>
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
