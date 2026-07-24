import { ArrowUpRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import AbyssEasterEgg from "./AbyssEasterEgg";
import ContactEmailSlab from "./ContactEmailSlab";
import ContactLocation from "./ContactLocation";
import ContactRiseLink from "./ContactRiseLink";

const socialLinks = bio.socials.filter((social) => social.label !== "Email");

/**
 * ContactSection — the ocean floor.
 * Server markup with small client adapters for the email slab, location press,
 * abyss modal, and rise-to-surface control.
 *
 * Footer rows (identity → social → utility) stay explicit so mobile hierarchy
 * does not collapse into a scattered grid.
 */
export default function ContactSection() {
  return (
    <section
      id="contact"
      className="contact-section"
      aria-labelledby="contact-title"
      data-depth-band="deep"
    >
      <div className="contact-section__inner">
        <div className="contact-basin">
          <div className="contact-basin__copy" data-section-reveal>
            <p className="contact-section__eyebrow">Contact</p>
            <h2 id="contact-title" aria-label="Let’s build something that matters.">
              <span aria-hidden="true">Let’s build something</span>
              {" "}
              <span aria-hidden="true">that matters.</span>
            </h2>
            <p className="contact-section__intro">
              I’m always open to discussing AI systems, developer tools,
              product software, or founder work that makes an impact.
            </p>
          </div>
          <ContactEmailSlab />
          <ContactLocation />
        </div>

        <footer className="contact-footer">
          <div className="contact-footer__identity">
            <p>
              <strong>{bio.name}</strong>
              <span>{bio.location.subtitle}</span>
            </p>
          </div>

          <nav className="contact-footer__social" aria-label="Social links">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                data-liquid-hover
                data-magnetic="button"
              >
                {social.label}
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>

          <div className="contact-footer__utility">
            <p className="contact-footer__meta">
              <span>© {new Date().getFullYear()}</span>
              <span>Designed &amp; engineered in California</span>
              <a href="/resume">Resume</a>
            </p>
            <ContactRiseLink />
          </div>

          <div className="contact-footer__abyss">
            <AbyssEasterEgg />
          </div>
        </footer>
      </div>
    </section>
  );
}
