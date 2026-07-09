import Image from "next/image";
import Link from "next/link";
import { projects } from "@/lib/portfolio/content";

export default function ProjectsSection() {
  return (
    <section id="projects" className="work-section" aria-labelledby="work-title">
      <header className="work-header">
        <div className="work-header__title-group">
          <p className="work-header__label">Selected work</p>
          <h2 id="work-title">Systems with evidence behind them.</h2>
        </div>
        <p className="work-header__intro">
          Five products spanning agent security, research, education, medical
          imaging, and hardware design. Every case study separates what works
          today from what remains in progress.
        </p>
      </header>

      <div className="work-list">
        {projects.map((project, index) => (
          <article
            key={project.slug}
            id={`project-${project.slug}`}
            className={`work-item${index % 2 === 1 ? " work-item--reverse" : ""}`}
          >
            <figure className="work-item__media">
              <Link
                href={`/project/${project.slug}`}
                className="work-item__cover"
                aria-label={`View the ${project.title} case study`}
              >
                <Image
                  src={project.media.cover.src}
                  alt={project.media.cover.alt}
                  width={project.media.cover.width}
                  height={project.media.cover.height}
                  sizes="(max-width: 720px) 100vw, (max-width: 1100px) 88vw, 58vw"
                  unoptimized={project.media.cover.src.endsWith(".svg")}
                />
              </Link>
              {project.media.cover.caption ? (
                <figcaption className="work-item__caption">
                  {project.media.cover.caption}
                </figcaption>
              ) : null}
            </figure>

            <div className="work-item__content">
              <div className="work-item__meta">
                <span className="work-item__index">
                  {project.index} / <time dateTime={project.year}>{project.year}</time>
                </span>
                <span className="work-item__status">{project.status}</span>
              </div>

              <div className="work-item__heading">
                <h3 className="work-item__title">{project.title}</h3>
                <p className="work-item__subtitle">{project.subtitle}</p>
              </div>

              <p className="work-item__tagline">{project.tagline}</p>

              <dl className="work-item__facts">
                <div className="work-item__fact">
                  <dt>Role</dt>
                  <dd>{project.role}</dd>
                </div>
                <div className="work-item__fact">
                  <dt>Proof</dt>
                  <dd>{project.proof}</dd>
                </div>
              </dl>

              {project.cautionLabel ? (
                <p className="work-item__caution">{project.cautionLabel}</p>
              ) : null}

              <div className="work-item__actions">
                <Link
                  href={`/project/${project.slug}`}
                  className="work-item__link work-item__link--primary"
                >
                  View case study <span aria-hidden="true">↗</span>
                </Link>
                {project.verifiedLinks.map((link) => (
                  <a
                    key={`${project.slug}-${link.href}`}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="work-item__link"
                  >
                    {link.label} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
