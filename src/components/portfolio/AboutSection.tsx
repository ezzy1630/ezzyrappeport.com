"use client";

import { motion } from "framer-motion";
import { bio } from "@/lib/portfolio/content";

/**
 * AboutSection
 * ------------
 * Founder/engineer bio with three body paragraphs.
 * Layout: large left quote area + right bio paragraphs.
 */
export default function AboutSection() {
  return (
    <section
      id="about"
      className="depth-section depth-section--about relative px-6 md:px-10 lg:px-14 py-32 md:py-40"
      aria-label="About"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="section-heading max-w-7xl mx-auto mb-16 md:mb-24"
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-ink-soft/55 mb-4">
          Purpose
        </p>
        <h2
          className="text-[44px] md:text-[68px] leading-[0.95] font-black tracking-[-0.03em] text-ink"
          style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
        >
          About
        </h2>
      </motion.div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-12 md:gap-20">
        {/* Pull quote */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="about-still-water md:col-span-5"
        >
          <p
            className="project-overview-slab p-7 md:p-9 text-[26px] md:text-[34px] leading-[1.15] font-medium tracking-[-0.02em] text-ink"
            style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
          >
            "I build at the intersection of engineering and intelligence —
            taking ideas that work in a paper and making them work under a pager."
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span
              className="glass grid place-items-center w-14 h-14 rounded-full italic font-black text-[18px] text-ink"
              style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
            >
              ER
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">{bio.name}</p>
              <p className="text-[12px] text-ink-soft/60">
                {bio.taglineParts.join(" · ")}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bio paragraphs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="about-current proof-grid md:col-span-7 grid gap-3"
        >
          {bio.bodyParagraphs.map((p, i) => (
            <p
              key={i}
              className="proof-cell text-[15px] md:text-[17px] leading-[1.75] text-ink-soft/85"
            >
              {p}
            </p>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
