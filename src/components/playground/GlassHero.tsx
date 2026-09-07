"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play, RotateCcw, Waves } from "lucide-react";
import styles from "./GlassHero.module.css";

export default function GlassHero() {
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<{
    setPaused: (value: boolean) => void;
    reset: () => void;
    splash: () => void;
    capturePoster: (layer?: "title" | "waterDesktop" | "waterMobile") => string | null;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [touchMode, setTouchMode] = useState(false);
  const [debug, setDebug] = useState(false);
  const [capturedPoster, setCapturedPoster] = useState<{ data: string; layer: string } | null>(null);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setDebug(search.has("heroDebug") && search.has("heroExport"));
    const element = host.current;
    if (!element) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    if (connection?.saveData) return;
    let loading = false;
    const initialize = async () => {
      if (cancelled || reduced.matches || loading || controls.current) return;
      loading = true;
      try {
        const { createGlassScene } = await import("./glass-scene");
        if (cancelled || reduced.matches) return;
        const scene = await createGlassScene(
          element,
          () => {
            if (!cancelled && !reduced.matches) setReady(true);
          },
          () => {
            if (!cancelled) {
              controls.current = null;
              dispose = undefined;
              setReady(false);
              setTouchMode(false);
            }
          },
        );
        if (cancelled || reduced.matches) {
          scene.dispose();
          return;
        }
        setPaused(false);
        controls.current = scene;
        dispose = scene.dispose;
      } catch {
        /* The matching rendered poster remains a complete hero. */
      } finally {
        loading = false;
      }
    };
    const onPreference = () => {
      if (reduced.matches) {
        // Return to the poster, including when the preference changes mid-visit.
        dispose?.();
        dispose = undefined;
        controls.current = null;
        setReady(false);
        setPaused(false);
        setTouchMode(false);
      } else {
        void initialize();
      }
    };
    void initialize();
    reduced.addEventListener("change", onPreference);
    return () => {
      cancelled = true;
      reduced.removeEventListener("change", onPreference);
      dispose?.();
      controls.current = null;
    };
  }, []);
  return (
    <>
      <div
        className={styles.scene}
        ref={host}
        data-ready={ready}
        data-touch-mode={touchMode}
        aria-hidden="true"
      >
        <div className={styles.poster}>
          {/* These pre-rendered assets keep glass lettering visible before JavaScript. */}
          <picture>
            <source media="(max-width: 600px)" srcSet="/assets/hero/playground-water-mobile.webp" />
            <Image
              unoptimized
              fill
              className={styles.water}
              src="/assets/hero/playground-water-desktop.webp"
              alt=""
              fetchPriority="high"
            />
          </picture>
        </div>
      </div>
      <div className={styles.titleFrame} data-live={ready} aria-hidden="true">
        <Image
          unoptimized
          data-hero-title
          className={styles.title}
          src="/assets/hero/playground-title.webp"
          width={1600}
          height={780}
          alt=""
          fetchPriority="high"
        />
      </div>
      {debug && ready && (
        <aside className={styles.debug}>
          <p>Exports reset the letters and water to rest.</p>
          {(["title", "waterDesktop", "waterMobile"] as const).map((layer) => (
            <button key={layer} onClick={() => {
              const data = controls.current?.capturePoster(layer);
              if (data) setCapturedPoster({ data, layer });
            }}>
              Export {layer}
            </button>
          ))}
          {capturedPoster && (
            <a href={capturedPoster.data} download={`playground-${capturedPoster.layer}.png`}>
              {/* A browser-rendered QA export, generated only on explicit request. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capturedPoster.data} alt="Captured scene poster" />
              Download PNG
            </a>
          )}
        </aside>
      )}
      {ready && (
        <div className={styles.controls}>
          <span>Drag a letter. Make a little wave.</span>
          <button
            className={styles.touchToggle}
            aria-pressed={touchMode}
            disabled={paused}
            onClick={() => setTouchMode(!touchMode)}
          >
            {touchMode ? "Back to scrolling" : "Play with letters"}
          </button>
          <button
            aria-label="Make a wave"
            disabled={paused}
            onClick={() => controls.current?.splash()}
          >
            <Waves size={17} />
          </button>
          <button
            className={styles.globalPause}
            aria-label={
              paused ? "Resume water animation" : "Pause water animation"
            }
            aria-pressed={paused}
            onClick={() => {
              controls.current?.setPaused(!paused);
              setPaused(!paused);
              setTouchMode(false);
            }}
          >
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            aria-label="Return letters to their starting positions"
            onClick={() => controls.current?.reset()}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}
    </>
  );
}
