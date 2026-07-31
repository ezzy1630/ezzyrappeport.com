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
  shortLabel?: string;
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
    { label: "Intent", shortLabel: "Intent", detail: "8-bit FIFO · depth 16", start: 0, end: 0.2, accent: "#dd8058" },
    { label: "DesignSpec", shortLabel: "Spec", detail: "typed contract · 10 ns", start: 0.2, end: 0.32, accent: "#4f9eb4" },
    { label: "Candidates", shortLabel: "RTL", detail: "A · B · C retained", start: 0.32, end: 0.44, accent: "#5caec3" },
    { label: "Simulation", shortLabel: "Sim", detail: "50-cycle oracle", start: 0.44, end: 0.56, accent: "#39a98f" },
    { label: "Formal", shortLabel: "Formal", detail: "BMC depth 32", start: 0.56, end: 0.68, accent: "#268e7f" },
    { label: "Rank", shortLabel: "Rank", detail: "A wins · smallest", start: 0.68, end: 0.78, accent: "#397fa8" },
    { label: "Physical", shortLabel: "Phys.", detail: "tools missing", start: 0.78, end: 0.88, accent: "#7e92a0", state: "pending" },
    { label: "Dossier", shortLabel: "Proof", detail: "Markdown + JSON", start: 0.88, end: 1, accent: "#5caec3" },
  ],
  flowe: [
    { label: "Awaken", shortLabel: "Mark", detail: "identity drawn in light", start: 0, end: 0.22, accent: "#8ee8f4" },
    { label: "Dump", shortLabel: "Dump", detail: "voice + free-form input", start: 0.2, end: 0.32, accent: "#44b8d0" },
    { label: "Parse", shortLabel: "Parse", detail: "tasks · events · focus", start: 0.3, end: 0.43, accent: "#5ac5d4" },
    { label: "Context", shortLabel: "Class", detail: "Canvas + course context", start: 0.41, end: 0.55, accent: "#73c8de" },
    { label: "Plan", shortLabel: "Plan", detail: "conflict-aware day", start: 0.53, end: 0.67, accent: "#5ea8d6" },
    { label: "Focus", shortLabel: "Focus", detail: "50-minute live block", start: 0.65, end: 0.8, accent: "#92e5ec" },
    { label: "Sync", shortLabel: "Sync", detail: "offline queue + retry", start: 0.78, end: 0.92, accent: "#689ce0" },
    { label: "Brief", shortLabel: "Brief", detail: "morning priorities", start: 0.9, end: 1, accent: "#b0edf3" },
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
  { beat: 0, slot: "left-top", label: "Requirement", detail: "ready / valid FIFO" },
  { beat: 0, slot: "right-mid", label: "Objective", detail: "area 0.8 · timing 0.2" },
  { beat: 1, slot: "left-mid", label: "Typed DesignSpec", detail: "8-bit · depth 16 · 10 ns" },
  { beat: 1, slot: "right-top", label: "Invariants", detail: "no_underflow · no_overflow" },
  { beat: 2, slot: "left-top", label: "Candidate A", detail: "proven · 486 cells" },
  { beat: 2, slot: "right-bottom", label: "Candidates B + C", detail: "retained for verification" },
  { beat: 3, slot: "left-bottom", label: "Counterexample", detail: "B diverges at cycle 1" },
  { beat: 3, slot: "right-top", label: "Independent oracle", detail: "50 cycles · 100%" },
  { beat: 4, slot: "left-top", label: "Formal falsification", detail: "B fails no_underflow" },
  { beat: 4, slot: "right-top", label: "Bounded proof", detail: "A + C · depth 32" },
  { beat: 5, slot: "left-mid", label: "Correctness-first rank", detail: "A smallest proven design" },
  { beat: 5, slot: "right-top", label: "Yosys 0.66", detail: "5485.2608 µm²" },
  { beat: 6, slot: "left-bottom", label: "Tool boundary", detail: "OpenROAD / DRC / LVS missing" },
  { beat: 6, slot: "right-top", label: "Honest state", detail: "physical signoff pending" },
  { beat: 7, slot: "left-top", label: "Proof dossier", detail: "Markdown + JSON · linked artifacts" },
] as const;

const FLOWE_ANNOTATIONS = [
  { beat: 0, slot: "left-top", label: "FlowE identity", detail: "exact source silhouette" },
  { beat: 0, slot: "right-mid", label: "Drawn in light", detail: "four measured centerlines" },
  { beat: 1, slot: "left-mid", label: "Brain Dump", detail: "text or voice capture" },
  { beat: 1, slot: "right-top", label: "Private input", detail: "student-owned context" },
  { beat: 2, slot: "left-top", label: "Semantic parse", detail: "task · event · study block" },
  { beat: 2, slot: "right-bottom", label: "Review before save", detail: "human confirmation" },
  { beat: 3, slot: "left-bottom", label: "Course context", detail: "Canvas REST / ICS" },
  { beat: 3, slot: "right-top", label: "Due-date match", detail: "Chem lab · 4:00 PM" },
  { beat: 4, slot: "left-top", label: "Daily plan", detail: "six tasks · two complete" },
  { beat: 4, slot: "right-mid", label: "Conflict-aware", detail: "calendar + workload" },
  { beat: 5, slot: "left-mid", label: "Focus session", detail: "Live Activity · 50:00" },
  { beat: 5, slot: "right-top", label: "One calm block", detail: "everything else recedes" },
  { beat: 6, slot: "left-bottom", label: "Offline queue", detail: "three changes retained" },
  { beat: 6, slot: "right-top", label: "Convex sync", detail: "user-scoped retry" },
  { beat: 7, slot: "left-top", label: "Morning briefing", detail: "four priorities · two events" },
  { beat: 7, slot: "right-mid", label: "Ready state", detail: "plan survives the handoff" },
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
          {project.slug === "monkeyclaw" || project.slug === "etch" || project.slug === "flowe" ? (
            <div className={styles.sceneAnnotations} aria-hidden="true">
              {(project.slug === "monkeyclaw"
                ? MONKEYCLAW_ANNOTATIONS
                : project.slug === "etch"
                  ? ETCH_ANNOTATIONS
                  : FLOWE_ANNOTATIONS).map((annotation, index) => {
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
                <strong>
                  <span className={styles.beatLabelLong}>{beat.label}</span>
                  {beat.shortLabel ? <span className={styles.beatLabelShort}>{beat.shortLabel}</span> : null}
                </strong>
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
