import Image from "next/image";
import type { CSSProperties } from "react";
import {
  bio,
  caseMooringDepth,
  projectDepthBand,
  type Project,
  projects,
} from "@/lib/portfolio/content";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import CaseArrivalWater from "@/components/portfolio/CaseArrivalWater";
import CaseEvidenceRail from "@/components/portfolio/CaseEvidenceRail";
import CaseDescentNav from "@/components/portfolio/CaseDescentNav";
import ProjectTransitionLink from "@/components/portfolio/ProjectTransitionLink";
import ProjectIdentity from "@/components/portfolio/ProjectIdentity";
import SystemDiagram from "@/components/portfolio/diagrams/SystemDiagram";
import styles from "./ProjectDetail.module.css";

type Props = {
  project: Project;
};

const linkKindLabels = {
  source: "Source",
  site: "Live site",
  releases: "Releases",
} as const;

function isArchitectureAsset(src: string) {
  return /architecture\.svg$/i.test(src);
}

export default function ProjectDetail({ project }: Props) {
  const projectIndex = projects.findIndex((candidate) => candidate.slug === project.slug);
  const previous = projects[(projectIndex - 1 + projects.length) % projects.length];
  const next = projects[(projectIndex + 1) % projects.length];
  const gallery = (project.media.gallery ?? []).filter((asset) => !isArchitectureAsset(asset.src));
  const proofItems = project.proof
    .split("·")
    .map((item) => item.trim())
    .filter(Boolean);
  const depth = caseMooringDepth(project.slug);

  return (
    <PortfolioShell heroName={false} routeMode="case">
      <div className="content-layer">
        <main
          id="main-content"
          className={styles.page}
          data-project={project.slug}
          data-accent={project.accent}
          data-depth={depth}
          data-band={projectDepthBand(project.slug)}
          data-water-section="case"
          style={
            {
              "--case-depth": String(depth),
              "--project-scale": project.mediaPresentation.scale,
              "--project-offset-y": project.mediaPresentation.offsetY,
              viewTransitionName: `project-${project.slug}`,
            } as CSSProperties
          }
        >
          <article>
          <CaseArrivalWater accent={project.accent} depth={depth} />

          <ProjectTransitionLink href="/#projects" className={styles.back} transitionDirection="back">
            <span aria-hidden="true">←</span>
            Back to selected work
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

            <figure className={styles.heroMark} data-liquid-hover aria-label={`${project.title} identity`}>
              <ProjectIdentity
                slug={project.slug}
                media={project.media.cover}
                className={styles.heroIdentity}
              />
            </figure>
          </header>

          <section className={styles.proofBand} aria-label="Verified project evidence">
            {proofItems.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </section>

          {project.slug === "nexarad" || project.cautionLabel ? (
            <p className={styles.clinicalNote} role="note">
              {project.slug === "nexarad"
                ? "Demo / Research / Not for Clinical Use"
                : project.cautionLabel}
            </p>
          ) : null}

          <CaseEvidenceRail
            problem={project.problem}
            system={project.system}
            evidence={project.evidence}
            outcome={project.outcome}
          />

          <section className={styles.diagramSection} aria-label="System diagram">
            <SystemDiagram diagram={project.diagram} accent={project.accent} />
          </section>

          <section className={styles.caseBody} aria-labelledby="case-story-title">
            <aside className={styles.overview}>
              <p className={styles.sectionLabel}>Overview</p>
              <h2 id="case-story-title">What shipped</h2>
              <p>{project.description}</p>
              {project.cautionLabel ? <p className={styles.caution}>{project.cautionLabel}</p> : null}

              <ul className={styles.stack} aria-label="Technology stack">
                {project.stack.map((technology) => (
                  <li key={technology}>{technology}</li>
                ))}
              </ul>

              {project.verifiedLinks.length > 0 ? (
                <div className={styles.links} aria-label="Verified project links">
                  {project.verifiedLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{linkKindLabels[link.kind]}</span>
                      <span>{link.label}</span>
                      <span aria-hidden="true">↗</span>
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>

            <div className={styles.chapters}>
              <section className={styles.chapter}>
                <h3>Approach</h3>
                <p>{project.approach}</p>
              </section>
              <section className={styles.chapter}>
                <h3>Constraints</h3>
                <p>{project.constraints}</p>
              </section>
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
                  <figure
                    key={asset.src}
                    className={styles.galleryItem}
                    data-wide={index === 0 && gallery.length > 1 ? "true" : "false"}
                  >
                    <div className={styles.galleryMedia}>
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        sizes={index === 0 ? "100vw" : "(max-width: 760px) 100vw, 50vw"}
                        className={styles.galleryImage}
                        priority={index === 0}
                        unoptimized={asset.src.endsWith(".svg")}
                      />
                    </div>
                    {asset.caption ? <figcaption>{asset.caption}</figcaption> : null}
                  </figure>
                ))}
              </div>
            </section>
          ) : null}

          <CaseDescentNav
            previous={{ slug: previous.slug, title: previous.title, tagline: previous.tagline }}
            next={{ slug: next.slug, title: next.title, tagline: next.tagline }}
          />

          <footer className={styles.footer}>
            <p>© {new Date().getFullYear()} {bio.name}</p>
            <a href={`mailto:${bio.email}`} aria-label={`Email ${bio.name} at ${bio.email}`}>
              {bio.emailLabel}
            </a>
          </footer>
          </article>
        </main>
      </div>
    </PortfolioShell>
  );
}
