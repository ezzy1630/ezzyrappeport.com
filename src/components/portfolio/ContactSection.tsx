import { ArrowUpRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function ContactSection() {
  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="contact-section__inner">
        <div className="contact-basin">
          <div className="contact-basin__copy">
            <p className="contact-section__eyebrow"><i aria-hidden="true" /> Available for ambitious work</p>
            <h2 id="contact-title">Let’s build something difficult—and make it real.</h2>
          </div>
          <a className="contact-section__email" href={`mailto:${bio.email}`}>
            <span>{bio.email}</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
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
              >
                {social.label}<ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <p className="contact-footer__meta">
            <span>© {new Date().getFullYear()}</span>
            <span>Designed &amp; engineered in California</span>
          </p>
        </footer>
      </div>
    </section>
  );
}
