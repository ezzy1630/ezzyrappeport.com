"use client";

import { motion } from "framer-motion";
import { nav } from "@/lib/portfolio/content";
import { ArrowUpRight } from "lucide-react";

/**
 * Navigation
 * -----------
 * Floating top nav — no hard container, just floating glass elements:
 *  - Left: ER circular pill logo + "ELIEZER RAPPEPORT" name label
 *  - Center: Projects / Experience / About links
 *  - Right: "Get In Touch" pill button with electric-blue accent dot
 *
 * Appears after a small delay on mount (cinematic).
 */
export default function Navigation() {
  return (
    <motion.header
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 1.0, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="site-nav fixed top-0 left-0 right-0 z-50 px-6 md:px-10 lg:px-14 py-5 md:py-6 flex items-center justify-between pointer-events-none"
    >
      {/* Left — Brand */}
      <a
        href="#top"
        className="site-nav-brand pointer-events-auto flex items-center gap-3 md:gap-4 group"
        aria-label={`${nav.fullName} — back to top`}
      >
        <span
          className="glass grid place-items-center w-11 h-11 md:w-12 md:h-12 rounded-full italic font-black text-[15px] md:text-[16px] text-ink transition-transform duration-500 group-hover:scale-105"
          style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
        >
          {nav.brand}
        </span>
        <span className="hidden sm:inline text-[13px] md:text-[14px] font-medium text-ink/86 tracking-normal">
          {nav.fullName}
        </span>
      </a>

      {/* Center — Links */}
      <nav
        className="hidden md:flex items-center gap-12 pointer-events-auto"
        aria-label="Primary"
      >
        {nav.links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="relative text-[13px] tracking-normal font-medium text-ink/75 hover:text-ink transition-colors duration-300"
          >
            {link.label}
            <span className="pointer-events-none absolute -bottom-1.5 left-0 right-0 h-px bg-electric scale-x-0 hover:scale-x-100 transition-transform origin-left duration-500" />
          </a>
        ))}
      </nav>

      {/* Right — CTA */}
      <a
        href={nav.cta.href}
        className="site-nav-cta pointer-events-auto glass rounded-full pl-5 pr-4 py-2.5 md:pl-6 md:pr-4 md:py-3 flex items-center gap-3 md:gap-4 text-[13px] font-medium text-ink hover:scale-[1.02] active:scale-[0.98] transition-transform duration-300"
      >
        <span className="hidden sm:inline">{nav.cta.label}</span>
        <span className="sm:hidden">Contact</span>
        <span className="relative grid place-items-center w-4 h-4">
          <span className="w-2 h-2 rounded-full bg-electric pulse-dot shadow-[0_0_12px_rgba(0,102,255,0.55)]" />
        </span>
      </a>
    </motion.header>
  );
}

// Re-export the icon usage so tree-shaking keeps it
void ArrowUpRight;
