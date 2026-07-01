"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";

/**
 * LocationCard
 * ------------
 * Right-side floating glass card with:
 *  - Location pin icon (left)
 *  - "Based in California" title
 *  - "Building from Los Angeles and Santa Cruz" subtitle (2 lines)
 *  - Coordinates: "34.0522° N, 118.2437° W"
 *  - Blue status dot (upper right)
 */
export default function LocationCard() {
  return (
    <motion.aside
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1.0, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="glass rounded-[30px] p-4 md:p-5 w-[280px] md:w-[300px] relative"
      aria-label={bio.location.title}
    >
      {/* Blue status dot */}
      <span
        aria-hidden="true"
        className="absolute top-5 right-5 w-2 h-2 rounded-full bg-electric"
      />

      <div className="flex items-start gap-4 pr-5">
        <span className="grid place-items-center w-9 h-9 rounded-full bg-ink/[0.055] text-ink">
          <MapPin className="w-[18px] h-[18px]" strokeWidth={1.6} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] md:text-[15px] font-semibold text-ink tracking-[-0.01em]">
            {bio.location.title}
          </h3>
          <p className="mt-1 text-[12px] md:text-[13px] leading-[1.55] text-ink-soft/65">
            {bio.location.subtitle}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-white/24">
        <p
          className="text-[10px] md:text-[11px] tracking-[0.08em] text-ink-soft/45 font-mono"
          style={{ fontFeatureSettings: "'tnum'" }}
        >
          {bio.location.coordinates}
        </p>
      </div>
    </motion.aside>
  );
}
