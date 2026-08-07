/**
 * Approved ocean-journey chapter schema.
 * Ranges are normalized progress [0, 1]. Milestone 0 keeps the live homepage
 * layout unchanged; these ranges are the contract for later authored travel.
 *
 * Relative shares from HOMEPAGE_CINEMATIC_TRANSFORMATION_PLAN §5:
 * surface 14%, descent 8%, monkeyclaw/etch/flowe 17% each, argyph 8%,
 * charted-work 6%, about 7%, contact 6%.
 */

export type ChapterId =
  | "surface"
  | "descent"
  | "monkeyclaw"
  | "etch"
  | "flowe"
  | "argyph"
  | "charted-work"
  | "about"
  | "contact";

export type LayoutMode = "desktop" | "mobile";

export type ChapterRange = {
  id: ChapterId;
  /** Inclusive start in [0, 1]. */
  start: number;
  /** Exclusive end in (start, 1], except the final chapter which is inclusive at 1. */
  end: number;
  label: string;
  hash: string;
};

export type ChapterDefinition = {
  id: ChapterId;
  label: string;
  title: string;
  summary: string;
  hash: string;
};

/**
 * Document-relative travel is used in Milestone 0 (no fixed vh rail yet).
 * Helpers still accept a rail VH so later milestones can author physical spans.
 */
export const DESKTOP_RAIL_VH = 100;
export const MOBILE_RAIL_VH = 100;

export const CHAPTER_ORDER: readonly ChapterId[] = [
  "surface",
  "descent",
  "monkeyclaw",
  "etch",
  "flowe",
  "argyph",
  "charted-work",
  "about",
  "contact",
] as const;

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: "surface",
    label: "Surface",
    title: "Living name",
    summary: "Bright surface arrival and hero play.",
    hash: "#top",
  },
  {
    id: "descent",
    label: "Descent",
    title: "First descent",
    summary: "Hero release into the first project waters.",
    hash: "#projects",
  },
  {
    id: "monkeyclaw",
    label: "MonkeyClaw",
    title: "Adversarial current",
    summary: "Continuous security testing around a live agent runtime.",
    hash: "#project-monkeyclaw",
  },
  {
    id: "etch",
    label: "Etch",
    title: "Verification path",
    summary: "Typed hardware intent through evidence-backed proof.",
    hash: "#project-etch",
  },
  {
    id: "flowe",
    label: "FlowE",
    title: "Planning current",
    summary: "Calm operating system for tasks, canvas, and focus.",
    hash: "#project-flowe",
  },
  {
    id: "argyph",
    label: "Argyph",
    title: "Local sonar index",
    summary: "Short local-first code intelligence beat.",
    hash: "#project-argyph",
  },
  {
    id: "charted-work",
    label: "Charted Work",
    title: "Project catalog",
    summary: "All seven projects remain directly reachable.",
    hash: "#projects",
  },
  {
    id: "about",
    label: "About",
    title: "Thermocline",
    summary: "Quiet human reading pocket.",
    hash: "#about",
  },
  {
    id: "contact",
    label: "Contact",
    title: "Abyssal basin",
    summary: "Still close with direct email.",
    hash: "#contact",
  },
] as const;

/** Desktop journey ranges — plan §5 relative shares, coverage exactly [0, 1]. */
export const DESKTOP_CHAPTER_RANGES: readonly ChapterRange[] = [
  { id: "surface", start: 0, end: 0.14, label: "Surface", hash: "#top" },
  { id: "descent", start: 0.14, end: 0.22, label: "Descent", hash: "#projects" },
  { id: "monkeyclaw", start: 0.22, end: 0.39, label: "MonkeyClaw", hash: "#project-monkeyclaw" },
  { id: "etch", start: 0.39, end: 0.56, label: "Etch", hash: "#project-etch" },
  { id: "flowe", start: 0.56, end: 0.73, label: "FlowE", hash: "#project-flowe" },
  { id: "argyph", start: 0.73, end: 0.81, label: "Argyph", hash: "#project-argyph" },
  { id: "charted-work", start: 0.81, end: 0.87, label: "Charted Work", hash: "#projects" },
  { id: "about", start: 0.87, end: 0.94, label: "About", hash: "#about" },
  { id: "contact", start: 0.94, end: 1, label: "Contact", hash: "#contact" },
] as const;

/**
 * Mobile journey ranges — same story order; slightly longer surface share so
 * the first viewport stays hero-owned on short phones.
 */
export const MOBILE_CHAPTER_RANGES: readonly ChapterRange[] = [
  { id: "surface", start: 0, end: 0.16, label: "Surface", hash: "#top" },
  { id: "descent", start: 0.16, end: 0.24, label: "Descent", hash: "#projects" },
  { id: "monkeyclaw", start: 0.24, end: 0.4, label: "MonkeyClaw", hash: "#project-monkeyclaw" },
  { id: "etch", start: 0.4, end: 0.56, label: "Etch", hash: "#project-etch" },
  { id: "flowe", start: 0.56, end: 0.72, label: "FlowE", hash: "#project-flowe" },
  { id: "argyph", start: 0.72, end: 0.8, label: "Argyph", hash: "#project-argyph" },
  { id: "charted-work", start: 0.8, end: 0.86, label: "Charted Work", hash: "#projects" },
  { id: "about", start: 0.86, end: 0.93, label: "About", hash: "#about" },
  { id: "contact", start: 0.93, end: 1, label: "Contact", hash: "#contact" },
] as const;

/** Legacy DOM water-section ids published for current nav/chrome. */
export type WaterSectionId = "hero" | "projects" | "about" | "contact";

export function isChapterId(value: string): value is ChapterId {
  return (CHAPTER_ORDER as readonly string[]).includes(value);
}

export function chapterDefinition(id: ChapterId): ChapterDefinition {
  const found = CHAPTERS.find((chapter) => chapter.id === id);
  if (!found) {
    throw new Error(`Unknown chapter: ${id}`);
  }
  return found;
}

export function chapterRangesForLayout(layout: LayoutMode): readonly ChapterRange[] {
  return layout === "mobile" ? MOBILE_CHAPTER_RANGES : DESKTOP_CHAPTER_RANGES;
}

export function railVhForLayout(layout: LayoutMode): number {
  return layout === "mobile" ? MOBILE_RAIL_VH : DESKTOP_RAIL_VH;
}

export function chapterIdFromHash(hash: string): ChapterId | null {
  const normalized = hash.startsWith("#") ? hash : `#${hash}`;
  // Prefer the most specific chapter hash (project anchors before shared #projects).
  const matches = CHAPTERS.filter((chapter) => chapter.hash === normalized);
  if (matches.length === 0) return null;
  if (normalized === "#projects") {
    return "charted-work";
  }
  return matches[0].id;
}

/**
 * Bridge approved chapters to the current four-section water chrome without
 * changing measured world-depth behavior.
 */
export function waterSectionForChapter(id: ChapterId): WaterSectionId {
  switch (id) {
    case "surface":
    case "descent":
      return "hero";
    case "monkeyclaw":
    case "etch":
    case "flowe":
    case "argyph":
    case "charted-work":
      return "projects";
    case "about":
      return "about";
    case "contact":
      return "contact";
  }
}
