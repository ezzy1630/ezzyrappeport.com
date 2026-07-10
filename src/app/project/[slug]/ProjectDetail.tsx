import Image from "next/image";
import Link from "next/link";
import { bio, type Project, projects } from "@/lib/portfolio/content";
import PortfolioShell from "@/components/portfolio/PortfolioShell";

type Props = {
  project: Project;
};

const chapters = [
  { key: "problem", label: "Problem" },
  { key: "approach", label: "Approach" },
  { key: "outcome", label: "Outcome" },
] as const;

export default function ProjectDetail({ project }: Props) {
  const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
  const previous = projects[(projectIndex - 1 + projects.length) % projects.length];
  const next = projects[(projectIndex + 1) % projects.length];
  const gallery = project.media.gallery ?? [];

  return (
    <PortfolioShell heroName={false}>
      <div className="content-layer">
        <article className={`case-page case-page--${project.slug}`}>
          <Link href="/#projects" className="case-back">
            <span aria-hidden="true">←</span> Selected work
          </Link>

          <header className="case-hero">
            <div className="case-hero__content">
              <p className="case-hero__eyebrow">
                {project.index} / <time dateTime={project.year}>{project.year}</time>
              </p>
              <h1 className="case-hero__title">{project.title}</h1>
              <p className="case-hero__subtitle">{project.subtitle}</p>
              <p className="case-hero__tagline">{project.tagline}</p>

              <dl className="case-hero__facts">
                <div className="case-hero__fact">
                  <dt>Role</dt>
                  <dd>{project.role}</dd>
                </div>
                <div className="case-hero__fact">
                  <dt>Status</dt>
                  <dd>{project.status}</dd>
                </div>
                <div className="case-hero__fact">
                  <dt>Verified proof</dt>
                  <dd>{project.proof}</dd>
                </div>
              </dl>

              {project.cautionLabel ? (
                <p className="case-hero__caution">{project.cautionLabel}</p>
              ) : null}

              {project.verifiedLinks.length > 0 ? (
                <div className="case-hero__links" aria-label="Verified project links">
                  {project.verifiedLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label} <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <figure
              className="case-hero__media"
              style={{ viewTransitionName: `project-${project.slug}` }}
            >
              <Image
                src={project.media.cover.src}
                alt={project.media.cover.alt}
                width={project.media.cover.width}
                height={project.media.cover.height}
                sizes="(max-width: 1050px) 100vw, 62vw"
                priority
                unoptimized={project.media.cover.src.endsWith(".svg")}
              />
              {project.media.cover.caption ? (
                <figcaption>{project.media.cover.caption}</figcaption>
              ) : null}
            </figure>
          </header>

          <section className="case-narrative" aria-labelledby="case-narrative-title">
            <header className="case-narrative__header">
              <p>From constraint to evidence</p>
              <h2 id="case-narrative-title">The work, end to end.</h2>
            </header>
            <div className="case-narrative__grid">
              {chapters.map((chapter, index) => (
                <section key={chapter.key} className="case-narrative__chapter">
                  <p className="case-narrative__index" aria-hidden="true">
                    0{index + 1}
                  </p>
                  <h3>{chapter.label}</h3>
                  <p>{project[chapter.key]}</p>
                </section>
              ))}
            </div>
          </section>

          <section className="case-overview" aria-labelledby="case-overview-title">
            <div className="case-overview__copy">
              <p>Overview</p>
              <h2 id="case-overview-title">What shipped</h2>
              <p>{project.description}</p>
            </div>
            <div className="case-overview__stack">
              <h3>Built with</h3>
              <ul className="case-stack" aria-label="Technology stack">
                {project.stack.map((technology) => (
                  <li key={technology}>{technology}</li>
                ))}
              </ul>
            </div>
          </section>

          {gallery.length > 0 ? (
            <section className="case-gallery" aria-labelledby="case-gallery-title">
              <header className="case-gallery__header">
                <p>Evidence</p>
                <h2 id="case-gallery-title">Inside the system</h2>
              </header>
              <div className="case-gallery__grid">
                {gallery.map((asset) => (
                  <figure key={asset.src} className="case-gallery__item">
                    <div className="case-gallery__media">
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        sizes="(max-width: 760px) 100vw, 50vw"
                        unoptimized={asset.src.endsWith(".svg")}
                      />
                    </div>
                    {asset.caption ? (
                      <figcaption className="case-gallery__caption">
                        {asset.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <nav className="case-pagination" aria-label="Project navigation">
            <Link
              href={`/project/${previous.slug}`}
              className="case-pagination__link case-pagination__link--previous"
            >
              <span aria-hidden="true">←</span>
              <span>
                <small>Previous project</small>
                <strong>{previous.title}</strong>
              </span>
            </Link>
            <Link
              href={`/project/${next.slug}`}
              className="case-pagination__link case-pagination__link--next"
            >
              <span>
                <small>Next project</small>
                <strong>{next.title}</strong>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          </nav>

          <footer className="case-footer">
            <p>
              © {new Date().getFullYear()} {bio.name}
            </p>
            <a href={`mailto:${bio.email}`}>{bio.email}</a>
          </footer>
        </article>
      </div>
    </PortfolioShell>
  );
}
