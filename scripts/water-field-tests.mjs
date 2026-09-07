import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { WaterField } from "../src/components/playground/water-field.ts";
function energy(field) {
  return field.height.reduce((sum, h) => sum + h * h, 0);
}
function run(fps) {
  const water = new WaterField();
  water.disturb(0, 0, -0.25);
  for (let n = 0; n < fps; n++) water.advance(1 / fps);
  return water;
}
const low = run(30),
  high = run(120);
for (let i = 0; i < low.height.length; i++)
  assert.ok(
    Math.abs(low.height[i] - high.height[i]) < 1e-6,
    "Wave propagation must be independent of render rate",
  );
assert.ok(
  Math.abs(high.sample(0.45, 0)) > 1e-5,
  "A local impact must propagate to neighboring letters",
);
const initial = energy(high);
for (let n = 0; n < 120 * 9; n++) high.advance(1 / 120);
assert.ok(
  energy(high) < initial * 0.03,
  "Waves should dissipate instead of accumulating energy",
);
assert.equal(
  high.advance(1 / 60),
  false,
  "Settled water must stop texture uploads",
);
const untouched = new WaterField();
assert.equal(untouched.advance(1 / 60), false);
untouched.disturb(100, 100, -1);
assert.equal(
  untouched.advance(1 / 60),
  false,
  "Outside input must not wake the solver",
);
const stalled = new WaterField(),
  bounded = new WaterField();
for (const field of [stalled, bounded]) field.disturb(0.5, -0.3, -0.2);
stalled.advance(10);
bounded.advance(0.05);
assert.deepEqual(
  stalled.height,
  bounded.height,
  "A tab stall must not accrue simulation debt",
);
const before = performance.now();
const stressed = new WaterField();
stressed.resize(5.1, 1.2);
for (let n = 0; n < 600; n++) {
  stressed.disturb(Math.sin(n) * 2, Math.cos(n) * 0.5, -1);
  stressed.advance(1 / 60);
}
assert.ok(
  [...stressed.height].every((h) => Number.isFinite(h) && Math.abs(h) <= 0.08),
);
assert.ok([...stressed.pixels].every((v) => v >= 0 && v <= 255));
stressed.reset();
assert.equal(energy(stressed), 0);
assert.equal(stressed.sample(0, 0), 0);
console.log(
  `PASS propagation, damping, 30/120Hz equivalence, bounded repeated impacts, reset. Stress simulation ${(performance.now() - before).toFixed(0)}ms / 600 frames (CPU only).`,
);
