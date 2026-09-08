import type { ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import { recordedFinding } from "@/lib/portfolio/story-evidence";
import styles from "./Editorial.module.css";
export { default as StoryNavigation } from "./ChapterNavigation";

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className={styles.sourceLink} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14} aria-hidden="true" /></a>;
}

export function StoryOpening({ project, mark, label, introduction, children }: {
  project: Project; mark: string; label: string; introduction: string; children: ReactNode;
}) {
  return <header className={styles.opening}>
    <div className={styles.openingCopy}>
      <p className={styles.label}>{label}</p>
      <div className={styles.wordmark}><Image src={mark} width={64} height={64} alt="" /><h1>{project.title}</h1></div>
      <p className={styles.openingTitle}>{project.tagline}</p>
      <p className={styles.openingIntroduction}>{introduction}</p>
      <div className={styles.actions}>{project.verifiedLinks.map(link => <SourceLink key={link.href} href={link.href}>{link.label}</SourceLink>)}</div>
      <p className={styles.openingMeta}>{project.role}<span aria-hidden="true"> / </span>{project.year}</p>
    </div>
    <div className={styles.openingVisual}>{children}</div>
  </header>;
}

export function Chapter({ id, number, label, title, children }: {
  id: string; number: string; label: string; title: string; children: ReactNode;
}) {
  return <section id={id} className={styles.chapter} aria-labelledby={`${id}-title`} tabIndex={-1}>
    <header className={styles.chapterHeading}><p className={styles.label}>{number} / {label}</p><h2 id={`${id}-title`}>{title}</h2></header>
    <div className={styles.chapterContent}>{children}</div>
  </section>;
}

export function Decision({ number, title, children, consequence, source, sourceLabel = "Read the implementation" }: {
  number: string; title: string; children: ReactNode; consequence: string; source: string; sourceLabel?: string;
}) {
  return <article className={styles.decision}>
    <span className={styles.decisionNumber} aria-hidden="true">{number}</span>
    <div><h3>{title}</h3><div className={styles.decisionBody}>{children}</div><p className={styles.consequence}><strong>The tradeoff</strong>{consequence}</p><SourceLink href={source}>{sourceLabel}</SourceLink></div>
  </article>;
}

export function MediaFigure({ src, alt, width, height, label, caption, priority = false, detail = false }: {
  src: string; alt: string; width: number; height: number; label: string; caption: string; priority?: boolean; detail?: boolean;
}) {
  return <figure className={styles.mediaFigure} data-detail={detail || undefined}>
    <a href={src} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size image: ${alt}`}>
      <Image src={src} alt={alt} width={width} height={height} priority={priority} sizes="(max-width: 800px) 90vw, 65vw" />
      <span className={styles.expandImage} aria-hidden="true"><ArrowUpRight size={18} /></span>
    </a>
    <figcaption><span>{label}</span><p>{caption}</p></figcaption>
  </figure>;
}

export function FindingRecord({ compact = false }: { compact?: boolean }) {
  return <figure className={styles.findingRecord} data-compact={compact || undefined}>
    <figcaption><span className={styles.recordDot} aria-hidden="true" />Recorded demo fixture{!compact && <span className={styles.recordZone}>{recordedFinding.zone}</span>}</figcaption>
    <p className={styles.recordIdentifier}>{recordedFinding.package}</p>
    <p className={styles.recordTitle}>A backup request crossed the sandbox boundary.</p>
    <div className={styles.recordFlow}><span>Finding confirmed</span><ArrowRight size={16} aria-hidden="true" /><span>Reproduction saved</span></div>
    <dl>
      <div><dt>Trigger</dt><dd>{recordedFinding.check}</dd></div>
      <div><dt>Replay</dt><dd>{recordedFinding.reproductionRequests} request</dd></div>
      <div><dt>Next boundary</dt><dd>{recordedFinding.patchStatus}</dd></div>
    </dl>
    {!compact && <p className={styles.recordCaption}>Selected fields from the public mock-sandbox fixture. This is an evidence summary, not a live dashboard.</p>}
  </figure>;
}

export function Ownership({ children, scope, team }: { children: ReactNode; scope: string; team: string }) {
  return <aside className={styles.ownership} aria-label="Project authorship"><div><p className={styles.label}>My part</p><p>{children}</p></div><dl><div><dt>Scope</dt><dd>{scope}</dd></div><div><dt>Team</dt><dd>{team}</dd></div></dl></aside>;
}

export function SourceNote({ title, children }: { title: string; children: ReactNode }) {
  return <details className={styles.sourceNote}><summary>{title}<span aria-hidden="true">+</span></summary><div>{children}</div></details>;
}
