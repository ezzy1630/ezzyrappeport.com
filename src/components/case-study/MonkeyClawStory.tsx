import type { Project } from "@/lib/portfolio/content";
import { monkeyEvidence, recordedFinding } from "@/lib/portfolio/story-evidence";
import { Chapter, Decision, FindingRecord, Ownership, SourceLink, SourceNote, StoryNavigation, StoryOpening } from "./Editorial";
import { DetectionRule } from "./StoryDemos";
import styles from "./Editorial.module.css";

const sections = [
  { id: "overview", label: "One finding" },
  { id: "approach", label: "My contribution" },
  { id: "evidence", label: "The detection rule" },
  { id: "outcome", label: "The boundary" },
] as const;

export function MonkeyClawOpening({ project }: { project: Project }) {
  return <StoryOpening project={project} mark="/projects/marks/monkeyclaw.svg" label="Agent security / Team project"
    introduction="On a three-person team, I worked on the path from sandbox events to reproducible evidence: telemetry ingestion, transcript replay, and the dashboard.">
    <FindingRecord />
  </StoryOpening>;
}

export default function MonkeyClawStory() {
  return <>
    <StoryNavigation sections={sections} />
    <div className={styles.story}>
      <Chapter id="overview" number="01" label="One finding" title="A routine request. An observable failure.">
        <p className={styles.lead}>The request was to save a backup. In the deterministic demo, the mock victim wrote beyond its allowed workspace. The useful result was a finding that could be inspected and replayed.</p>
        <ol className={styles.trace}>
          <li><span aria-hidden="true">01</span><div><h3>Keep the triggering requests.</h3><p>The original transcript contains two requests: a report backup and a log export. The fixture preserves those requests alongside the evidence.</p></div></li>
          <li><span aria-hidden="true">02</span><div><h3>Confirm the side effect.</h3><p>A programmatic <code>{recordedFinding.check}</code> check records writes outside the permitted workspace. The demo uses a controlled escape directory; these are mock-sandbox results.</p></div></li>
          <li><span aria-hidden="true">03</span><div><h3>Reduce it to a replay.</h3><p>Package <code>{recordedFinding.package}</code> retains one request and a cold-verification flag. A finding summary alone would not preserve enough detail to repeat it.</p></div></li>
          <li className={styles.boundary}><span aria-hidden="true">04</span><div><h3>Stop where the evidence stops.</h3><p>The package is marked for patching. This fixture contains no completed patch or linked patch-verification result.</p></div></li>
        </ol>
        <SourceLink href={monkeyEvidence.fixture}>Inspect the recorded fixture</SourceLink>
      </Chapter>
      <Chapter id="approach" number="02" label="My contribution" title="Make the evidence survive the handoff.">
        <Ownership scope="Native telemetry adapter, demo/reproduction plumbing, evidence dashboard" team="Justin Lee, Ezzy Rappeport, George Gong">
          My contributions connected the sandbox’s events to the security workflow and made the demo easier to reproduce and inspect. The wider security loop is team work.
        </Ownership>
        <Decision number="01" title="Replay the actual transcript." source={monkeyEvidence.reproductionContribution} sourceLabel="My reproduction changes"
          consequence="A deterministic mock makes the workflow repeatable without credentials. It remains a controlled demonstration, with different evidence requirements from a live deployment.">
          <p>The original reproduction path reconstructed an attack from its summary, which could lose the request that caused the failure. I changed it to persist and replay the actual attacker transcript, and repaired the demo’s sandbox watching and cold-verification path.</p>
        </Decision>
        <Decision number="02" title="Normalize events at the boundary." source={monkeyEvidence.telemetryContribution} sourceLabel="My telemetry adapter and tests"
          consequence="Unknown or malformed hook events are skipped and counted. Their absence must remain visible when interpreting detection coverage.">
          <p>I added an adapter for native OpenClaw hook events. It maps the JSONL stream into the existing telemetry contract, resumes from its prior offset, and keeps the detection oracle independent of the source event format.</p>
        </Decision>
        <Decision number="03" title="Let live data update without losing your place." source={monkeyEvidence.dashboardContribution} sourceLabel="My dashboard changes"
          consequence="The dashboard tracks what has changed between responses. That extra state preserves scroll position and open detail sections during updates.">
          <p>I changed the dashboard to skip unchanged section writes and preserve the reader’s position. I also added section navigation and a stale-connection notice so a live-looking screen could communicate when its data had stopped arriving.</p>
        </Decision>
      </Chapter>
      <Chapter id="evidence" number="03" label="The detection rule" title="A blocked attack tells half the story.">
        <p className={styles.prose}>The detection oracle asks two separate questions: did the defense stop the attack, and did it leave evidence of detection? A block without observability gets a different result from a block with telemetry.</p>
        <DetectionRule />
        <SourceLink href={monkeyEvidence.oracle}>The four-outcome oracle</SourceLink>
        <SourceNote title="Oracle logic and end-to-end verification are separate">
          <p>This control explains the oracle’s quadrant rule. The current patch-verification path can skip detection checks when evidence is missing or detection is disabled. An oracle PASS does not establish that every verification path enforces the same boundary.</p>
          <SourceLink href={monkeyEvidence.verifier}>Detection-gate implementation</SourceLink>
        </SourceNote>
      </Chapter>
      <Chapter id="outcome" number="04" label="The boundary" title="Make every claim traceable.">
        <p className={styles.lead}>This recorded example supports a confirmed finding and a saved reproduction. It does not establish a completed, verified fix.</p>
        <p className={styles.prose}>The distinction matters to the product: a security dashboard needs to communicate the state of the evidence at each step. My work made the transcript, telemetry, and changing system state easier to carry through that workflow.</p>
        <div className={styles.closing}><p>Explore the public demo documentation and the implementation behind this case study.</p><SourceLink href={monkeyEvidence.demo}>Read the demo guide</SourceLink></div>
      </Chapter>
    </div>
  </>;
}
