"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * ScrollIndicator
 * ---------------
 * Left-side vertical rail indicating scroll depth through the page.
 *  - Active bright-blue dot at current section
 *  - Several smaller gray dots below
 *  - Thin vertical line beneath
 *  - Live progress fill driven by useScroll
 */
export default function ScrollIndicator() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const lineScale = useTransform(progress, [0, 1], [0.04, 1]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 1.8 }}
      className="fixed left-6 md:left-10 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3 pointer-events-none"
      aria-hidden="true"
    >
      {/* Active dot */}
      <span className="w-2 h-2 rounded-full bg-electric shadow-[0_0_12px_rgba(0,102,255,0.6)] pulse-dot" />

      {/* Inactive dots */}
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="w-1 h-1 rounded-full bg-ink/25" />
      ))}

      {/* Line with progress fill */}
      <div className="relative w-px h-24 mt-2 bg-ink/15 overflow-hidden">
        <motion.div
          style={{ scaleY: lineScale, transformOrigin: "top" }}
          className="absolute inset-0 bg-electric/60"
        />
      </div>
    </motion.div>
  );
}
