import Image from "next/image";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import AboutDepthPlanes from "./AboutDepthPlanes";
import styles from "./AboutSection.module.css";

/**
 * AboutSection — the calm mid-column pocket.
 * Quietest water on the site: damped ripples, soft reading light, and
 * content on slight depth planes. Pointer shifts planes a few pixels —
 * enough to feel depth, never enough to chase the text. Principles ride
 * the same water (no fog wash) so the descent into Contact stays clean.
 *
 * Markup is server-rendered; AboutDepthPlanes is the only client adapter.
 */
export default function AboutSection() {
  return (
    <section
      id="about"
      className={styles.section}
      aria-labelledby="about-title"
      data-depth-band="mid"
    >
      <header className={styles.header} data-section-reveal>
        <h2 id="about-title">Research taste. Production instincts.</h2>
      </header>

      <div className={styles.layout}>
        <div className={styles.story} data-depth-plane="0.45">
          <blockquote>
            {bio.quoteLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </blockquote>
          <div className={styles.copy}>
            {bio.bodyParagraphs.slice(1).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className={styles.signature}>
              <span aria-hidden="true">ER</span>
              <span><strong>{bio.name}</strong><small>{bio.taglineParts.join(" · ")}</small></span>
            </p>
          </div>
        </div>
        <figure className={styles.portrait} data-depth-plane="1">
          <div className={styles.portraitFrame}>
            <Image
              src="/assets/ezzy-headshot.jpg"
              alt={`Portrait of ${bio.name}`}
              width={720}
              height={900}
              sizes="(max-width: 760px) 72vw, 34vw"
              className={styles.portraitImage}
            />
            <span className={styles.portraitWater} aria-hidden="true" />
          </div>
          <figcaption><MapPin aria-hidden="true" />{bio.location.title}</figcaption>
        </figure>
      </div>

      <ul className={styles.principles} aria-label="Operating principles" data-depth-plane="0.65">
        {bio.principles.map((principle) => (
          <li key={principle.title}>
            <h3>{principle.title}</h3>
            <p>{principle.description}</p>
          </li>
        ))}
      </ul>
      <AboutDepthPlanes />
    </section>
  );
}
