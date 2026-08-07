/**
 * Viscous / input-shaping policy stub.
 * Milestone 0 keeps native scroll identity; shaping is gated for later scenes.
 */

export type InputShapingZone = {
  id: string;
  /** Inclusive progress start. */
  start: number;
  /** Exclusive progress end. */
  end: number;
  /** When false, shaping must never capture input. */
  enabled: boolean;
};

export type InputShapingDecision = {
  /** Whether wheel/touch shaping may run for this progress. */
  allowShaping: boolean;
  zoneId: string | null;
};

const DISABLED: InputShapingDecision = {
  allowShaping: false,
  zoneId: null,
};

/**
 * Default policy: never shape. Later milestones may add named viscous zones
 * only after interaction gates in the transform plan pass.
 */
export function resolveInputShaping(
  progress: number,
  zones: readonly InputShapingZone[] = [],
  options?: { reducedMotion?: boolean },
): InputShapingDecision {
  if (options?.reducedMotion) return DISABLED;
  if (!Number.isFinite(progress) || zones.length === 0) return DISABLED;

  for (const zone of zones) {
    if (!zone.enabled) continue;
    if (progress >= zone.start && progress < zone.end) {
      return { allowShaping: true, zoneId: zone.id };
    }
  }
  return DISABLED;
}

/** Identity delta passthrough — no gain, no capture. */
export function shapeScrollDelta(deltaY: number): number {
  return Number.isFinite(deltaY) ? deltaY : 0;
}
