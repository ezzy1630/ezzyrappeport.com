import { experience } from "@/lib/portfolio/content";

export default function ExperienceSection() {
  return (
    <section id="experience" className="portfolio-section experience-section" aria-labelledby="experience-title">
      <header className="section-heading">
        <div>
          <p className="section-kicker">Experience / selected chapters</p>
          <h2 id="experience-title">Work that survives contact with reality.</h2>
        </div>
        <p>
          Founder, founding engineer, and platform builder across agent systems,
          medical imaging, education, and compliance infrastructure.
        </p>
      </header>

      <ol className="experience-list">
        {experience.map((entry, index) => (
          <li key={`${entry.company}-${entry.period}`} className="experience-entry">
            <div className="experience-entry__index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="experience-entry__meta">
              <time>{entry.period}</time>
              <span>{entry.location}</span>
            </div>
            <div className="experience-entry__body">
              <div className="experience-entry__title">
                <h3>{entry.company}</h3>
                <p>{entry.role}</p>
              </div>
              <p className="experience-entry__summary">{entry.summary}</p>
              <ul className="experience-entry__highlights">
                {entry.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
              </ul>
              <p className="experience-entry__stack" aria-label={`Tools used: ${entry.stack.join(", ")}`}>
                {entry.stack.map((item) => <span key={item}>{item}</span>)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
