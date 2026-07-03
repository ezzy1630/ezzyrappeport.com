"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

const SECTIONS = ["projects", "experience", "about", "contact"] as const;

/**
 * ScrollIndicator
 * ---------------
 * Left-side vertical rail. One dot per major section; the dot for the
 * section currently in view lights up electric-blue. A progress line below
 * fills with scroll depth.
 */
export default function ScrollIndicator() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const lineScale = useTransform(progress, [0, 1], [0.04, 1]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    SECTIONS.forEach((id, idx) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ob = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(idx);
        },
        { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
      );
      ob.observe(el);
      observers.push(ob);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 1.8 }}
      className="scroll-indicator fixed left-6 md:left-10 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center gap-3 pointer-events-none"
      aria-hidden="true"
    >
      {SECTIONS.map((id, i) => (
        <span
          key={id}
          className={`rounded-full transition-all duration-500 ${
            i === active
              ? "w-2 h-2 bg-electric shadow-[0_0_12px_rgba(0,102,255,0.6)] pulse-dot"
              : "w-1 h-1 bg-ink/25"
          }`}
        />
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
