"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./AbyssEasterEgg.module.css";

const HOLD_MS = 1400;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Free-dive past the contact floor: hold Keep diving (pointer or keyboard) to
 * enter a short hidden abyss. Complete modal: trap, restore, Escape, hold parity.
 */
export default function AbyssEasterEgg() {
  const [open, setOpen] = useState(false);
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const holdStartedAt = useRef(0);
  const diveButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdStartedAt.current = 0;
    setHolding(false);
  }, []);

  const openAbyss = useCallback(() => {
    restoreFocusRef.current = diveButtonRef.current;
    setOpen(true);
    setHolding(false);
    holdTimer.current = null;
  }, []);

  const startHold = useCallback(() => {
    if (holdTimer.current !== null) return;
    setHolding(true);
    holdStartedAt.current = performance.now();
    holdTimer.current = window.setTimeout(() => {
      openAbyss();
    }, HOLD_MS);
  }, [openAbyss]);

  const closeAbyss = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const snapshot = {
      depth: root.style.getPropertyValue("--world-depth"),
      navTheme: root.dataset.navTheme ?? "",
    };
    root.style.setProperty("--world-depth", "1");
    root.dataset.navTheme = "white-on-deep";

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const target = dialog?.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
      target?.focus();
    };
    const focusFrame = window.requestAnimationFrame(focusFirst);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "ArrowUp") {
        event.preventDefault();
        closeAbyss();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (snapshot.depth) {
        root.style.setProperty("--world-depth", snapshot.depth);
      } else {
        root.style.removeProperty("--world-depth");
      }
      if (snapshot.navTheme) {
        root.dataset.navTheme = snapshot.navTheme;
      } else {
        delete root.dataset.navTheme;
      }
      const restore = restoreFocusRef.current;
      window.requestAnimationFrame(() => restore?.focus());
    };
  }, [closeAbyss, open]);

  useEffect(() => () => clearHold(), [clearHold]);

  return (
    <>
      <button
        ref={diveButtonRef}
        type="button"
        className={styles.dive}
        data-holding={holding ? "true" : "false"}
        aria-label="Hidden abyss. Hold Enter or Space for about one and a half seconds to keep diving."
        aria-describedby={descriptionId}
        title="Hold to keep diving"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          startHold();
        }}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            // Require a full hold — releasing early cancels, matching pointer.
            if (performance.now() - holdStartedAt.current < HOLD_MS) clearHold();
          }
        }}
        onBlur={clearHold}
      >
        <span className={styles.diveLabel}>Keep diving</span>
        <span className={styles.diveHint} aria-hidden="true">hold</span>
        <i aria-hidden="true" />
      </button>
      <span id={descriptionId} className={styles.srOnly}>
        Hold the button with pointer or keyboard for one and a half seconds to open the hidden abyss. Press Escape to return.
      </span>

      {open ? (
        <div
          ref={dialogRef}
          className={styles.abyss}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={`${titleId}-msg`}
          data-abyss-dialog=""
          tabIndex={-1}
        >
          <div className={styles.basinPlate} aria-hidden="true" />
          <div className={styles.particulate} aria-hidden="true" />
          <h2 id={titleId} className={styles.srOnly}>Hidden abyss</h2>
          <p id={`${titleId}-msg`} className={styles.thanks}>if ur reading this pls hire me</p>
          <button
            type="button"
            className={styles.surface}
            onClick={closeAbyss}
          >
            Return to the floor
          </button>
        </div>
      ) : null}
    </>
  );
}
