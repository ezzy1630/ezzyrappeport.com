"use client";

import { useEffect, useRef, useState } from "react";
import ProjectIdentity from "./ProjectIdentity";
import type { ProjectMediaAsset, ProjectSlug } from "@/lib/portfolio/content";
import styles from "./ProjectsSection.module.css";

const RASTER_SLUGS = new Set<ProjectSlug>([
  "monkeyclaw",
  "flowe",
  "argyph",
  "nexarad",
]);

type Props = {
  slug: ProjectSlug;
  media: ProjectMediaAsset;
  className?: string;
};

/**
 * Lazy-mounts raster-backed project identities near the viewport.
 * Pure-SVG marks (etch, velox, mathpilot) mount immediately.
 * Appearance matches eager ProjectIdentity once mounted.
 */
export default function LazyProjectIdentity({ slug, media, className }: Props) {
  const needsLazy = RASTER_SLUGS.has(slug);
  const hostRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(!needsLazy);

  useEffect(() => {
    if (!needsLazy || mounted) return;
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [mounted, needsLazy]);

  if (mounted) {
    return <ProjectIdentity slug={slug} media={media} className={className} />;
  }

  return (
    <span
      ref={hostRef}
      className={`${styles.identityStage} ${className ?? ""}`}
      data-project-identity={slug}
      data-identity-lazy="pending"
      aria-hidden="true"
    >
      <span className={styles.identityCanvas} />
    </span>
  );
}
