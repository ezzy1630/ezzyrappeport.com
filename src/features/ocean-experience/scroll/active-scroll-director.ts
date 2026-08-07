import type { ScrollDirector } from "./ScrollDirector.ts";

let activeDirector: ScrollDirector | null = null;

/** Live ScrollDirector set by OceanExperienceBridge while mounted. */
export function getActiveScrollDirector(): ScrollDirector | null {
  return activeDirector;
}

/** Called only by OceanExperienceBridge on attach/dispose. */
export function setActiveScrollDirector(director: ScrollDirector | null): void {
  activeDirector = director;
}
