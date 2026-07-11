import { sectionAnchors } from "@/lib/portfolio/content";
import Link from "next/link";

export default function SectionAnchors() {
  return (
    <nav className="hero-section-anchors" aria-label="Portfolio sections">
      {sectionAnchors.map((anchor, index) => (
        <Link key={anchor.href} href={`/${anchor.href}`} data-cursor="hover">
          <span>
            {anchor.label}
            {index === 0 && <i aria-hidden="true" />}
          </span>
          <small>{anchor.subtitle}</small>
        </Link>
      ))}
    </nav>
  );
}
