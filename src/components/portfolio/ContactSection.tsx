import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

export default function ContactSection() {
  return (
    <section id="contact" className="contact-section" aria-labelledby="contact-title">
      <div className="contact-section__inner">
        <div className="contact-basin">
          <div className="contact-basin__copy">
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
          <a
            className="contact-section__email"
            href={`mailto:${bio.email}`}
            aria-label={`Start a conversation with ${bio.name} by email`}
          >
            <span className="contact-section__email-mark" aria-hidden="true">
              <Mail />
            </span>
            <span className="contact-section__email-copy">
              <span>{bio.email}</span>
            </span>
            <span className="contact-section__email-icon" aria-hidden="true">
              <ArrowUpRight />
            </span>
          </a>
          <p className="contact-section__location"><MapPin aria-hidden="true" />{bio.location.title}</p>
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
