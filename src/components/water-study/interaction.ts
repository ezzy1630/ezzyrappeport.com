import type { WaterField } from '../playground/water-field';

export const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** A distance-sampled stroke stays continuous even when input events arrive far apart. */
export function disturbStroke(field: WaterField, ax: number, ay: number, bx: number, by: number, speed: number) {
  const distance = Math.hypot(bx - ax, by - ay);
  if (distance < .004 || distance > 4) return;
  const count = Math.min(24, Math.max(1, Math.ceil(distance / .10)));
  const strength = Math.min(.20, .045 + speed * .018) * Math.min(1, distance / (.10 * count));
  const nx = -(by - ay) / distance, ny = (bx - ax) / distance;
  for (let i = 1; i <= count; i++) {
    const x = ax + (bx - ax) * i / count, y = ay + (by - ay) * i / count;
    field.disturb(x, y, -strength, .30);
    field.disturb(x + nx * .23, y + ny * .23, strength * .38, .24);
    field.disturb(x - nx * .23, y - ny * .23, strength * .38, .24);
  }
}

/** Input velocity is filtered in seconds; pauses and pointer re-entry never make a fling. */
export class PointerMomentum {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  time = 0;
  private valid = false;
  reset() { this.valid = false; this.vx = this.vy = 0; }
  sample(x: number, y: number, time: number) {
    const dt = (time - this.time) / 1000;
    const continuous = this.valid && dt > 0 && dt < .12 && Math.hypot(x - this.x, y - this.y) < 4;
    if (continuous) {
      const follow = 1 - Math.exp(-dt * 24);
      this.vx += (clamp((x - this.x) / dt, 12) - this.vx) * follow;
      this.vy += (clamp((y - this.y) / dt, 12) - this.vy) * follow;
    } else { this.vx = this.vy = 0; }
    this.x = x; this.y = y; this.time = time; this.valid = true;
    return continuous;
  }
  release(time: number, mass: number) {
    const freshness = Math.exp(-Math.max(0, time - this.time) / 70);
    const scale = freshness * .70 / Math.sqrt(Math.max(.75, mass));
    const x = this.vx * scale, y = this.vy * scale;
    const limit = Math.min(1, 3.5 / Math.max(.001, Math.hypot(x, y)));
    return { x: x * limit, y: y * limit };
  }
}

/** Native scroll contributes one bounded current per presentation, then loses energy. */
export class ScrollCurrent {
  value = 0;
  private pending = 0;
  add(pixels: number, viewport: number) { this.pending += clamp(pixels / Math.max(1, viewport), .35); }
  advance(dt: number) {
    this.value = clamp(this.value + this.pending * 3.5, 1.6);
    this.pending = 0;
    this.value *= Math.exp(-Math.max(0, dt) * 4.5);
    return this.value;
  }
  reset() { this.value = this.pending = 0; }
}

/** A brief depression surrounded by a crest launches a readable expanding ring. */
export function splash(field: WaterField, x: number, y: number, energy = 1) {
  const strength = Math.min(1.5, Math.max(0, energy));
  field.disturb(x, y, -.42 * strength, .30);
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    field.disturb(x + Math.cos(angle) * .38, y + Math.sin(angle) * .38, .075 * strength, .16);
  }
}

/** Increasing resistance retains a little travel even after a long pull. */
export function resistedPull(distance: number, limit: number) {
  return limit * Math.tanh(distance / limit);
}
