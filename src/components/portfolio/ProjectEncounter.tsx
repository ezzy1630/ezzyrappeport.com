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
  accent?: string;
  state?: "pending";
};

const ENCOUNTER_BEATS: Readonly<Record<string, readonly EncounterBeat[]>> = {
  monkeyclaw: [
    { label: "Target", detail: "lowest coverage gap", start: 0, end: 0.15, accent: "#327784" },
    { label: "Red", detail: "ideate + execute", start: 0.1, end: 0.3, accent: "#d64531" },
    { label: "Judge", detail: "6 checks + ensemble", start: 0.25, end: 0.46, accent: "#79aebc" },
    { label: "Repro", detail: "replay + minimize", start: 0.41, end: 0.62, accent: "#c98718" },
    { label: "Blue", detail: "patch · 8 gates", start: 0.57, end: 0.78, accent: "#2563c9" },
    { label: "Purple", detail: "blocked + observed", start: 0.73, end: 0.92, accent: "#7c3aed" },
  ],
  etch: [
    { label: "Requirement", detail: "FIFO intent", start: 0, end: 0.16, accent: "#dd8058" },
    { label: "Typed spec", detail: "width · depth · clocks", start: 0.12, end: 0.29, accent: "#4f9eb4" },
    { label: "Candidates", detail: "03 RTL proposals", start: 0.24, end: 0.42, accent: "#5caec3" },
    { label: "Simulate", detail: "oracle + traces", start: 0.37, end: 0.55, accent: "#39a98f" },
    { label: "Formal", detail: "bounded properties", start: 0.5, end: 0.68, accent: "#268e7f" },
    { label: "Synthesize", detail: "Yosys 0.66 metrics", start: 0.62, end: 0.78, accent: "#397fa8" },
    { label: "Signoff", detail: "physical pending", start: 0.7, end: 1, accent: "#7e92a0", state: "pending" },
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
  { beat: 0, slot: "left-top", label: "Coverage model", detail: "lowest-coverage zone" },
  { beat: 0, slot: "right-mid", label: "18 attack zones", detail: "attack + detection axes" },
  { beat: 1, slot: "left-top", label: "Nemotron ideation", detail: "five prompt modes" },
  { beat: 1, slot: "right-bottom", label: "Attack lane", detail: "multi-turn execution" },
  { beat: 2, slot: "left-mid", label: "Tier 1 checks", detail: "six programmatic" },
  { beat: 2, slot: "right-top", label: "Judge ensemble", detail: "five semantic roles" },
  { beat: 3, slot: "left-top", label: "Replay + minimize", detail: "fresh victims" },
  { beat: 3, slot: "right-bottom", label: "Cold verifier", detail: "context-free proof" },
  { beat: 4, slot: "left-bottom", label: "Candidate diff", detail: "least invasive first" },
  { beat: 4, slot: "right-top", label: "Patch verifier", detail: "eight gates" },
  { beat: 5, slot: "left-mid", label: "Detection oracle", detail: "blocked + observed" },
  { beat: 5, slot: "right-top", label: "Feedback router", detail: "gap → red priority" },
] as const;

const ETCH_ANNOTATIONS = [
  { beat: 0, slot: "left-top", label: "Natural-language intent", detail: "synchronous FIFO" },
  { beat: 0, slot: "right-mid", label: "Run workspace", detail: "saved + reproducible" },
  { beat: 1, slot: "left-mid", label: "Typed design spec", detail: "width 8 · depth 16" },
  { beat: 1, slot: "right-top", label: "Clock boundary", detail: "single-domain contract" },
  { beat: 2, slot: "left-top", label: "Candidate bank", detail: "03 ranked structures" },
  { beat: 2, slot: "right-bottom", label: "Independent oracle", detail: "candidate-neutral" },
  { beat: 3, slot: "left-bottom", label: "Simulation", detail: "trace comparison passed" },
  { beat: 3, slot: "right-top", label: "Failure retained", detail: "evidence, not erased" },
  { beat: 4, slot: "left-top", label: "Bounded formal", detail: "properties discharged" },
  { beat: 4, slot: "right-mid", label: "Proof ledger", detail: "claim linked to artifact" },
  { beat: 5, slot: "left-mid", label: "Yosys 0.66", detail: "synthesis metrics" },
  { beat: 5, slot: "right-top", label: "Verified FIFO die", detail: "evidence-backed result" },
  { beat: 6, slot: "left-bottom", label: "Physical proxy", detail: "readiness evidence only" },
  { beat: 6, slot: "right-top", label: "Signoff pending", detail: "no silicon claim" },
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
          {project.slug === "monkeyclaw" || project.slug === "etch" ? (
            <div className={styles.sceneAnnotations} aria-hidden="true">
              {(project.slug === "monkeyclaw" ? MONKEYCLAW_ANNOTATIONS : ETCH_ANNOTATIONS).map((annotation, index) => {
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
                        "--annotation-accent": beat?.accent,
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
                    "--beat-accent": beat.accent,
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
