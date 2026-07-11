import { bio } from "@/lib/portfolio/content";
import styles from "./AboutSection.module.css";

const principles = [
  ["Systems over demos", "I care about the runtime, the failure modes, and the path from a promising prototype to dependable software."],
  ["Evidence over theater", "The strongest product story is a working system with visible constraints, measured outcomes, and honest boundaries."],
  ["Human agency first", "AI should make people more capable without making the decisions, provenance, or consequences harder to inspect."],
];

export default function AboutSection() {
  return (
    <section id="about" className={styles.section} aria-labelledby="about-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>A working philosophy</p>
          <h2 id="about-title">Research taste. Production instincts.</h2>
        </div>
      </header>

      <div className={styles.layout}>
        <blockquote>
          “I build at the intersection of engineering and intelligence—then stay
          for the hard part: making the system trustworthy, useful, and real.”
        </blockquote>
        <div className={styles.copy}>
          {bio.bodyParagraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p className={styles.signature}>
            <span aria-hidden="true">ER</span>
            <span><strong>{bio.name}</strong><small>{bio.taglineParts.join(" · ")}</small></span>
          </p>
        </div>
      </div>

      <ol className={styles.principles} aria-label="Operating principles">
        {principles.map(([title, description], index) => (
          <li key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
