import { ArrowUpRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import ProjectTransitionLink from "./ProjectTransitionLink";
import styles from "./ProjectEncounter.module.css";

type Props = {
  project: Project;
  progress: string;
  total: string;
};

type EncounterBeat = {
  label: string;
  detail: string;
  state?: "pending";
};

const ENCOUNTER_BEATS: Readonly<Record<string, readonly EncounterBeat[]>> = {
  monkeyclaw: [
    { label: "Ingress", detail: "18 seeded zones" },
    { label: "Contain", detail: "sandbox deflects" },
    { label: "Verdict", detail: "8 verifier gates" },
    { label: "Telemetry", detail: "regression returns" },
  ],
  etch: [
    { label: "Intent", detail: "language enters" },
    { label: "Constraints", detail: "typed boundary" },
    { label: "Evidence", detail: "sim + formal" },
    { label: "Signoff", detail: "physical pending", state: "pending" },
  ],
  flowe: [
    { label: "Capture", detail: "Canvas + tasks" },
    { label: "Organize", detail: "daily plan" },
    { label: "Focus", detail: "one calm block" },
    { label: "Index", detail: "offline local state" },
  ],
  argyph: [
    { label: "Scan", detail: "repository reef" },
    { label: "Symbols", detail: "definitions + refs" },
    { label: "Semantic", detail: "local links" },
    { label: "Return", detail: "bounded spans" },
  ],
};

/**
 * Semantic story surface for a 3D project encounter (plan §10.1).
 * The DOM owns the title, value line, role/status, proof points, and the
 * case-study action; WebGL owns the adversarial current field behind it.
 * Content is complete and readable with the renderer absent or failed.
 */
export default function ProjectEncounter({ project, progress, total }: Props) {
  const beats = ENCOUNTER_BEATS[project.slug] ?? [];

  return (
    <article
      id={`project-${project.slug}`}
      className={styles.encounter}
      data-encounter={project.slug}
      data-depth-band="shallow"
      aria-labelledby={`encounter-title-${project.slug}`}
    >
      <div className={styles.stage}>
        <div className={styles.sceneHint} aria-hidden="true">
          <span className={styles.sceneHintCore} />
          <span className={styles.sceneHintRail} />
          <span className={styles.sceneHintRail} />
          <span className={styles.sceneHintRail} />
        </div>
        <div className={styles.sceneFrame} aria-hidden="true">
          <div className={styles.frameHeader}>
            <span>Live system model</span>
            <span>Scroll-linked / 04 states</span>
          </div>
          <ol className={styles.beatRail}>
            {beats.map((beat, index) => (
              <li
                key={`${project.slug}-${beat.label}`}
                className={styles.beat}
                data-state={beat.state}
              >
                <span className={styles.beatTrack} />
                <span className={styles.beatIndex}>{String(index + 1).padStart(2, "0")}</span>
                <strong>{beat.label}</strong>
                <small>{beat.detail}</small>
              </li>
            ))}
          </ol>
          <span className={styles.frameCorner} data-corner="north-west" />
          <span className={styles.frameCorner} data-corner="north-east" />
          <span className={styles.frameCorner} data-corner="south-west" />
          <span className={styles.frameCorner} data-corner="south-east" />
        </div>
        <div className={styles.copy}>
          <p className={styles.kicker} aria-label={`Project ${progress} of ${total}, ${project.year}`}>
            <span>{progress}</span>
            <span aria-hidden="true"> / </span>
            <span>{total}</span>
            <span className={styles.kickerYear} aria-hidden="true">{project.year}</span>
          </p>
          <div className={styles.meta}>
            <span>{project.status}</span>
            {project.cautionLabel ? <span>{project.cautionLabel}</span> : null}
          </div>
          <h3 id={`encounter-title-${project.slug}`} className={styles.title}>
            {project.title}
          </h3>
          <p className={styles.subtitle}>{project.subtitle}</p>
          <p className={styles.tagline}>{project.tagline}</p>
          <dl className={styles.facts}>
            <div>
              <dt>Role</dt>
              <dd>{project.role}</dd>
            </div>
            <div>
              <dt>Proof</dt>
              <dd>{project.proof}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <ProjectTransitionLink
              href={`/project/${project.slug}`}
              className={`${styles.primaryAction} rv-pill-fill`}
              transitionName={`project-${project.slug}`}
              data-magnetic="button"
              data-pill-fill
              aria-label={`Dive into the ${project.title} case study`}
            >
              Dive in <span aria-hidden="true">↗</span>
            </ProjectTransitionLink>
            {project.verifiedLinks.slice(0, 1).map((link) => (
              <a
                key={`${project.slug}-${link.href}`}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.secondaryAction}
              >
                {link.label} <ArrowUpRight aria-hidden="true" size={14} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
