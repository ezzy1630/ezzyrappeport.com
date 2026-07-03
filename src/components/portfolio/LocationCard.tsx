"use client";

import { motion } from "framer-motion";
import { MapPin } from "lucide-react";
import { bio } from "@/lib/portfolio/content";
import { useLiquidTransform } from "@/hooks/portfolio/use-liquid-transform";
import { useReducedMotion } from "@/hooks/portfolio/use-reduced-motion";

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
  const reducedMotion = useReducedMotion();
  const liquidRef = useLiquidTransform<HTMLDivElement>({
    scale: 1.0,
    maxMove: 12,
    scrollMultiplier: 1.2,
    reduce: reducedMotion,
  });

  return (
    <div ref={liquidRef} className="will-change-transform">
      <motion.aside
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.0, delay: 1.5, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ y: -2 }}
        className="glass rounded-[30px] px-4 py-3.5 md:px-5 md:py-4 w-[270px] md:w-[294px] relative"
        aria-label={bio.location.title}
      >
        {/* Blue status dot */}
        <span
          aria-hidden="true"
          className="absolute top-4 right-5 w-2 h-2 rounded-full bg-electric shadow-[0_0_12px_rgba(0,102,255,0.6)]"
        />

        <div className="flex items-start gap-3.5 pr-5">
          <span className="grid place-items-center w-8 h-8 rounded-full bg-white/35 text-ink shadow-[0_1px_1px_rgba(255,255,255,0.75)_inset]">
            <MapPin className="w-[18px] h-[18px]" strokeWidth={1.6} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] md:text-[15px] font-semibold text-ink tracking-normal">
              {bio.location.title}
            </h3>
            <p className="mt-1 text-[12px] md:text-[13px] leading-[1.42] text-ink-soft/72">
              {bio.location.subtitle}
            </p>
          </div>
        </div>

        <div className="mt-2.5 pt-2 border-t border-white/34">
          <p
            className="text-[10px] md:text-[11px] tracking-normal text-ink-soft/65 font-mono"
            style={{ fontFeatureSettings: "'tnum'" }}
          >
            {bio.location.coordinates}
          </p>
        </div>
      </motion.aside>
    </div>
  );
}
