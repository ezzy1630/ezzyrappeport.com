import Image from "next/image";
import { bio, type Project, projects } from "@/lib/portfolio/content";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import CaseArrivalWater from "@/components/portfolio/CaseArrivalWater";
import ProjectTransitionLink from "@/components/portfolio/ProjectTransitionLink";
import styles from "./ProjectDetail.module.css";

type Props = {
  project: Project;
};

const chapters = [
  { key: "problem", label: "Problem" },
  { key: "approach", label: "Build" },
  { key: "outcome", label: "Result" },
] as const;

export default function ProjectDetail({ project }: Props) {
  const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
  const previous = projects[(projectIndex - 1 + projects.length) % projects.length];
  const next = projects[(projectIndex + 1) % projects.length];
  const gallery = project.media.gallery ?? [];
  const heroAsset = gallery[0] ?? project.media.cover;
  const proofItems = project.proof
    .split("·")
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <PortfolioShell heroName={false} routeMode="case">
      <div className="content-layer">
        <article id="main-content" className={styles.page} data-project={project.slug} data-water-section="case">
          <CaseArrivalWater />
          <ProjectTransitionLink href="/#projects" className={styles.back} transitionDirection="back">
            <span aria-hidden="true">←</span>
            Back to work
          </ProjectTransitionLink>

          <header className={styles.hero}>
            <div className={styles.heroHeading}>
              <p className={styles.eyebrow}>{project.subtitle}</p>
              <h1>{project.title}</h1>
              <p className={styles.tagline}>{project.tagline}</p>
            </div>

            <dl className={styles.meta}>
              <div><dt>Role</dt><dd>{project.role}</dd></div>
              <div><dt>Year</dt><dd>{project.year}</dd></div>
              <div><dt>Status</dt><dd>{project.status}</dd></div>
            </dl>

            <figure className={styles.heroMedia} data-liquid-hover style={{ viewTransitionName: `project-${project.slug}` }}>
              <Image
                src={heroAsset.src}
                alt={heroAsset.alt}
                width={heroAsset.width}
                height={heroAsset.height}
                sizes="(max-width: 900px) 100vw, 90vw"
                className={styles.heroImage}
                priority
                unoptimized={heroAsset.src.endsWith(".svg")}
              />
            </figure>
          </header>

          <section className={styles.proofBand} aria-label="Verified project evidence">
            {proofItems.map((item) => <p key={item}>{item}</p>)}
          </section>

          <section className={styles.caseBody} aria-labelledby="case-story-title">
            <aside className={styles.overview}>
              <p className={styles.sectionLabel}>What shipped</p>
              <h2 id="case-story-title">Built from constraint to evidence.</h2>
              <p>{project.description}</p>
              {project.cautionLabel ? <p className={styles.caution}>{project.cautionLabel}</p> : null}

              <ul className={styles.stack} aria-label="Technology stack">
                {project.stack.map((technology) => <li key={technology}>{technology}</li>)}
              </ul>

              {project.verifiedLinks.length > 0 ? (
                <div className={styles.links}>
                  {project.verifiedLinks.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label} <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>

            <div className={styles.chapters}>
              {chapters.map((chapter) => (
                <section key={chapter.key} className={styles.chapter}>
                  <h3>{chapter.label}</h3>
                  <p>{project[chapter.key]}</p>
                </section>
              ))}
            </div>
          </section>

          {gallery.length > 0 ? (
            <section className={styles.gallery} aria-labelledby="case-gallery-title">
              <header>
                <p className={styles.sectionLabel}>Evidence</p>
                <h2 id="case-gallery-title">Inside the system</h2>
              </header>
              <div className={styles.galleryGrid}>
                {gallery.map((asset, index) => (
                  <figure key={asset.src} className={styles.galleryItem} data-wide={index === 0 ? "true" : "false"}>
                    <div className={styles.galleryMedia}>
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        sizes={index === 0 ? "100vw" : "(max-width: 760px) 100vw, 50vw"}
                        className={styles.galleryImage}
                        unoptimized={asset.src.endsWith(".svg")}
                      />
                    </div>
                    {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <nav className={styles.pagination} aria-label="Project navigation">
            <ProjectTransitionLink href={`/project/${previous.slug}`} transitionDirection="back">
              <small>Previous</small><strong>{previous.title}</strong>
            </ProjectTransitionLink>
            <ProjectTransitionLink href={`/project/${next.slug}`}>
              <small>Next</small><strong>{next.title}</strong>
            </ProjectTransitionLink>
          </nav>

          <footer className={styles.footer}>
            <p>© {new Date().getFullYear()} {bio.name}</p>
            <a href={`mailto:${bio.email}`}>{bio.email}</a>
          </footer>
        </article>
      </div>
    </PortfolioShell>
  );
}
