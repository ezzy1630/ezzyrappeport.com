"use client";

/**
 * World state — one continuous body of water
 * ------------------------------------------
 * The whole site is a single descent: the hero floats just beneath the
 * surface, Projects hang in the bright middle depth, About is a calmer
 * pocket, and Contact is the ocean floor. This module turns the document's
 * scroll position into one normalized, monotonic, reversible `depth` value
 * (0 = surface, 1 = floor) plus derived physical quantities. The WebGL
 * renderer, the DOM, and the navigation all read from this same curve, so
 * color, light, fog, and calm stay physically coherent — and scrolling back
 * up retraces the exact inverse journey.
 *
 * Depth is anchored to measured section geometry (not a raw 0..1 document
 * progress), so the curve survives content reflows and viewport changes.
 */

export type WorldSectionId = "hero" | "projects" | "about" | "contact";

export type WorldState = {
  /** 0 at the surface (hero top) → 1 at the ocean floor (page bottom). */
  depth: number;
  /** Smoothed scroll velocity in viewport-heights per second, signed. */
  velocity: number;
  /** 1 at the bright surface → ~0.05 in the basin. Drives DOM legibility. */
  light: number;
  /** 1 inside calm reading pockets (Projects copy + About) → water locally calms. */
  calm: number;
  /** Which section currently owns the viewport midline. */
  section: WorldSectionId;
  /** 0..1 progress through the active section's own range. */
  sectionProgress: number;
  /** True on case-study routes, which sit at a fixed deep mooring. */
  moored: boolean;
};

/** Depth assigned to named points in the measured section journey. */
export const WORLD_DEPTH_ANCHORS = {
  heroTop: 0,
  heroBottom: 0.1,
  projectsBottom: 0.38,
  aboutMid: 0.56,
  contactApproach: 0.74,
  contactBottom: 1,
} as const;

/** Case-study routes float in the same shallow water as the early index. */
export const CASE_MOORING_DEPTH = 0.22;

export type SectionRange = {
  id: WorldSectionId;
  top: number;
  bottom: number;
};

const SECTION_SELECTORS: ReadonlyArray<readonly [WorldSectionId, string]> = [
  ["hero", ".hero-shell"],
  ["projects", "#projects"],
  ["about", "#about"],
  ["contact", "#contact"],
];

let cachedRanges: SectionRange[] | null = null;
let measuredScrollHeight = 0;
let measuredAt = 0;

function measureSectionRanges(): SectionRange[] | null {
  if (typeof document === "undefined") return null;
  const scrollY = window.scrollY;
  const ranges: SectionRange[] = [];
  for (const [id, selector] of SECTION_SELECTORS) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    ranges.push({ id, top: rect.top + scrollY, bottom: rect.bottom + scrollY });
  }
  // Keep ranges strictly ordered even while fonts/layout settle.
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].top < ranges[index - 1].bottom - 1) {
      ranges[index].top = ranges[index - 1].bottom;
    }
    if (ranges[index].bottom < ranges[index].top) ranges[index].bottom = ranges[index].top;
  }
  return ranges;
}

export function invalidateWorldMeasurement() {
  cachedRanges = null;
}

function sectionRanges(): SectionRange[] | null {
  const scrollHeight = document.documentElement.scrollHeight;
  const now = performance.now();
  if (
    cachedRanges
    && Math.abs(scrollHeight - measuredScrollHeight) < 2
    && now - measuredAt < 4000
  ) {
    return cachedRanges;
  }
  const measured = measureSectionRanges();
  if (measured) {
    cachedRanges = measured;
    measuredScrollHeight = scrollHeight;
    measuredAt = now;
  }
  return cachedRanges;
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - edge0) / Math.max(edge1 - edge0, 0.00001)));
  return t * t * (3 - 2 * t);
}

function lightForDepth(depth: number) {
  return 1 - smoothstep(0.06, 0.88, depth) * 0.95;
}

function smootherstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

type DepthKnot = readonly [position: number, depth: number];

function depthKnots(
  ranges: readonly SectionRange[],
  viewportHeight: number,
  scrollHeight: number,
): DepthKnot[] {
  const hero = ranges[0];
  const projects = ranges[1];
  const about = ranges[2];
  const contact = ranges[3];
  const anchors = WORLD_DEPTH_ANCHORS;
  const maxScroll = Math.max(scrollHeight - viewportHeight, 1);
  const contactApproach = Math.max(
    about.top,
    Math.min(maxScroll, contact.top - viewportHeight),
  );
  const aboutMid = Math.max(
    projects.bottom,
    Math.min(contactApproach - 1, about.top + (about.bottom - about.top) * 0.32),
  );
  const rawKnots: DepthKnot[] = [
    [hero.top, anchors.heroTop],
    [hero.bottom, anchors.heroBottom],
    [projects.bottom, anchors.projectsBottom],
    [aboutMid, anchors.aboutMid],
    [contactApproach, anchors.contactApproach],
    [maxScroll, anchors.contactBottom],
  ];
  const knots = rawKnots.map(([position, depth]) => [
    Math.max(0, Math.min(maxScroll, position)),
    depth,
  ] as DepthKnot);
  for (let index = 1; index < knots.length; index += 1) {
    if (knots[index][0] <= knots[index - 1][0]) {
      knots[index] = [knots[index - 1][0] + 1, knots[index][1]];
    }
  }
  return knots;
}

