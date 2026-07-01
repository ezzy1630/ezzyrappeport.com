"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

/**
 * HeroIntro
 * ---------
 * Left-lower area below the giant name:
 *  - Tagline: "Engineer • AI Builder • Founder" with blue dot separators
 *  - Body copy: 3 lines describing positioning
 *  - Primary CTA: "View Featured Work" pill with diagonal arrow
 */
export default function HeroIntro() {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5 max-w-[430px]"
    >
      {/* Tagline */}
      <div className="flex items-center gap-3 text-[18px] md:text-[20px] font-medium text-ink">
        {bio.taglineParts.map((part, i) => (
          <span key={part} className="flex items-center gap-3">
            {i > 0 && (
              <span
                aria-hidden="true"
                className="inline-block w-1.5 h-1.5 rounded-full bg-electric"
              />
            )}
            <span>{part}</span>
          </span>
        ))}
      </div>

      {/* Body copy */}
      <p className="text-[13px] md:text-[14px] leading-[1.55] text-ink-soft/78 max-w-[410px]">
        {bio.bodyParagraphs[0]}
      </p>

      {/* CTA */}
      <a
        href="#projects"
        className="group inline-flex items-center gap-3 self-start rounded-full pl-6 pr-2.5 py-2.5 glass text-[13px] md:text-[14px] font-medium text-ink hover:scale-[1.02] active:scale-[0.99] transition-transform duration-300"
        data-cursor="hover"
      >
        View Featured Work
        <span className="grid place-items-center w-9 h-9 rounded-full bg-ink text-white transition-transform duration-300 group-hover:rotate-45">
          <ArrowUpRight className="w-4 h-4" strokeWidth={2.2} />
        </span>
      </a>
    </motion.div>
  );
}
