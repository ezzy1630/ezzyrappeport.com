export type GlyphInteractionState =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "hovering"; glyphIndex: number }>
  | Readonly<{
      kind: "holding";
      glyphIndex: number;
      pointerId: number;
      pressPoint: readonly [number, number];
      startedAt: number;
    }>
  | Readonly<{
      kind: "releasing";
      glyphIndex: number;
      releaseId: number;
      releasedAt: number;
    }>
  | Readonly<{
      kind: "cancelled";
      glyphIndex: number;
      cancelledAt: number;
      reason: "pointer-cancel" | "lost-capture" | "blur" | "hidden" | "teardown";
    }>
  | Readonly<{ kind: "disabled" }>;

export type GlyphInteractionEvent =
  | Readonly<{ type: "enable" }>
  | Readonly<{ type: "disable" }>
  | Readonly<{ type: "hover"; glyphIndex: number | null }>
  | Readonly<{
      type: "pointer-down";
      glyphIndex: number | null;
      pointerId: number;
      pressPoint: readonly [number, number];
      now: number;
    }>
  | Readonly<{ type: "pointer-up"; pointerId: number; now: number }>
  | Readonly<{
      type: "cancel";
      pointerId: number;
      now: number;
      reason: "pointer-cancel" | "lost-capture" | "blur" | "hidden" | "teardown";
    }>
  | Readonly<{ type: "release-complete"; releaseId: number }>;

export type GlyphInteractionTransition = Readonly<{
  state: GlyphInteractionState;
  releaseId: number;
}>;

export type GlyphReleaseDroplet = Readonly<{
  dueAt: number;
  offsetX: number;
  offsetY: number;
}>;

const RELEASE_DROPLET_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.18, -0.04, 0.032],
  [0.12, -0.08, 0.046],
  [-0.08, 0.1, 0.061],
  [0.2, 0.05, 0.074],
  [-0.22, 0.08, 0.08],
];

export function scheduleGlyphReleaseDroplets(releasedAt: number) {
  return RELEASE_DROPLET_OFFSETS.map(([offsetX, offsetY, delay]): GlyphReleaseDroplet => ({
    dueAt: releasedAt + delay,
    offsetX,
    offsetY,
  }));
}

export function createGlyphInteractionState(enabled = true): GlyphInteractionTransition {
  return {
    state: enabled ? { kind: "idle" } : { kind: "disabled" },
    releaseId: 0,
  };
}

function isHolding(state: GlyphInteractionState) {
  return state.kind === "holding";
}

export function transitionGlyphInteraction(
  transition: GlyphInteractionTransition,
  event: GlyphInteractionEvent,
): GlyphInteractionTransition {
  const { state } = transition;

  if (event.type === "disable") {
    return { ...transition, state: { kind: "disabled" } };
  }
  if (event.type === "enable") {
    return state.kind === "disabled" ? { ...transition, state: { kind: "idle" } } : transition;
  }
  if (state.kind === "disabled") return transition;

  if (event.type === "hover") {
    if (isHolding(state) || state.kind === "releasing") return transition;
    return {
      ...transition,
      state: event.glyphIndex === null
        ? { kind: "idle" }
        : { kind: "hovering", glyphIndex: event.glyphIndex },
    };
  }

  if (event.type === "pointer-down") {
    if (event.glyphIndex === null || state.kind === "releasing") return transition;
    return {
      ...transition,
      state: {
        kind: "holding",
        glyphIndex: event.glyphIndex,
        pointerId: event.pointerId,
        pressPoint: event.pressPoint,
        startedAt: event.now,
      },
    };
  }

  if (event.type === "pointer-up") {
    if (state.kind !== "holding" || state.pointerId !== event.pointerId) return transition;
    const releaseId = transition.releaseId + 1;
    return {
      releaseId,
      state: {
        kind: "releasing",
        glyphIndex: state.glyphIndex,
        releaseId,
        releasedAt: event.now,
      },
    };
  }

  if (event.type === "cancel") {
    if (state.kind !== "holding" || state.pointerId !== event.pointerId) return transition;
    return {
      ...transition,
      state: {
        kind: "cancelled",
        glyphIndex: state.glyphIndex,
        cancelledAt: event.now,
        reason: event.reason,
      },
    };
  }

  if (event.type === "release-complete") {
    if (state.kind !== "releasing" || state.releaseId !== event.releaseId) return transition;
    return { ...transition, state: { kind: "idle" } };
  }

  return transition;
}

export function settleCancelledGlyph(
  transition: GlyphInteractionTransition,
  glyphIndex: number | null,
) {
  if (transition.state.kind !== "cancelled") return transition;
  return transitionGlyphInteraction(transition, { type: "hover", glyphIndex });
}
