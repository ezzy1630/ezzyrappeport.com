/**
 * Scroll actuator registered by the active smooth-scroll adapter.
 * ScrollDirector owns journey seeks; Lenis only performs the concrete write
 * so its internal target cannot overwrite an exact chapter jump.
 */

export type JourneyScrollWriter = (top: number) => void;

let activeWriter: JourneyScrollWriter | null = null;

export function setJourneyScrollWriter(writer: JourneyScrollWriter | null): void {
  activeWriter = writer;
}

export function writeJourneyScrollY(top: number): void {
  const y = Math.max(0, top);
  if (activeWriter) {
    activeWriter(y);
    return;
  }
  window.scrollTo({ top: y, left: 0, behavior: "auto" });
}
