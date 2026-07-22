import Image from "next/image";
import { bio, type Project, projects } from "@/lib/portfolio/content";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import ProjectTransitionLink from "@/components/portfolio/ProjectTransitionLink";
import styles from "./ProjectDetail.module.css";

type Props = {
  project: Project;
};

const chapters = [
  { key: "problem", label: "Problem" },
  { key: "approach", label: "Approach" },
  { key: "outcome", label: "Outcome" },
] as const;

const linkKindLabels = {
  source: "Source",
  site: "Live site",
  releases: "Releases",
} as const;

export default function ProjectDetail({ project }: Props) {
  const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
  const previous = projects[(projectIndex - 1 + projects.length) % projects.length];
  const next = projects[(projectIndex + 1) % projects.length];
  const gallery = project.media.gallery ?? [];
  const proofItems = project.proof
    .split("·")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <PortfolioShell heroName={false}>
      <div className="content-layer">
        <article className={styles.page} data-project={project.slug} data-water-section="case">
          <ProjectTransitionLink href="/#projects" className={styles.back}>
            <span className={styles.backIcon} aria-hidden="true">←</span>
            <span>Back to selected work</span>
          </ProjectTransitionLink>

          <header className={styles.hero}>
            <div className={styles.heroContent}>
              <p className={styles.eyebrow}>
                <span>{project.index}</span>
                <span aria-hidden="true"> / </span>
                <time dateTime={project.year}>{project.year}</time>
              </p>
              <h1 className={styles.title}>{project.title}</h1>
              <p className={styles.subtitle}>{project.subtitle}</p>
              <p className={styles.tagline}>{project.tagline}</p>

              <dl className={styles.facts}>
                <div className={styles.fact}>
                  <dt>Role</dt>
                  <dd>{project.role}</dd>
                </div>
                <div className={styles.fact}>
                  <dt>Status</dt>
                  <dd>{project.status}</dd>
                </div>
              </dl>

              <div className={styles.proofStrip} aria-label="Verified proof">
                <p className={styles.proofLabel}>Verified proof</p>
                <ul className={styles.proofList}>
                  {proofItems.map((item, index) => (
                    <li key={item} className={styles.proofItem}>
                      <span className={styles.proofIndex} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {project.cautionLabel ? (
                <p className={styles.caution}>{project.cautionLabel}</p>
              ) : null}

              {project.verifiedLinks.length > 0 ? (
                <div className={styles.links} aria-label="Verified project links">
                  {project.verifiedLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className={styles.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${link.label} for ${project.title} (opens in a new tab)`}
                    >
                      <span className={styles.linkKind}>{linkKindLabels[link.kind]}</span>
                      <span className={styles.linkLabel}>{link.label}</span>
                      <span className={styles.linkArrow} aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <figure
              className={styles.heroMedia}
              style={{ viewTransitionName: `project-${project.slug}` }}
            >
              <Image
                src={project.media.cover.src}
                alt={project.media.cover.alt}
                width={project.media.cover.width}
                height={project.media.cover.height}
                sizes="(max-width: 1050px) 100vw, 62vw"
                className={styles.heroMediaImage}
                priority
                unoptimized={project.media.cover.src.endsWith(".svg")}
              />
              {project.media.cover.caption ? (
                <figcaption className={styles.mediaCaption}>{project.media.cover.caption}</figcaption>
              ) : null}
            </figure>
          </header>

          <section className={styles.narrative} aria-labelledby="case-narrative-title">
            <header className={styles.sectionHeader}>
              <p>From constraint to evidence</p>
              <h2 id="case-narrative-title">The work, end to end.</h2>
            </header>
            <div className={styles.narrativeGrid}>
              {chapters.map((chapter, index) => (
                <section key={chapter.key} className={styles.chapter}>
                  <p className={styles.chapterIndex} aria-hidden="true">
                    0{index + 1}
                  </p>
                  <h3>{chapter.label}</h3>
                  <p>{project[chapter.key]}</p>
                </section>
              ))}
            </div>
          </section>

          <section className={styles.overview} aria-labelledby="case-overview-title">
            <div className={styles.overviewCopy}>
              <p>Overview</p>
              <h2 id="case-overview-title">What shipped</h2>
              <p>{project.description}</p>
            </div>
            <div className={styles.overviewStack}>
              <h3>Built with</h3>
              <ul className={styles.stack} aria-label="Technology stack">
                {project.stack.map((technology) => (
                  <li key={technology}>{technology}</li>
                ))}
              </ul>
            </div>
          </section>

          {gallery.length > 0 ? (
            <section className={styles.gallery} aria-labelledby="case-gallery-title">
              <header className={styles.sectionHeader}>
                <p>Evidence</p>
                <h2 id="case-gallery-title">Inside the system</h2>
              </header>
              <div className={styles.galleryGrid}>
                {gallery.map((asset) => (
                  <figure key={asset.src} className={styles.galleryItem}>
                    <div className={styles.galleryMedia}>
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        sizes="(max-width: 760px) 100vw, 50vw"
                        className={styles.galleryImage}
                        unoptimized={asset.src.endsWith(".svg")}
                      />
                    </div>
                    {asset.caption ? (
                      <figcaption className={styles.galleryCaption}>
                        {asset.caption}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <nav className={styles.pagination} aria-label="Project navigation">
            <ProjectTransitionLink
              href={`/project/${previous.slug}`}
              className={`${styles.paginationLink} ${styles.paginationPrevious}`}
            >
              <span className={styles.paginationArrow} aria-hidden="true">←</span>
              <span className={styles.paginationText}>
                <small>Previous project</small>
                <strong>{previous.title}</strong>
              </span>
            </ProjectTransitionLink>
            <ProjectTransitionLink
              href={`/project/${next.slug}`}
              className={`${styles.paginationLink} ${styles.paginationNext}`}
            >
              <span className={styles.paginationText}>
                <small>Next project</small>
                <strong>{next.title}</strong>
              </span>
              <span className={styles.paginationArrow} aria-hidden="true">→</span>
            </ProjectTransitionLink>
          </nav>

          <footer className={styles.footer}>
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
