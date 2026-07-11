import { experience } from "@/lib/portfolio/content";
import styles from "./ExperienceSection.module.css";

export default function ExperienceSection() {
  return (
    <section id="experience" className={styles.section} aria-labelledby="experience-title">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Experience / selected chapters</p>
          <h2 id="experience-title">Work that survives contact with reality.</h2>
        </div>
        <p className={styles.intro}>
          Founder, founding engineer, and platform builder across agent systems,
          medical imaging, education, and compliance infrastructure.
        </p>
      </header>

      <ol className={styles.list}>
        {experience.map((entry, index) => (
          <li key={`${entry.company}-${entry.period}`} className={styles.entry}>
            <div className={styles.index} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className={styles.meta}>
              <time dateTime={entry.period.slice(0, 4)}>{entry.period}</time>
              <span>{entry.location}</span>
            </div>
            <div className={styles.body}>
              <div className={styles.title}>
                <h3>{entry.company}</h3>
                <p>{entry.role}</p>
              </div>
              <p className={styles.summary}>{entry.summary}</p>
              <dl className={styles.proof}>
                <div>
                  <dt>Proof</dt>
                  <dd>{entry.highlights[0]}</dd>
                </div>
                <div>
                  <dt>Stack</dt>
                  <dd>{entry.stack.join(" · ")}</dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