/**
 * Map an absolute document scroll position to world depth. The knots are
 * measured from section geometry, while each segment uses a smootherstep so
 * its value and slope meet continuously at section-aware anchors. This keeps
 * the journey monotonic and reversible without making the renderer chase
 * document-percentage presets.
 */
export function worldDepthForScroll(
  scrollY: number,
  ranges: SectionRange[],
  viewportHeight: number,
  scrollHeight: number,
): number {
  const knots = depthKnots(ranges, viewportHeight, scrollHeight);
  if (scrollY <= knots[0][0]) return knots[0][1];
  for (let index = 1; index < knots.length; index += 1) {
    const [nextPosition, nextDepth] = knots[index];
    const [previousPosition, previousDepth] = knots[index - 1];
    if (scrollY <= nextPosition) {
      const t = (scrollY - previousPosition) / Math.max(nextPosition - previousPosition, 1);
      return previousDepth + (nextDepth - previousDepth) * smootherstep(t);
    }
  }
  return knots[knots.length - 1][1];
}

function activeSection(
  scrollY: number,
  viewportHeight: number,
  ranges: SectionRange[],
): { section: WorldSectionId; sectionProgress: number } {
  const line = scrollY + viewportHeight * 0.48;
  for (const range of ranges) {
    if (line >= range.top && line <= range.bottom) {
      return {
        section: range.id,
        sectionProgress: Math.max(0, Math.min(1, (line - range.top) / Math.max(range.bottom - range.top, 1))),
      };
    }
  }
  return line < ranges[0].top
    ? { section: "hero", sectionProgress: 0 }
    : { section: "contact", sectionProgress: 1 };
}

const STILL_WORLD: WorldState = {
  depth: 0,
  velocity: 0,
  light: 1,
  calm: 0,
  section: "hero",
  sectionProgress: 0,
  moored: false,
};

export function stillWorld(): WorldState {
  return { ...STILL_WORLD };
}

/**
 * Compute the live world state for the current frame. Returns `null` when
 * the home sections are not mounted (case-study routes moor at a fixed
 * depth instead).
 */
export function computeWorldState(scrollVelocity: number): WorldState {
  if (typeof document === "undefined") return stillWorld();
  const isCaseRoute = Boolean(document.querySelector("[data-water-section='case']"));
  const ranges = sectionRanges();
  if (isCaseRoute || !ranges) {
    return {
      depth: CASE_MOORING_DEPTH,
      velocity: scrollVelocity,
      light: lightForDepth(CASE_MOORING_DEPTH),
      calm: 0.25,
      section: "contact",
      sectionProgress: 0,
      moored: true,
    };
  }
  const scrollY = window.scrollY;
  const viewportHeight = Math.max(window.innerHeight, 1);
  const depth = worldDepthForScroll(
    scrollY,
    ranges,
    viewportHeight,
    document.documentElement.scrollHeight,
  );
  const { section, sectionProgress } = activeSection(scrollY, viewportHeight, ranges);
  // Sunlight transmission: bright shallows, gentle mid falloff, dark basin.
  const light = lightForDepth(depth);
  // Calm reading pockets: Projects copy zones get a partial pocket so
  // refraction stays soft behind text while open water keeps caustics.
  // About retains the deeper quiet pocket.
  const projectsRange = ranges[1];
  const aboutRange = ranges[2];
  const line = scrollY + viewportHeight * 0.48;
  const projectsSpan = Math.max(projectsRange.bottom - projectsRange.top, 1);
  const aboutSpan = Math.max(aboutRange.bottom - aboutRange.top, 1);
  const distanceIntoProjects = (line - projectsRange.top) / projectsSpan;
  const distanceIntoAbout = (line - aboutRange.top) / aboutSpan;
  const projectsCalm = section === "projects"
    ? smoothstep(0, 0.12, distanceIntoProjects) * (1 - smoothstep(0.88, 1, distanceIntoProjects)) * 0.55
    : 0;
  const aboutCalm = section === "about"
    ? smoothstep(0, 0.22, distanceIntoAbout) * (1 - smoothstep(0.78, 1, distanceIntoAbout))
    : 0;
  const calm = Math.max(projectsCalm, aboutCalm);
  return {
    depth,
    velocity: scrollVelocity,
    light,
    calm,
    section,
    sectionProgress,
    moored: false,
  };
}
