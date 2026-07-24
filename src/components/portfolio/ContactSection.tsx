import { ArrowUpRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import AbyssEasterEgg from "./AbyssEasterEgg";
import ContactEmailSlab from "./ContactEmailSlab";
import ContactLocation from "./ContactLocation";
import ContactRiseLink from "./ContactRiseLink";

/**
 * ContactSection — the ocean floor.
 * Server markup with small client adapters for the email slab, location press,
 * abyss modal, and rise-to-surface control.
 */
export default function ContactSection() {
  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title" data-depth-band="deep">
      <div className="contact-section__inner">
        <div className="contact-basin">
          <div className="contact-basin__copy" data-section-reveal>
            <p className="contact-section__eyebrow">Contact</p>
            <h2 id="contact-title">
              <span>Let’s build something</span>
              <span>that matters.</span>
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
          <p>
            <strong>{bio.name}</strong>
            <span>{bio.location.subtitle}</span>
          </p>
          <nav aria-label="Social links">
            {bio.socials.filter((social) => social.label !== "Email").map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                data-liquid-hover
                data-magnetic="button"
              >
                {social.label}<ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <p className="contact-footer__meta">
            <span>© {new Date().getFullYear()}</span>
            <span>Designed &amp; engineered in California</span>
            <a href="/resume">Resume</a>
          </p>
          <AbyssEasterEgg />
          <ContactRiseLink />
        </footer>
      </div>
    </section>
  );
}
