"use client";

import { motion } from "framer-motion";
import { sectionAnchors } from "@/lib/portfolio/content";

/**
 * SectionAnchors
 * --------------
 * Bottom edge of the viewport — three evenly spaced anchor groups:
 *  PROJECTS — Ideas into impact
 *  EXPERIENCE — Engineering that scales
 *  ABOUT — Purpose & vision
 *
 * Each is a link that smooth-scrolls to its section. Subtle vertical
 * pale-gray separators between groups. First group gets a small blue accent dot.
 */
export default function SectionAnchors() {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 1.6, ease: [0.22, 1, 0.36, 1] }}
      className="absolute bottom-0 left-0 right-0 z-30 px-6 md:px-10 lg:px-14 py-3 md:py-4"
    >
      <div className="grid grid-cols-3 gap-0 max-w-[52rem] mx-auto">
        {sectionAnchors.map((anchor, i) => (
          <a
            key={anchor.href}
            href={anchor.href}
            className={`group flex flex-col gap-1 px-2 md:px-8 ${
              i > 0 ? "border-l border-ink/12" : ""
            }`}
            data-cursor="hover"
          >
            <span className="flex items-center gap-2 text-[11px] md:text-[12px] uppercase tracking-normal font-medium text-ink/78 group-hover:text-ink transition-colors">
              {anchor.label}
              {i === 0 && (
                <span
                  aria-hidden="true"
                  className="w-1 h-1 rounded-full bg-electric"
                />
              )}
            </span>
            <span className="hidden md:inline text-[11px] text-ink-soft/62">
              {anchor.subtitle}
            </span>
          </a>
        ))}
      </div>
    </motion.div>
  );
}
