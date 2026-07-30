import { ArrowUpRight } from "lucide-react";
import type { CSSProperties } from "react";
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
  start: number;
  end: number;
  state?: "pending";
};

const ENCOUNTER_BEATS: Readonly<Record<string, readonly EncounterBeat[]>> = {
  monkeyclaw: [
    { label: "Wake", detail: "system acquires", start: 0, end: 0.12 },
    { label: "Ingress", detail: "18 zones seeded", start: 0.08, end: 0.26 },
    { label: "Contain", detail: "10 vectors deflected", start: 0.22, end: 0.42 },
    { label: "Verdict", detail: "8 gates resolve", start: 0.38, end: 0.58 },
    { label: "Patch", detail: "defense authored", start: 0.54, end: 0.72 },
    { label: "Telemetry", detail: "detection returns", start: 0.68, end: 0.86 },
  ],
  etch: [
    { label: "Intent", detail: "language enters", start: 0, end: 0.28 },
    { label: "Constraints", detail: "typed boundary", start: 0.24, end: 0.52 },
    { label: "Evidence", detail: "sim + formal", start: 0.48, end: 0.78 },
    { label: "Signoff", detail: "physical pending", start: 0.74, end: 1, state: "pending" },
  ],
  flowe: [
    { label: "Capture", detail: "Canvas + tasks", start: 0, end: 0.28 },
    { label: "Organize", detail: "daily plan", start: 0.24, end: 0.52 },
    { label: "Focus", detail: "one calm block", start: 0.48, end: 0.78 },
    { label: "Index", detail: "offline local state", start: 0.74, end: 1 },
  ],
  argyph: [
    { label: "Scan", detail: "repository reef", start: 0, end: 0.28 },
    { label: "Symbols", detail: "definitions + refs", start: 0.24, end: 0.52 },
    { label: "Semantic", detail: "local links", start: 0.48, end: 0.78 },
    { label: "Return", detail: "bounded spans", start: 0.74, end: 1 },
  ],
};

const MONKEYCLAW_ANNOTATIONS = [
  { beat: 0, slot: "left-top", label: "Sandbox sphere", detail: "isolated runtime" },
  { beat: 0, slot: "right-mid", label: "MonkeyClaw core", detail: "policy engine" },
  { beat: 1, slot: "left-top", label: "Threat signals", detail: "18 zones mapped" },
  { beat: 1, slot: "right-bottom", label: "Attack vectors", detail: "inbound pressure" },
  { beat: 2, slot: "left-mid", label: "Deflection shield", detail: "10 blocked" },
  { beat: 2, slot: "right-bottom", label: "Evidence fragments", detail: "captured" },
  { beat: 3, slot: "left-top", label: "Verifier ring", detail: "8 gates resolve" },
  { beat: 3, slot: "right-mid", label: "Verdict signals", detail: "consensus reached" },
  { beat: 4, slot: "left-bottom", label: "Defense lattice", detail: "policy update" },
  { beat: 4, slot: "right-top", label: "Config commit", detail: "defense authored" },
  { beat: 5, slot: "left-mid", label: "Detection returns", detail: "evidence streaming" },
  { beat: 5, slot: "right-top", label: "System health", detail: "observable" },
] as const;

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
            <span>Scroll-linked / {String(beats.length).padStart(2, "0")} states</span>
          </div>
          {project.slug === "monkeyclaw" ? (
            <div className={styles.sceneAnnotations} aria-hidden="true">
              {MONKEYCLAW_ANNOTATIONS.map((annotation, index) => {
                const beat = beats[annotation.beat];
                return (
                  <span
                    key={`${annotation.beat}-${annotation.label}`}
                    className={styles.sceneAnnotation}
                    data-slot={annotation.slot}
                    data-mobile={index % 2 === 0 ? "primary" : "secondary"}
                    style={
                      {
                        "--beat-start": beat?.start ?? 0,
                        "--beat-end": beat?.end ?? 1,
                      } as CSSProperties
                    }
                  >
                    <strong>{annotation.label}</strong>
                    <small>{annotation.detail}</small>
                  </span>
                );
              })}
            </div>
          ) : null}
          <ol
            className={styles.beatRail}
            style={{ "--beat-count": beats.length } as CSSProperties}
          >
            {beats.map((beat, index) => (
              <li
                key={`${project.slug}-${beat.label}`}
                className={styles.beat}
                data-state={beat.state}
                style={
                  {
                    "--beat-start": beat.start,
                    "--beat-end": beat.end,
                    "--beat-span": Math.max(beat.end - beat.start, 0.01),
                  } as CSSProperties
                }
              >
                <span className={styles.beatTrack} />
                <span className={styles.beatPulse} aria-hidden="true" />
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
