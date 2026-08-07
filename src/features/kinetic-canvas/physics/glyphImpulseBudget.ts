/**
 * Bounded impulse budget for glyph click storms.
 * Prevents simulation explosion under rapid repeated presses.
 */

export type GlyphImpulseBudget = {
  energy: number;
  maxEnergy: number;
  rechargePerSecond: number;
  lastConsumeAt: number;
};

export function createGlyphImpulseBudget(
  maxEnergy = 1,
  rechargePerSecond = 0.62,
): GlyphImpulseBudget {
  return {
    energy: maxEnergy,
    maxEnergy,
    rechargePerSecond,
    lastConsumeAt: 0,
  };
}

export function rechargeGlyphImpulseBudget(
  budget: GlyphImpulseBudget,
  now: number,
) {
  if (budget.energy >= budget.maxEnergy) {
    budget.lastConsumeAt = now;
    return budget.energy;
  }
  const elapsed = Math.max(0, now - budget.lastConsumeAt);
  budget.energy = Math.min(
    budget.maxEnergy,
    budget.energy + elapsed * budget.rechargePerSecond,
  );
  budget.lastConsumeAt = now;
  return budget.energy;
}

export function tryConsumeGlyphImpulse(
  budget: GlyphImpulseBudget,
  now: number,
  cost = 0.28,
) {
  rechargeGlyphImpulseBudget(budget, now);
  // Always allow a scaled impulse — never hard-drop presses during click storms.
  // Near-empty budget applies a near-zero response instead of ignoring input.
  const available = Math.max(budget.energy, 0);
  const scale = Math.min(1, Math.max(0.08, available / Math.max(cost, 0.0001)));
  budget.energy = Math.max(0, budget.energy - cost * scale);
  budget.lastConsumeAt = now;
  return { allowed: true, scale, remaining: budget.energy };
}

/** Critically damped approach toward a hold-pressure target with a hard cap. */
export function holdPressureResponse(holdAge: number, cap = 1, rise = 1.55) {
  const raw = 1 - Math.exp(-Math.max(0, holdAge) * rise);
  return Math.min(cap, raw);
}

/** Soft approach strength before glyph contact (pressure-probe onset). */
export function pressureProbeApproach(
  distance: number,
  contactRadius: number,
  approachRadius: number,
) {
  if (distance <= contactRadius) return 1;
  if (distance >= approachRadius || approachRadius <= contactRadius) return 0;
  const t = (distance - contactRadius) / (approachRadius - contactRadius);
  return (1 - t) * (1 - t);
}
