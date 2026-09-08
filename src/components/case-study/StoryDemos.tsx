"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Play, Check, Minus } from "lucide-react";
import styles from "./Editorial.module.css";

function useHydrated() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}

/** The recording is requested only after an explicit play action. */
export function ProductRecording() {
  const ready = useHydrated();
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (playing) video.current?.focus({ preventScroll: true });
    else if (restoreFocus.current) {
      playButton.current?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [playing]);
  const finish = () => {
    restoreFocus.current = document.activeElement === video.current;
    setPlaying(false);
  };
  return <figure className={styles.recording}>
    <div className={styles.recordingFrame}>
      {playing ? <video ref={video} tabIndex={0} controls autoPlay muted playsInline preload="metadata" aria-label="Downright product walkthrough" onEnded={finish}>
        <source src="/projects/downright/editor-demo.mp4" type="video/mp4" />
        <a href="/projects/downright/editor-demo.mp4">Download the Downright recording</a>
      </video> : <>
        <Image src="/projects/downright/editor-showcase.png" width={2940} height={1912} alt="Downright's native document view" priority sizes="(max-width: 800px) 90vw, 65vw" />
        <button ref={playButton} type="button" disabled={!ready} onClick={() => setPlaying(true)}><Play size={17} fill="currentColor" aria-hidden="true" />Play app walkthrough<span>10 sec</span></button>
      </>}
    </div>
    <figcaption><span>Actual product recording</span><p>Open from Finder, read the document, inspect its source, and review an external rewrite. Silent recording from Downright’s public README.</p><noscript><a href="/projects/downright/editor-demo.mp4">Watch the recording</a></noscript></figcaption>
  </figure>;
}

export function DetectionRule() {
  const ready = useHydrated();
  const [blocked, setBlocked] = useState(true);
  const [observed, setObserved] = useState(false);
  const result = blocked ? observed ? "PASS" : "WEAK" : observed ? "PARTIAL" : "FAIL";
  const explanation = blocked
    ? observed ? "The attack was blocked and the defense left detection evidence." : "The attack was blocked, but there is no evidence that a detection fired."
    : observed ? "A detection fired, but the attack still succeeded." : "The attack succeeded without a detection.";
  return <div className={styles.detectionRule}>
    <div className={styles.ruleHeading}><p className={styles.label}>Explore the detection oracle</p><p>Change the two facts.</p></div>
    <fieldset disabled={!ready}><legend className="sr-only">Detection scenario</legend>
      <label><input type="checkbox" checked={blocked} onChange={event => setBlocked(event.target.checked)} /><span className={styles.checkboxIcon} aria-hidden="true">{blocked ? <Check size={18} /> : <Minus size={18} />}</span><span><strong>Attack blocked</strong><small>Prevention</small></span></label>
      <label><input type="checkbox" checked={observed} onChange={event => setObserved(event.target.checked)} /><span className={styles.checkboxIcon} aria-hidden="true">{observed ? <Check size={18} /> : <Minus size={18} />}</span><span><strong>Detection observed</strong><small>Observability</small></span></label>
    </fieldset>
    <div className={styles.ruleResult} data-result={result} aria-live="polite" aria-atomic="true"><span>{result}</span><p>{explanation}</p></div>
    <p className={styles.ruleCaption}>Interactive explanation of the oracle’s four outcomes. It does not execute an attack or report a live test.</p>
    <details className={styles.ruleReference}><summary>All four outcomes</summary><dl>
      <div><dt>PASS</dt><dd>Blocked and observed.</dd></div>
      <div><dt>WEAK</dt><dd>Blocked, without detection evidence.</dd></div>
      <div><dt>PARTIAL</dt><dd>Observed, but not blocked.</dd></div>
      <div><dt>FAIL</dt><dd>Neither blocked nor observed.</dd></div>
    </dl></details>
  </div>;
}
