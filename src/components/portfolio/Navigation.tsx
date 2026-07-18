"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, Waves, X } from "lucide-react";
import { bio, nav } from "@/lib/portfolio/content";
import styles from "./Navigation.module.css";

type Props = {
  motionEnabled: boolean;
  onToggleMotion: () => void;
};

export default function Navigation({ motionEnabled, onToggleMotion }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > Math.min(72, window.innerHeight * 0.08));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const panel = mobileNavigationRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFirstItem = () => panel?.querySelector<HTMLElement>(focusableSelector)?.focus();
    window.requestAnimationFrame(focusFirstItem);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = [...panel.querySelectorAll<HTMLElement>(focusableSelector)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMenu, menuOpen]);

  const hrefFor = (href: string) => `/${href}`;

  return (
    <header
      className="site-nav"
      data-menu-open={menuOpen ? "true" : "false"}
      data-scrolled={scrolled ? "true" : "false"}
    >
      <Link
        href="/#top"
        className="site-nav-brand"
        aria-label={`${nav.fullName} — home`}
      >
        <span className="site-nav-monogram">
          <Image
            src="/assets/ezzy-headshot.jpg"
            alt=""
            width={46}
            height={46}
            sizes="46px"
            className="site-nav-headshot"
          />
        </span>
        <span className="site-nav-name">{nav.fullName}</span>
      </Link>

      <nav className="site-nav-links" aria-label="Primary navigation">
        {nav.links.map((link) => (
          <Link key={link.href} href={hrefFor(link.href)}>
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="site-nav-actions">
        <button
          type="button"
          className={`site-nav-motion ${styles.navigationControl}`}
          aria-pressed={motionEnabled}
          aria-label={motionEnabled ? "Turn motion off" : "Turn motion on"}
          title={motionEnabled ? "Turn motion off" : "Turn motion on"}
          onClick={onToggleMotion}
        >
          <Waves aria-hidden="true" />
        </button>
        <Link href={`/${nav.cta.href}`} className="site-nav-cta">
          <span>{nav.cta.label}</span>
        </Link>
        <button
          type="button"
          ref={menuButtonRef}
          className={`site-nav-menu-button ${styles.navigationControl}`}
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      <div
        ref={mobileNavigationRef}
        id="mobile-navigation"
        className="mobile-navigation"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <nav aria-label="Mobile navigation">
          {nav.links.map((link, index) => (
            <Link key={link.href} href={hrefFor(link.href)} onClick={closeMenu}>
              <span>0{index + 1}</span>{link.label}
            </Link>
          ))}
        </nav>
        <div className="mobile-navigation__secondary">
          {bio.socials.filter((social) => social.label !== "Email").map((social) => (
            <a
              key={social.label}
              className={styles.mobileNavigationTouchTarget}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
            >
              {social.label} ↗
            </a>
          ))}
          <button
            type="button"
            className={styles.mobileNavigationTouchTarget}
            aria-pressed={motionEnabled}
            onClick={onToggleMotion}
          >
            Motion: {motionEnabled ? "On" : "Off"}
          </button>
        </div>
        <Link className="mobile-navigation__contact" href="/#contact" onClick={closeMenu}>
          Get in touch <span aria-hidden="true">↘</span>
        </Link>
      </div>
    </header>
  );
}
