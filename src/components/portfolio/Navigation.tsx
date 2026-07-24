"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Volume2, VolumeX, Waves, X } from "lucide-react";
import { bio, nav } from "@/lib/portfolio/content";
import { subscribeFrameClock, unsubscribeFrameClock } from "@/lib/portfolio/frame-clock";
import {
  isCasePathname,
  isNavTheme,
  navThemeFromSection,
  type NavTheme,
} from "@/lib/portfolio/nav-theme";
import {
  initSoundFromStorage,
  isSoundEnabled,
  setSoundEnabled,
} from "@/lib/portfolio/sound";
import styles from "./Navigation.module.css";

type Props = {
  motionEnabled: boolean;
  onToggleMotion: () => void;
};

const RIPPLE_CLOCK_ID = "portfolio.nav-ripple";
const RIPPLE_STIFFNESS = 280;
const RIPPLE_DAMPING = 22;

/**
 * Continuous depth/ripple metrics write directly to the DOM.
 * React state updates only for discrete chrome changes (menu, sound, active link, theme band).
 */
export default function Navigation({ motionEnabled, onToggleMotion }: Props) {
  const pathname = usePathname() ?? "/";
  const caseOnLoad = isCasePathname(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(caseOnLoad ? "case" : "hero");
  const [navTheme, setNavTheme] = useState<NavTheme>("ink-on-light");
  const [isCaseRoute, setIsCaseRoute] = useState(caseOnLoad);
  const [scrolled, setScrolled] = useState(caseOnLoad);
  const [rippleVisible, setRippleVisible] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const linksRef = useRef<HTMLElement>(null);
  const rippleRef = useRef<HTMLSpanElement>(null);
  const depthMarkRef = useRef<HTMLSpanElement>(null);
  const activeSectionRef = useRef(caseOnLoad ? "case" : "hero");
  const navThemeRef = useRef<NavTheme>("ink-on-light");
  const scrolledRef = useRef(caseOnLoad);
  const isCaseRef = useRef(caseOnLoad);
  const rippleVisibleRef = useRef(false);
  const rippleSpringRef = useRef({
    left: 0,
    width: 0,
    targetLeft: 0,
    targetWidth: 0,
    vLeft: 0,
    vWidth: 0,
  });

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  const syncRipple = useCallback((section: string) => {
    const navEl = linksRef.current;
    const rippleEl = rippleRef.current;
    if (!navEl || !rippleEl) return;
    const active = navEl.querySelector<HTMLAnchorElement>(`a[data-section="${section}"]`);
    if (!active) {
      if (rippleVisibleRef.current) {
        rippleVisibleRef.current = false;
        setRippleVisible(false);
      }
      return;
    }
    const left = active.offsetLeft;
    const width = active.offsetWidth;
    rippleSpringRef.current.targetLeft = left;
    rippleSpringRef.current.targetWidth = width;
    if (!rippleVisibleRef.current) {
      rippleVisibleRef.current = true;
      setRippleVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!motionEnabled) return;
    const spring = rippleSpringRef.current;
    const rippleEl = rippleRef.current;
    if (rippleEl) rippleEl.style.willChange = "transform, width";

    const tick = (_timeMs: number, deltaMs: number) => {
      const el = rippleRef.current;
      if (!el) return;
      const dt = Math.min(32, Math.max(8, deltaMs)) / 1000;
      const ax = (spring.targetLeft - spring.left) * RIPPLE_STIFFNESS - spring.vLeft * RIPPLE_DAMPING;
      const aw = (spring.targetWidth - spring.width) * RIPPLE_STIFFNESS - spring.vWidth * RIPPLE_DAMPING;
      spring.vLeft += ax * dt;
      spring.vWidth += aw * dt;
      spring.left += spring.vLeft * dt;
      spring.width += spring.vWidth * dt;
      el.style.transform = `translateX(${spring.left.toFixed(2)}px)`;
      el.style.width = `${Math.max(0, spring.width).toFixed(2)}px`;
    };

    subscribeFrameClock(RIPPLE_CLOCK_ID, tick);
    return () => {
      unsubscribeFrameClock(RIPPLE_CLOCK_ID);
      if (rippleEl) rippleEl.style.willChange = "";
    };
  }, [motionEnabled]);

  const onNavLinkMove = useCallback((event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!motionEnabled) return;
    const link = event.currentTarget;
    const rect = link.getBoundingClientRect();
    const originPct = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 100;
    link.style.setProperty("--nav-ripple-x", `${originPct.toFixed(2)}%`);
    rippleRef.current?.style.setProperty("--nav-ripple-x", `${originPct.toFixed(2)}%`);
  }, [motionEnabled]);

  useEffect(() => {
    initSoundFromStorage();
    setSoundOn(isSoundEnabled());
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const html = document.documentElement;
      const section = html.dataset.waterSection
        ?? (isCasePathname(window.location.pathname) ? "case" : "hero");
      if (section !== activeSectionRef.current) {
        activeSectionRef.current = section;
        setActiveSection(section);
      }

      // Liquid publishes --world-depth as an inline style on :root — no layout read.
      const portfolioRoot = document.querySelector<HTMLElement>(".portfolio-root");
      const depthRaw = html.style.getPropertyValue("--world-depth").trim()
        || portfolioRoot?.style.getPropertyValue("--world-depth").trim()
        || "";
      let nextDepth = Number.parseFloat(depthRaw);
      if (!Number.isFinite(nextDepth)) nextDepth = 0;
      nextDepth = Math.max(0, Math.min(1, nextDepth));

      if (depthMarkRef.current) {
        depthMarkRef.current.style.setProperty("--nav-depth", nextDepth.toFixed(3));
        depthMarkRef.current.title = `Depth ${Math.round(nextDepth * 100)}%`;
      }

      const publishedTheme = html.dataset.navTheme;
      const nextTheme = isNavTheme(publishedTheme)
        ? publishedTheme
        : navThemeFromSection(section, nextDepth);
      if (nextTheme !== navThemeRef.current) {
        navThemeRef.current = nextTheme;
        setNavTheme(nextTheme);
      }

      const nextCase = section === "case"
        || portfolioRoot?.getAttribute("data-route") === "case"
        || isCasePathname(window.location.pathname);
      if (nextCase !== isCaseRef.current) {
        isCaseRef.current = nextCase;
        setIsCaseRoute(nextCase);
      }

      // Case routes always carry the frosted slab — never wait for scrollY.
      const nextScrolled = nextCase
        || window.scrollY > Math.min(72, window.innerHeight * 0.08);
      if (nextScrolled !== scrolledRef.current) {
        scrolledRef.current = nextScrolled;
        setScrolled(nextScrolled);
      }

      syncRipple(section);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    subscribeFrameClock("portfolio.nav-section", () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    }, { cadenceMs: 80 });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      unsubscribeFrameClock("portfolio.nav-section");
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [syncRipple]);

  useEffect(() => {
    syncRipple(activeSection);
  }, [activeSection, syncRipple]);

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
  const showScrim = scrolled || isCaseRoute;

  return (
    <header
      ref={headerRef}
      className="site-nav"
      data-menu-open={menuOpen ? "true" : "false"}
      data-scrolled={showScrim ? "true" : "false"}
      data-nav-theme={navTheme}
      data-case={isCaseRoute ? "true" : "false"}
    >
      <Link
        href="/#top"
        className="site-nav-brand"
        data-liquid-hover
        aria-label={`${nav.fullName} home`}
      >
        <span className="site-nav-monogram">
          <Image
            src="/assets/ezzy-headshot.jpg"
            alt=""
            width={46}
            height={46}
            sizes="46px"
            priority
            className="site-nav-headshot"
            draggable={false}
          />
        </span>
        <span className="site-nav-name">{nav.fullName}</span>
      </Link>

      <nav ref={linksRef} className="site-nav-links" aria-label="Primary navigation">
        {nav.links.map((link) => {
          const section = link.href.replace("#", "");
          return (
            <Link
              key={link.href}
              href={hrefFor(link.href)}
              data-liquid-hover
              data-magnetic="nav"
              data-section={section}
              data-active={activeSection === section ? "true" : "false"}
              aria-current={activeSection === section ? "true" : undefined}
              onPointerMove={onNavLinkMove}
            >
              {link.label}
            </Link>
          );
        })}
        <span
          ref={rippleRef}
          className="site-nav-ripple"
          aria-hidden="true"
          data-visible={rippleVisible ? "true" : "false"}
        />
        <span
          ref={depthMarkRef}
          className="site-nav-depth"
          aria-hidden="true"
          title="Depth 0%"
        >
          <i data-band="surface" />
          <i data-band="shallow" />
          <i data-band="mid" />
          <i data-band="deep" />
          <b />
        </span>
      </nav>

      <div className="site-nav-actions">
        <button
          type="button"
          className={`site-nav-motion ${styles.navigationControl}`}
          data-liquid-hover
          data-magnetic="button"
          aria-pressed={motionEnabled}
          aria-label={motionEnabled ? "Turn motion off" : "Turn motion on"}
          title={motionEnabled ? "Turn motion off" : "Turn motion on"}
          onClick={onToggleMotion}
        >
          <Waves aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`site-nav-motion ${styles.navigationControl}`}
          data-liquid-hover
          data-magnetic="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
          title={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={() => {
            const next = setSoundEnabled(!soundOn);
            setSoundOn(next);
          }}
        >
          {soundOn ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
        </button>
        <Link href={`/${nav.cta.href}`} className="site-nav-cta rv-pill-fill" data-liquid-hover data-magnetic="button" data-sound-hover>
          <span data-magnetic-label>{nav.cta.label}</span>
        </Link>
        <button
          type="button"
          ref={menuButtonRef}
          className={`site-nav-menu-button ${styles.navigationControl}`}
          data-liquid-hover
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
          {nav.links.map((link) => (
            <Link key={link.href} href={hrefFor(link.href)} onClick={closeMenu}>
              {link.label}
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
          <button
            type="button"
            className={styles.mobileNavigationTouchTarget}
            aria-pressed={soundOn}
            onClick={() => {
              const next = setSoundEnabled(!soundOn);
              setSoundOn(next);
            }}
          >
            Sound: {soundOn ? "On" : "Off"}
          </button>
          <Link className={styles.mobileNavigationTouchTarget} href="/resume" onClick={closeMenu}>
            Resume
          </Link>
        </div>
        <Link className="mobile-navigation__contact" href="/#contact" onClick={closeMenu}>
          Get in touch <span aria-hidden="true">↘</span>
        </Link>
      </div>
    </header>
  );
}
