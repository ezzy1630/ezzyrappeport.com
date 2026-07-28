/**
 * Hero journey choreography — pure mappings (plan §8.7).
 *
 * Local hero progress spans the surface + descent chapters. Four continuous
 * phases:
 *   1. Arrival    0.00–0.18  settle from the loading poster into the live scene
 *   2. Living name 0.18–0.52 composed camera; scroll adds slight water tension
 *   3. Release    0.52–0.82  camera descends; letters lag, rotate, refract
 *   4. Pass-under 0.82–1.00  camera travels beneath/between the rising letters
 *
 * Every mapping here is a pure function of normalized progress, so reverse
 * scroll reconstructs the exact same composition. Secondary physical response
 * (glyph jostle, pointer wake) lives in the fixed-step solver and decays back
 * to this deterministic primary state.
 */

import {
  type LayoutMode,
  chapterRangesForLayout,
} from "../contracts/chapter.ts";
import { clamp01 } from "./scroll-mapping.ts";

export const HERO_PHASE_ARRIVAL_END = 0.18;
export const HERO_PHASE_LIVING_END = 0.52;
export const HERO_PHASE_RELEASE_END = 0.82;

export type HeroPhase = "arrival" | "living" | "release" | "pass-under";

export type HeroPhaseState = {
  /** Local hero progress in [0, 1]. */
  progress: number;
  phase: HeroPhase;
  /** Progress inside the active phase in [0, 1]. */
  phaseProgress: number;
  /** Living-phase water tension in [0, 1]; gone once the release commits. */
  tension: number;
  /** Release master in [0, 1] — camera begins descending, letters lag. */
  release: number;
  /** Pass-under master in [0, 1] — letters rise through the waterline. */
  passUnder: number;
  /**
   * Combined departure in [0, 1] used for per-glyph stagger and dissolve.
   * Starts at the release edge and completes exactly at progress 1.
   */
  gone: number;
  /** Caustic beam stretching down toward the first project waters, [0, 1]. */
  descentBeam: number;
};

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Journey progress at which the hero journey completes (descent chapter end). */
export function heroJourneyEndForLayout(layout: LayoutMode): number {
  const ranges = chapterRangesForLayout(layout);
  const descent = ranges.find((range) => range.id === "descent");
  if (!descent) {
    throw new Error("Chapter ranges missing descent chapter");
  }
  return descent.end;
}

/**
 * Map root-relative journey progress to local hero progress. Progress past
 * the descent chapter clamps to 1 — the name stays fully released.
 */
export function heroProgressForJourney(
  journeyProgress: number,
  layout: LayoutMode,
): number {
  const end = heroJourneyEndForLayout(layout);
  if (end <= 0) return 1;
  return clamp01(journeyProgress / end);
}

export function heroPhaseState(progress: number): HeroPhaseState {
  const p = clamp01(progress);
  const release = smoothstep01(
    (p - HERO_PHASE_LIVING_END) / (HERO_PHASE_RELEASE_END - HERO_PHASE_LIVING_END),
  );
  const passUnder = smoothstep01((p - HERO_PHASE_RELEASE_END) / (1 - HERO_PHASE_RELEASE_END));
  // Living-phase tension builds after arrival and releases with the departure.
  const tension = smoothstep01((p - HERO_PHASE_ARRIVAL_END) / 0.2) * (1 - release);
  const gone = smoothstep01((p - HERO_PHASE_LIVING_END) / (1 - HERO_PHASE_LIVING_END));
  // Focused caustic energy stretches downward through the pass-under and
  // hands off as the light path into the first project waters.
  const descentBeam = smoothstep01((p - (HERO_PHASE_RELEASE_END - 0.1)) / 0.24);

  let phase: HeroPhase;
  let phaseProgress: number;
  if (p < HERO_PHASE_ARRIVAL_END) {
    phase = "arrival";
    phaseProgress = p / HERO_PHASE_ARRIVAL_END;
  } else if (p < HERO_PHASE_LIVING_END) {
    phase = "living";
    phaseProgress = (p - HERO_PHASE_ARRIVAL_END) / (HERO_PHASE_LIVING_END - HERO_PHASE_ARRIVAL_END);
  } else if (p < HERO_PHASE_RELEASE_END) {
    phase = "release";
    phaseProgress = release;
  } else {
    phase = "pass-under";
    phaseProgress = passUnder;
  }

  return {
    progress: p,
    phase,
    phaseProgress: clamp01(phaseProgress),
    tension,
    release,
    passUnder,
    gone,
    descentBeam,
  };
}

/**
 * Per-letter release: physical rise staggers ~0.028 of the master curve per
 * glyph index so the name loosens letter by letter, never shatters.
 */
export function staggeredGlyphRelease(gone: number, glyphIndex: number): number {
  const delay = glyphIndex * 0.028;
  return smoothstep01((gone - delay) / Math.max(0.55, 1 - delay));
}

/**
 * Optical dissolve trails the first half of the rise: letters keep their
 * mass while they lag, then thin as they pass through the pass-under
 * waterline — the name fragments optically, never shatters.
 */
export function glyphFadeForRelease(gone: number): number {
  return smoothstep01((gone - 0.45) / 0.5);
}

