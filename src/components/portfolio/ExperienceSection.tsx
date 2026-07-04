"use client";

import { motion } from "framer-motion";
import { experience } from "@/lib/portfolio/content";

/**
 * ExperienceSection
 * -----------------
 * Timeline of work experience entries. Each entry has:
 *  - Period + company on the left
 *  - Role + summary + highlights on the right
 *  - Stack chips at the bottom
 *
 * The timeline is anchored by a thin vertical blue rail on the left.
 */
export default function ExperienceSection() {
  return (
    <section
      id="experience"
      className="depth-section depth-section--experience relative px-6 md:px-10 lg:px-14 py-32 md:py-40"
      aria-label="Experience"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-15% 0px" }}
        transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        className="section-heading max-w-7xl mx-auto mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-soft/55 mb-4">
            Career
          </p>
          <h2
            className="text-[44px] md:text-[68px] leading-[0.95] font-black tracking-[-0.03em] text-ink"
            style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
          >
            Experience
          </h2>
        </div>
        <p className="max-w-md text-[14px] md:text-[15px] leading-[1.7] text-ink-soft/75">
          Six years of shipping AI systems into regulated, high-stakes environments.
          Founder, founding engineer, and early engineer — in that order.
        </p>
      </motion.div>

      <div className="max-w-5xl mx-auto relative">
        {/* Vertical rail */}
        <span
          aria-hidden="true"
          className="droplet-timeline absolute left-[7px] md:left-1/2 top-2 bottom-2 w-px md:-translate-x-1/2"
        />

        <div className="flex flex-col gap-16 md:gap-24">
          {experience.map((entry, i) => (
            <motion.article
              key={`${entry.company}-${i}`}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="relative pl-10 md:pl-0 md:grid md:grid-cols-2 md:gap-16"
            >
              {/* Timeline dot */}
              <span
                aria-hidden="true"
                className="timeline-bead absolute left-0 top-2 w-[15px] h-[15px] rounded-full md:left-1/2 md:-translate-x-1/2"
              />

              <div className={`flex flex-col gap-3 ${i % 2 === 1 ? "md:order-2 md:text-right" : ""}`}>
                <span className="text-[12px] font-mono tracking-[0.18em] text-electric">
                  {entry.period}
                </span>
                <h3
                  className="text-[24px] md:text-[28px] font-bold tracking-[-0.02em] text-ink leading-[1.15]"
                  style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
                >
                  {entry.company}
                </h3>
                <p className="text-[14px] text-ink-soft/65">
                  {entry.role} · {entry.location}
                </p>
              </div>

              <div className={`depth-plate proof-cell mt-4 md:mt-0 flex flex-col gap-5 ${i % 2 === 1 ? "md:order-1" : ""}`}>
                <p className="text-[15px] leading-[1.7] text-ink-soft/85">
                  {entry.summary}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {entry.highlights.map((h, j) => (
                    <li
                      key={j}
                      className="flex items-start gap-3 text-[13px] leading-[1.55] text-ink-soft/75"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1.5 w-1 h-1 rounded-full bg-electric shrink-0"
                      />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <div className="stack-river flex flex-wrap gap-2 mt-1">
                  {entry.stack.map((s) => (
                    <span
                      key={s}
                    className="px-3 py-1 rounded-full text-[11px] font-medium text-ink-soft/70"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
