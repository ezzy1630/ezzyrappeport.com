import { sectionAnchors } from "@/lib/portfolio/content";

export default function SectionAnchors() {
  return (
    <nav className="hero-section-anchors" aria-label="Portfolio sections">
      {sectionAnchors.map((anchor, index) => (
        <a key={anchor.href} href={anchor.href} data-cursor="hover">
          <span>
            {anchor.label}
            {index === 0 && <i aria-hidden="true" />}
          </span>
          <small>{anchor.subtitle}</small>
        </a>
      ))}
    </nav>
  );
}
