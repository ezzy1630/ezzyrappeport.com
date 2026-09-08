import { ArrowRight } from "lucide-react";
import type { Project } from "@/lib/portfolio/content";
import { downrightEvidence } from "@/lib/portfolio/story-evidence";
import { Chapter, Decision, MediaFigure, Ownership, SourceLink, SourceNote, StoryNavigation, StoryOpening } from "./Editorial";
import { ProductRecording } from "./StoryDemos";
import styles from "./Editorial.module.css";

const sections = [
  { id: "overview", label: "The document" },
  { id: "approach", label: "The decisions" },
  { id: "evidence", label: "In use" },
  { id: "outcome", label: "The result" },
] as const;

export function DownrightOpening({ project }: { project: Project }) {
  return <StoryOpening project={project} mark="/projects/downright/app-icon.png" label="Native macOS / Independent project"
    introduction="I built Downright around a simple constraint: the reading experience can change, but the file belongs to you.">
    <ProductRecording />
  </StoryOpening>;
}

export default function DownrightStory() {
  return <>
    <StoryNavigation sections={sections} />
    <div className={styles.story}>
      <Chapter id="overview" number="01" label="The document" title="Start with a file. Keep it a file.">
        <p className={styles.lead}>A Markdown document should be comfortable to read, precise to edit, and easy to open from wherever it already lives.</p>
        <Ownership scope="Document experience, native rendering, file workflows and Finder integration" team="Independent project; primary author">
          I’m Downright’s creator and primary author. I built the document app and the native surfaces around it, from the editing pipeline to Quick Look.
        </Ownership>
        <p className={styles.prose}>That choice runs through the architecture. There is no import step into a separate library. The original text remains authoritative, and reading, live editing, and source views share one native text surface.</p>
        <div className={styles.fileFlow} aria-label="A Markdown file flows through one source buffer into native reading and editing surfaces">
          <div><strong>Your .md file</strong><span>Original folder.<br />Original text.</span></div><ArrowRight size={20} aria-hidden="true" />
          <div><strong>One source buffer</strong><span>TextKit 2 stores the text.<br />Rendering decorates it.</span></div><ArrowRight size={20} aria-hidden="true" />
          <div><strong>Native surfaces</strong><span>Read and edit in the app.<br />Preview in Finder.</span></div>
        </div>
        <SourceLink href={downrightEvidence.architecture}>Architecture and invariants</SourceLink>
      </Chapter>
      <Chapter id="approach" number="02" label="The decisions" title="The constraints shaped the editor.">
        <Decision number="01" title="Keep the source authoritative." source={downrightEvidence.architecture}
          consequence="Hiding syntax requires an explicit map between source positions and what appears on screen. That complexity belongs in the renderer.">
          <p>I kept the raw Markdown in a single TextKit 2 surface. Reading presentation is built with attributes and layout fragments, so formatting never replaces the underlying characters. Selection, copy, and undo remain tied to the source.</p>
        </Decision>
        <Decision number="02" title="Treat external edits as part of the workflow." source={downrightEvidence.architecture}
          consequence="Snapshots and conflict review add state to the app. They also make it possible to recover a version and choose what to keep.">
          <p>A file may be rewritten by another editor or a coding agent. Downright watches the parent directory so atomic file replacements are noticed. It snapshots the incoming content, preserves reading position where possible, and offers Review, Keep Mine, or Take Theirs when local edits are unsaved.</p>
        </Decision>
        <Decision number="03" title="Bring the document into Finder." source={downrightEvidence.quickLook} sourceLabel="Quick Look implementation"
          consequence="Large documents need bounded previews and plain-text fallbacks. The extension cannot spend the same resources as an app window.">
          <p>I extended the shared parsing and rendering contracts into Quick Look. Finder gets a native document preview with selectable text, while the app and extension retain their own resource limits.</p>
        </Decision>
      </Chapter>
      <Chapter id="evidence" number="03" label="In use" title="The details are the product.">
        <p className={styles.prose}>The workflow extends beyond typing: open a file, read it comfortably, inspect the exact source, and stay oriented when something else changes it.</p>
        <MediaFigure src="/projects/downright/editor-showcase.png" alt="Close view of Downright's real document rendering, with code, math and a diagram" width={2940} height={1912} detail label="Rendering detail" caption="A closer crop of the public renderer showcase. Code, math, tasks and diagrams live within the document's native layout." />
        <SourceNote title="About these captures">
          <p>The still is the real renderer showcase from Downright’s repository. The ten-second clip is its public README recording, converted to a smaller video for on-demand playback. Neither is a portfolio recreation of the app.</p>
          <SourceLink href={downrightEvidence.capture}>Original product capture</SourceLink><br />
          <SourceLink href={downrightEvidence.recording}>Original recording</SourceLink>
        </SourceNote>
      </Chapter>
      <Chapter id="outcome" number="04" label="The result" title="A Mac app you can use.">
        <p className={styles.lead}>Downright is available as a signed, notarized macOS app. Its source is public, and core reading and editing run locally without an account.</p>
        <p className={styles.prose}>The part I care about most is the continuity: the same file, the same text, and a reading position that survives a change of view or an external rewrite.</p>
        <div className={styles.closing}><p>Explore the app, download the current release, or read how its document pipeline works.</p><SourceLink href="https://downright.cc/">Visit Downright</SourceLink></div>
      </Chapter>
    </div>
  </>;
}
