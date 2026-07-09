"use client";

import { usePathname } from "next/navigation";
import { bio, nav } from "@/lib/portfolio/content";

export default function Navigation() {
  const onHome = usePathname() === "/";

  return (
    <header className="site-nav">
      <a
        href={onHome ? "#top" : "/"}
        className="site-nav-brand"
        aria-label={`${nav.fullName} — home`}
      >
        <span className="site-nav-monogram">{nav.brand}</span>
        <span className="site-nav-name">{nav.fullName}</span>
      </a>

      <nav className="site-nav-links" aria-label="Primary navigation">
        {nav.links.map((link) => (
          <a key={link.href} href={onHome ? link.href : `/${link.href}`}>
            {link.label}
          </a>
        ))}
      </nav>

      <a href={`mailto:${bio.email}`} className="site-nav-cta">
        <span>{nav.cta.label}</span>
        <i aria-hidden="true" />
      </a>
    </header>
  );
}
