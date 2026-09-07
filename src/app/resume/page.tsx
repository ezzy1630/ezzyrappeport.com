import type { Metadata } from "next";
import Link from "next/link";
import { bio, projects } from "@/lib/portfolio/content";
import { portfolioIdentity } from "@/lib/portfolio/identity";
import { featuredPresentation, featuredSlugs } from "@/components/playground/catalog";
import styles from "./resume.module.css";

export const metadata: Metadata = {
  title: `Resume - ${portfolioIdentity.name}`,
  description: `${portfolioIdentity.role}. AI systems, developer tools, and product software.`,
  alternates: { canonical: "/resume" },
};

const skills = ["TypeScript / React / Next.js", "Rust", "Python", "Swift / SwiftUI", "Agent systems", "Verification & evals", "WebGL / GLSL"];

export default function ResumePage() {
  return (
    <div className={styles.document}>
      <a className={styles.skip} href="#main-content">Skip to résumé</a>
      <div className={styles.toolbar}>
        <Link href="/">← Ezzy Rappeport</Link>
        <a href="/resume.pdf" download>Download PDF ↗</a>
      </div>
      <main id="main-content" className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Software Engineer / AI Systems / Founder</p>
          <h1>{bio.name}</h1>
          <p className={styles.lede}>{bio.heroSentence}</p>
          <div className={styles.meta}>
            <a href={`mailto:${bio.email}`}>{bio.email}</a>
            <span>{bio.location.subtitle}</span>
            <a href={portfolioIdentity.domain}>ezzyrappeport.com</a>
            <a href="https://github.com/ezzy1630">GitHub / ezzy1630</a>
          </div>
        </header>
        <section className={styles.block} aria-labelledby="resume-summary">
          <h2 id="resume-summary">About</h2>
          <p>I build across product interfaces and the systems behind them, with a focus on agent tooling, native software, and verification. Based in California and open to software and AI opportunities.</p>
        </section>
        <section className={styles.block} aria-labelledby="resume-projects">
          <h2 id="resume-projects">Selected work</h2>
          <ul className={styles.projects}>
            {featuredSlugs.map(slug => {
              const project = projects.find(item => item.slug === slug)!;
              const presentation = featuredPresentation[slug];
              return (
                <li key={slug}>
                  <div className={styles.projectHead}>
                    <h3><Link href={`/project/${slug}`}>{project.title}</Link></h3>
                    <span>{project.role} · {project.year}</span>
                  </div>
                  <p>{presentation.purpose}</p>
                  <p className={styles.proof}>{presentation.delivered}</p>
                </li>
              );
            })}
          </ul>
        </section>
        <section className={styles.block} aria-labelledby="resume-skills">
          <h2 id="resume-skills">Tools &amp; practice</h2>
          <ul className={styles.skills}>{skills.map(skill => <li key={skill}>{skill}</li>)}</ul>
        </section>
      </main>
    </div>
  );
}
