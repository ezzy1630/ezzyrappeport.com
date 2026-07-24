import type { Metadata } from "next";
import Link from "next/link";
import { bio, projects } from "@/lib/portfolio/content";
import { portfolioIdentity } from "@/lib/portfolio/identity";
import PortfolioShell from "@/components/portfolio/PortfolioShell";
import styles from "./resume.module.css";

export const metadata: Metadata = {
  title: `Resume - ${portfolioIdentity.name}`,
  description: `${portfolioIdentity.role}. AI systems, developer tools, and product software.`,
  alternates: { canonical: "/resume" },
};

const skills = [
  "Multi-agent systems",
  "TypeScript / React / Next.js",
  "Python",
  "WebGL / GLSL",
  "Systems design",
  "Verification & evals",
  "Product engineering",
  "Founder / 0→1",
];

export default function ResumePage() {
  return (
    <PortfolioShell heroName={false} routeMode="index">
      <main id="main-content" className={styles.page} data-depth-band="surface">
        <div className={styles.toolbar} data-print-hide>
          <Link href="/" className={styles.back}>
            ← Surface
          </Link>
          <a href="/resume.pdf" className={styles.download} download>
            Download PDF
          </a>
        </div>

        <header className={styles.header}>
          <p className={styles.eyebrow}>{portfolioIdentity.role}</p>
          <h1>{bio.name}</h1>
          <p className={styles.lede}>{bio.heroSentence}</p>
          <p className={styles.meta}>
            <a href={`mailto:${bio.email}`}>{bio.email}</a>
            <span>{bio.location.subtitle}</span>
            <a href={portfolioIdentity.domain} target="_blank" rel="noopener noreferrer">
              ezzyrappeport.com
            </a>
          </p>
        </header>

        <section className={styles.block} aria-labelledby="resume-summary">
          <h2 id="resume-summary">Summary</h2>
          <p>{bio.bodyParagraphs[1]}</p>
        </section>

        <section className={styles.block} aria-labelledby="resume-projects">
          <h2 id="resume-projects">Selected work</h2>
          <ul className={styles.projects}>
            {projects.map((project) => (
              <li key={project.slug}>
                <div className={styles.projectHead}>
                  <h3>{project.title}</h3>
                  <span>{project.year}</span>
                </div>
                <p className={styles.role}>{project.role}</p>
                <p>{project.outcome}</p>
                <p className={styles.proof}>{project.proof}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.block} aria-labelledby="resume-skills">
          <h2 id="resume-skills">Skills</h2>
          <ul className={styles.skills}>
            {skills.map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
        </section>

        <section className={styles.block} aria-labelledby="resume-principles">
          <h2 id="resume-principles">Working principles</h2>
          <ul className={styles.principles}>
            {bio.principles.map((principle) => (
              <li key={principle.title}>
                <strong>{principle.title}</strong>
                <span>{principle.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </PortfolioShell>
  );
}
