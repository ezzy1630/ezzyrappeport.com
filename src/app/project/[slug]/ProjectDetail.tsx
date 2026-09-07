import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowRight } from "lucide-react";
import { type Project, projects, bio } from "@/lib/portfolio/content";
import { featuredPresentation, featuredSlugs } from "@/components/playground/catalog";
import WaterHero from "@/components/water-study/WaterHero";
import SystemDiagram from "@/components/portfolio/diagrams/SystemDiagram";
import styles from "./CaseStudy.module.css";

export default function ProjectDetail({ project }: { project: Project }) {
  // Continue in the same order as the homepage gallery, then the remaining work.
  const featured = new Set<string>(featuredSlugs);
  const ordered = [
    ...featuredSlugs.flatMap(slug => projects.filter(item => item.slug === slug)),
    ...projects.filter(item => !featured.has(item.slug)),
  ];
  const index = ordered.findIndex((item) => item.slug === project.slug);
  const next = ordered[(index + 1) % ordered.length];
  const gallery = (project.media.gallery ?? [project.media.cover]).filter(
    (asset) => !asset.src.endsWith("architecture.svg"),
  );
  const presentation = featuredSlugs.find(slug => slug === project.slug);
  const illustration = presentation ? featuredPresentation[presentation] : undefined;
  const leadImage = gallery.find(
    (asset) => !asset.src.endsWith(".svg") && asset.width / asset.height > 1.2,
  );
  return (
    <div className={styles.page} data-water-world>
      <WaterHero showTitle={false} />
      <a className={styles.skip} href="#overview">
        Skip to project details
      </a>
      <header className={styles.nav}>
        <Link href="/#projects">
          <ArrowLeft size={18} /> All projects
        </Link>
        <Link href="/">EZZY RAPPEPORT</Link>
        <a href={`mailto:${bio.email}`}>
          Get in touch <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main-content">
        <header className={styles.hero}>
          <p className={styles.meta}>
            {project.year} / {project.role}
          </p>
          <div className={styles.titleRow}>
            {illustration && <Image className={styles.projectMark} src={illustration.cover} alt="" width={80} height={80} sizes="80px" />}
            <h1>{project.title}</h1>
          </div>
          <p className={styles.tagline}>{illustration?.purpose ?? project.tagline}</p>
          <div className={styles.links}>
            {project.verifiedLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
          <dl className={styles.facts}>
            <div>
              <dt>Status</dt>
              <dd>{project.status}</dd>
            </div>
            <div>
              <dt>Built with</dt>
              <dd>{project.stack.join(" / ")}</dd>
            </div>
          </dl>
          {leadImage && (
            <figure className={styles.leadImage}>
              <a
                href={leadImage.src}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open full-size image: ${leadImage.alt}`}
              >
                <Image
                  src={leadImage.src}
                  alt={leadImage.alt}
                  width={leadImage.width}
                  height={leadImage.height}
                  sizes="(max-width: 700px) 88vw, 84vw"
                  priority
                />
              </a>
              <figcaption>
                {leadImage.caption} <span>Open full size ↗</span>
              </figcaption>
            </figure>
          )}
        </header>
        <div className={styles.body}>
          <aside aria-label="Project sections">
            <p>IN THIS PROJECT</p>
            <a href="#overview">Overview</a>
            <a href="#approach">Approach</a>
            <a href="#evidence">Evidence</a>
            <a href="#outcome">Outcome</a>
          </aside>
          <article>
            <section id="overview" tabIndex={-1}>
              <h2>The idea</h2>
              <p>{project.description}</p>
              <h3>The problem</h3>
              <p>{project.problem}</p>
            </section>
            <section id="approach">
              <h2>How it works</h2>
              <p>{project.approach}</p>
              <div className={styles.diagram}>
                <SystemDiagram
                  diagram={project.diagram}
                  accent={project.accent}
                />
              </div>
              <p>{project.system}</p>
            </section>
            <section id="evidence">
              <h2>The work</h2>
              <p>{project.evidence}</p>
              {gallery
                .filter((asset) => asset !== leadImage)
                .map((asset) => (
                  <figure key={asset.src}>
                    <a
                      href={asset.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open full-size image: ${asset.alt}`}
                    >
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={asset.width}
                        height={asset.height}
                        sizes="(max-width: 700px) 90vw, 65vw"
                      />
                    </a>
                    {asset.caption && <figcaption>{asset.caption}</figcaption>}
                  </figure>
                ))}
              <p className={styles.proof}>{project.proof}</p>
            </section>
            <section id="outcome">
              <h2>Where it stands</h2>
              <p>{project.outcome}</p>
              <h3>{project.cautionLabel || "Scope and constraints"}</h3>
              <p>{project.constraints}</p>
            </section>
          </article>
        </div>
        <Link className={styles.next} href={`/project/${next.slug}`}>
          <span>Next project</span>
          <h2>
            {next.title}
            <ArrowRight />
          </h2>
        </Link>
      </main>
      <footer>
        <Link href="/#projects">All projects</Link>
        <a href={`mailto:${bio.email}`}>
          Let’s talk <ArrowUpRight size={16} />
        </a>
      </footer>
    </div>
  );
}
