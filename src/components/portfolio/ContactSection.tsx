"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

/**
 * ContactSection
 * --------------
 * Final section. Two columns:
 *  Left:  Massive "Let's build" CTA + email link
 *  Right: Socials grid (GitHub, LinkedIn, X, Email) + small contact form
 */
export default function ContactSection() {
  return (
    <section
      id="contact"
      className="relative px-6 md:px-10 lg:px-14 py-32 md:py-44"
      aria-label="Contact"
    >
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 md:gap-24 items-start">
        {/* Left — CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-[11px] uppercase tracking-[0.28em] text-ink-soft/55 mb-4">
            Contact
          </p>
          <h2
            className="text-[56px] md:text-[88px] leading-[0.95] font-black tracking-[-0.04em] text-ink"
            style={{ fontFamily: "var(--font-inter-tight), sans-serif" }}
          >
            Let's build
            <br />
            <span className="text-ink-soft/40">something real.</span>
          </h2>

          <a
            href={`mailto:${bio.email}`}
            className="mt-10 inline-flex items-baseline gap-3 text-[20px] md:text-[26px] font-medium text-ink hover:text-electric transition-colors duration-300 group"
            data-cursor="hover"
          >
            <span className="border-b-2 border-electric/0 group-hover:border-electric pb-1 transition-all duration-300">
              {bio.email}
            </span>
            <ArrowUpRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </a>

          <div className="mt-12 grid grid-cols-2 gap-3 max-w-md">
            {bio.socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target={s.href.startsWith("http") ? "_blank" : undefined}
                rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}
                data-cursor="hover"
                className="group glass rounded-2xl p-4 flex items-center justify-between hover:scale-[1.02] active:scale-[0.99] transition-transform duration-300"
              >
                <span className="flex flex-col">
                  <span className="text-[12px] uppercase tracking-[0.18em] text-ink-soft/55">
                    {s.label}
                  </span>
                  <span className="text-[13px] text-ink mt-0.5 truncate">
                    {s.handle}
                  </span>
                </span>
                <ArrowUpRight
                  className="w-4 h-4 text-ink-soft/40 group-hover:text-electric group-hover:rotate-45 transition-all duration-300"
                  strokeWidth={2.2}
                />
              </a>
            ))}
          </div>
        </motion.div>

        {/* Right — Mini contact form */}
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-15% 0px" }}
          transition={{ duration: 1.0, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          onSubmit={(e) => e.preventDefault()}
          className="glass-strong rounded-3xl p-7 md:p-10 flex flex-col gap-5"
          aria-label="Contact form"
        >
          <p className="text-[14px] text-ink-soft/70 leading-[1.6]">
            Drop a note. I read everything and reply within a couple of days.
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="cf-name" className="text-[11px] uppercase tracking-[0.18em] text-ink-soft/55">
              Name
            </label>
            <input
              id="cf-name"
              type="text"
              required
              placeholder="Your name"
              className="bg-white/40 border border-white/55 rounded-xl px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft/40 focus:outline-none focus:border-electric/60 focus:bg-white/70 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cf-email" className="text-[11px] uppercase tracking-[0.18em] text-ink-soft/55">
              Email
            </label>
            <input
              id="cf-email"
              type="email"
              required
              placeholder="you@example.com"
              className="bg-white/40 border border-white/55 rounded-xl px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft/40 focus:outline-none focus:border-electric/60 focus:bg-white/70 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="cf-msg" className="text-[11px] uppercase tracking-[0.18em] text-ink-soft/55">
              Message
            </label>
            <textarea
              id="cf-msg"
              required
              rows={4}
              placeholder="What are you building?"
              className="bg-white/40 border border-white/55 rounded-xl px-4 py-3 text-[14px] text-ink placeholder:text-ink-soft/40 focus:outline-none focus:border-electric/60 focus:bg-white/70 transition-all resize-none"
            />
          </div>

          <button
            type="submit"
            data-cursor="hover"
            className="mt-2 group inline-flex items-center justify-center gap-3 rounded-full px-6 py-3.5 bg-ink text-white text-[14px] font-medium hover:scale-[1.02] active:scale-[0.99] transition-transform duration-300"
          >
            Send Message
            <ArrowUpRight className="w-4 h-4 group-hover:rotate-45 transition-transform duration-300" strokeWidth={2.2} />
          </button>
        </motion.form>
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-32 md:mt-44 pt-10 border-t border-white/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <p className="text-[12px] text-ink-soft/55">
          © {new Date().getFullYear()} {bio.name}. Built with WebGPU + Next.js.
        </p>
        <p className="text-[11px] font-mono tracking-[0.15em] text-ink-soft/40 uppercase">
          {bio.location.coordinates}
        </p>
      </footer>
    </section>
  );
}
