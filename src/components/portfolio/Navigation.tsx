"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, Waves, X } from "lucide-react";
import { bio, nav } from "@/lib/portfolio/content";

type Props = {
  motionEnabled: boolean;
  onToggleMotion: () => void;
};

export default function Navigation({ motionEnabled, onToggleMotion }: Props) {
  const onHome = usePathname() === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const hrefFor = (href: string) => (onHome ? href : `/${href}`);

  return (
    <header className="site-nav" data-menu-open={menuOpen ? "true" : "false"}>
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
          <a key={link.href} href={hrefFor(link.href)}>
            {link.label}
          </a>
        ))}
      </nav>

      <div className="site-nav-actions">
        <button
          type="button"
          className="site-nav-motion"
          aria-pressed={motionEnabled}
          aria-label={motionEnabled ? "Turn motion off" : "Turn motion on"}
          title={motionEnabled ? "Turn motion off" : "Turn motion on"}
          onClick={onToggleMotion}
        >
          <Waves aria-hidden="true" />
        </button>
        <a href={onHome ? nav.cta.href : `/${nav.cta.href}`} className="site-nav-cta">
          <span>{nav.cta.label}</span>
          <i aria-hidden="true" />
        </a>
        <button
          type="button"
          className="site-nav-menu-button"
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <div id="mobile-navigation" className="mobile-navigation" aria-hidden={!menuOpen} inert={!menuOpen}>
        <nav aria-label="Mobile navigation">
          {nav.links.map((link, index) => (
            <a key={link.href} href={hrefFor(link.href)} onClick={() => setMenuOpen(false)}>
              <span>0{index + 1}</span>{link.label}
            </a>
          ))}
        </nav>
        <div className="mobile-navigation__secondary">
          {bio.socials.filter((social) => social.label !== "Email").map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noopener noreferrer">
              {social.label} ↗
            </a>
          ))}
          <button type="button" onClick={onToggleMotion}>
            Motion: {motionEnabled ? "On" : "Off"}
          </button>
        </div>
        <a className="mobile-navigation__contact" href={onHome ? "#contact" : "/#contact"} onClick={() => setMenuOpen(false)}>
          Get in touch <span aria-hidden="true">↘</span>
        </a>
      </div>
    </header>
  );
}
