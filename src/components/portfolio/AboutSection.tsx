import { bio } from "@/lib/portfolio/content";

const principles = [
  ["Systems over demos", "I care about the runtime, the failure modes, and the path from a promising prototype to dependable software."],
  ["Evidence over theater", "The strongest product story is a working system with visible constraints, measured outcomes, and honest boundaries."],
  ["Human agency first", "AI should make people more capable without making the decisions, provenance, or consequences harder to inspect."],
];

export default function AboutSection() {
  return (
    <section id="about" className="portfolio-section about-section" aria-labelledby="about-title">
      <header className="section-heading section-heading--compact">
        <div>
          <p className="section-kicker">A working philosophy</p>
          <h2 id="about-title">Research taste. Production instincts.</h2>
        </div>
      </header>

      <div className="about-layout">
        <blockquote>
          “I build at the intersection of engineering and intelligence—then stay
          for the hard part: making the system trustworthy, useful, and real.”
        </blockquote>
        <div className="about-copy">
          {bio.bodyParagraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          <p className="about-signature">
            <span aria-hidden="true">ER</span>
            <span><strong>{bio.name}</strong><small>{bio.taglineParts.join(" · ")}</small></span>
          </p>
        </div>
      </div>

      <div className="principles-grid" aria-label="Operating principles">
        {principles.map(([title, description], index) => (
          <article key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
