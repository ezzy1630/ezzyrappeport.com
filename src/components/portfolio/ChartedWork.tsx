"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { projectOrder, projects, type ProjectSlug } from "@/lib/portfolio/content";
import LazyProjectIdentity from "./LazyProjectIdentity";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ChartedWork.module.css";

/**
 * Charted Work (plan §11) — every project remains directly reachable.
 * A bathymetric chart of the whole body of work: eight semantic markers at
 * authored coordinates, one summary surface driven equally by hover and
 * keyboard focus, and a plain readable list on mobile. Entirely DOM/SVG —
 * the chart stays complete and useful with WebGL absent or failed.
 */

/** Authored chart coordinates (percent of the bathymetric map). */
const CHART_COORDINATES: Record<ProjectSlug, { x: number; y: number }> = {
  downright: { x: 14, y: 50 },
  monkeyclaw: { x: 22, y: 32 },
  etch: { x: 38, y: 24 },
  flowe: { x: 55, y: 38 },
  argyph: { x: 71, y: 28 },
  velox: { x: 32, y: 62 },
  nexarad: { x: 54, y: 68 },
  mathpilot: { x: 75, y: 60 },
};

const projectsBySlug = new Map(projects.map((project) => [project.slug, project]));

export default function ChartedWork() {
  const [activeSlug, setActiveSlug] = useState<ProjectSlug>(projectOrder[0]);
  const active = projectsBySlug.get(activeSlug) ?? projects[0];

  return (
    <section
      id="charted-work"
      className={styles.section}
      aria-labelledby="charted-work-title"
      data-depth-band="mid"
    >
      <header className={styles.header} data-section-reveal>
        <p className={styles.kicker}>Index / all eight projects</p>
        <h3 id="charted-work-title" className={styles.title}>Charted Work</h3>
        <p className={styles.intro}>
          Every project on one map — anchored encounters and the rest of the
          catalog, each one tap or keypress away.
        </p>
      </header>

      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox="0 0 100 78"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Bathymetric contours: the same ocean, charted. */}
          <ellipse cx="50" cy="42" rx="46" ry="30" className={styles.contour} />
          <ellipse cx="50" cy="42" rx="34" ry="21" className={styles.contour} />
          <ellipse cx="50" cy="42" rx="22" ry="13" className={styles.contour} />
          <ellipse cx="50" cy="42" rx="11" ry="6" className={styles.contour} />
          <path d="M4,60 C24,52 40,66 58,58 S 84,50 96,56" className={styles.current} />
          <path d="M6,24 C26,30 44,18 62,26 S 86,32 95,27" className={styles.current} />
        </svg>

        <ul className={styles.markers} aria-label="All projects">
          {projectOrder.map((slug) => {
            const project = projectsBySlug.get(slug);
            if (!project) return null;
            const coordinates = CHART_COORDINATES[slug];
            const isActive = slug === activeSlug;
            return (
              <li
                key={slug}
                className={styles.markerItem}
                style={{ left: `${coordinates.x}%`, top: `${coordinates.y}%` }}
              >
                <ProjectTransitionLink
                  href={`/project/${slug}`}
                  transitionName={`project-${slug}`}
                  className={styles.marker}
                  data-active={isActive}
                  aria-label={`${project.title} — ${project.tagline} Open the case study.`}
                  onPointerEnter={() => setActiveSlug(slug)}
                  onFocus={() => setActiveSlug(slug)}
                  onClick={() => setActiveSlug(slug)}
                >
                  <span className={styles.markerDot} aria-hidden="true" />
                  <span className={styles.markerLabel}>{project.title}</span>
                </ProjectTransitionLink>
              </li>
            );
          })}
        </ul>

        <aside className={styles.summary} aria-live="polite">
          <div className={styles.summaryIdentity} aria-hidden="true">
            <LazyProjectIdentity
              slug={active.slug}
              media={active.media.cover}
              className={styles.summaryIdentityAsset}
            />
          </div>
          <p className={styles.summaryIndex}>
            {active.index} / {String(projects.length).padStart(2, "0")} · {active.year}
          </p>
          <h4 className={styles.summaryTitle}>{active.title}</h4>
          <p className={styles.summarySubtitle}>{active.subtitle}</p>
          <p className={styles.summaryTagline}>{active.tagline}</p>
          <p className={styles.summaryProof}>{active.proof}</p>
          <ProjectTransitionLink
            href={`/project/${active.slug}`}
            transitionName={`project-${active.slug}`}
            className={`${styles.summaryAction} rv-pill-fill`}
            data-magnetic="button"
            data-pill-fill
            aria-label={`Dive into the ${active.title} case study`}
          >
            Dive in <span aria-hidden="true">↗</span>
          </ProjectTransitionLink>
        </aside>
      </div>

      <ul className={styles.list} aria-label="Project list">
        {projectOrder.map((slug) => {
          const project = projectsBySlug.get(slug);
          if (!project) return null;
          return (
            <li key={slug} className={styles.listItem}>
              <ProjectTransitionLink
                href={`/project/${slug}`}
                transitionName={`project-${slug}`}
                className={styles.listLink}
                onPointerEnter={() => setActiveSlug(slug)}
                onFocus={() => setActiveSlug(slug)}
              >
                <span className={styles.listIndex}>{project.index}</span>
                <span className={styles.listName}>
                  <strong>{project.title}</strong>
                  <span>{project.subtitle}</span>
                </span>
                <span className={styles.listProof}>{project.proof}</span>
                <ArrowUpRight aria-hidden="true" size={16} className={styles.listArrow} />
              </ProjectTransitionLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
