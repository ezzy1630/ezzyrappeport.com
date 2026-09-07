import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveContact } from "../src/components/playground/contact.ts";
import { advanceSpring } from "../src/components/playground/spring.ts";

function simulate(fps) {
  let position = 0.65,
    velocity = 0,
    min = position;
  for (let frame = 0; frame < fps * 3; frame++) {
    ({ position, velocity } = advanceSpring(position, velocity, 0, 1 / fps));
    assert.ok(Number.isFinite(position) && Math.abs(position) <= 0.65);
    min = Math.min(min, position);
  }
  assert.ok(min < 0, "Release should bounce through rest");
  assert.ok(
    Math.abs(position) < 0.0001 && Math.abs(velocity) < 0.001,
    "Release should settle",
  );
  return position;
}
for (const fps of [30, 60, 120]) simulate(fps);
assert.deepEqual(
  advanceSpring(0.4, 0, 0, 10),
  advanceSpring(0.4, 0, 0, 0.05),
  "Background-tab stalls must not explode the spring",
);
assert.deepEqual(
  advanceSpring(0.4, 0, 0.4, 1 / 60),
  { position: 0.4, velocity: 0 },
  "Rest is stable",
);
// Drag stiffness and return damping scale with glyph mass. Every size must settle.
for (const mass of [0.65, 1, 1.5]) {
  let position = 0,
    velocity = 0;
  for (let frame = 0; frame < 60; frame++) {
    ({ position, velocity } = advanceSpring(
      position,
      velocity,
      0.5,
      1 / 60,
      240 / mass,
      28 / Math.sqrt(mass),
    ));
  }
  assert.ok(
    Math.abs(position - 0.5) < 0.002,
    "Dragging must catch up to its target",
  );
  for (let frame = 0; frame < 240; frame++) {
    ({ position, velocity } = advanceSpring(
      position,
      velocity,
      0,
      1 / 60,
      95 / mass,
      12 / Math.sqrt(mass),
    ));
  }
  assert.ok(
    Math.abs(position) < 0.0001 && Math.abs(velocity) < 0.001,
    "Every glyph mass must settle",
  );
}
const bytes = readFileSync(
  new URL("../public/assets/hero/playground-glyphs.glb", import.meta.url),
);
assert.equal(bytes.toString("utf8", 0, 4), "glTF");
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.toString("utf8", 20, 20 + jsonLength).trim());
const nodes = gltf.nodes.filter((node) => node.mesh !== undefined);
assert.equal(nodes.length, 13);
assert.equal(new Set(nodes.map((node) => node.name)).size, 13);
assert.equal(
  nodes.map((node) => node.name.split("_")[1]).join(""),
  "EZZYRAPPEPORT",
);
assert.ok(
  !gltf.extensionsRequired?.includes("EXT_meshopt_compression"),
  "Hero must not wait for a decoder",
);
assert.ok(bytes.length < 900000, "Keep geometry transfer below 900KB");
console.log(
  "PASS spring stability, bounce, settling, frame-stall handling, and 13 independent decoder-free glyphs",
);

function body(x, velocity, mass = 1) {
  return {
    position: { x, y: 0 },
    velocity: { x: velocity, y: 0 },
    mass,
    width: 0.5,
    height: 0.6,
  };
}
const a = body(0, 1, 2),
  b = body(0.4, -0.3);
const momentum = a.mass * a.velocity.x + b.mass * b.velocity.x;
const energy = a.mass * a.velocity.x ** 2 + b.mass * b.velocity.x ** 2;
assert.ok(resolveContact(a, b, 1 / 60) > 0);
assert.ok(
  Math.abs(a.mass * a.velocity.x + b.mass * b.velocity.x - momentum) < 1e-10,
  "Free contact must conserve momentum",
);
assert.ok(
  a.mass * a.velocity.x ** 2 + b.mass * b.velocity.x ** 2 < energy,
  "Contact must dissipate energy",
);
assert.ok(b.position.x - a.position.x > 0.4, "Contact must separate glyphs");
const held = body(0, 1),
  neighbor = body(0.4, 0);
resolveContact(held, neighbor, 1 / 60, held);
assert.equal(held.position.x, 0);
assert.equal(held.velocity.x, 1);
assert.ok(neighbor.velocity.x > 0, "Dragging transfers momentum to a neighbor");
const distant = body(2, 0);
assert.equal(resolveContact(held, distant, 1 / 60), 0);
assert.equal(distant.velocity.x, 0);
console.log(
  "PASS contact momentum, energy loss, separation, held-body response, and non-contact isolation",
);


const { RenderBudget } = await import("../src/components/playground/render-budget.ts");
for (const [mode, frameMs, shouldReduce] of [
  ["active", 1000 / 60, false],
  ["active", 32, true],
  ["idle", 1000 / 30, false],
  ["idle", 55, true],
]) {
  const budget = new RenderBudget();
  for (let frame = 0; frame < 89; frame++) assert.equal(budget.sample(mode, frameMs), false);
  assert.equal(budget.sample(mode, frameMs), shouldReduce, `${mode}: sustained ${frameMs}ms cadence`);
}
const modeBudget = new RenderBudget();
for (let frame = 0; frame < 89; frame++) modeBudget.sample("idle", 55);
assert.equal(modeBudget.sample("active", 1000 / 60), false, "Idle timing must not downgrade fresh interaction");
modeBudget.reset();
assert.equal(modeBudget.sample("idle", 55), false, "Suspended time must not survive a restart");
assert.equal(modeBudget.sample("idle", NaN), false);
console.log("PASS active/idle rendering budgets, mode isolation, and restart reset");

const THREE = await import("three");
const { fitHeroCamera, HERO_CAMERA_DISTANCE } = await import("../src/components/playground/hero-camera.ts");
for (const [width, height] of [[5.1, 2.5], [5.1, 11], [8, 3]]) {
  const camera = new THREE.PerspectiveCamera();
  camera.position.z = HERO_CAMERA_DISTANCE;
  fitHeroCamera(camera, width, height);
  camera.updateMatrixWorld();
  const corner = new THREE.Vector3(width / 2, height / 2, 0).project(camera);
  assert.ok(Math.abs(corner.x - 1) < 1e-10 && Math.abs(corner.y - 1) < 1e-10, "The resting plane must fit the responsive frame");
  camera.position.x = .85;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const target = new THREE.Vector3(.8, .3, .12);
  const screen = target.clone().project(camera);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(screen.x, screen.y), camera);
  const recovered = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -.12), new THREE.Vector3());
  assert.ok(recovered && recovered.distanceTo(target) < 1e-9, "Perspective dragging must recover the touched world position");
}
console.log("PASS responsive perspective framing and drag-plane round trips");

const { createHash } = await import("node:crypto");
const posterManifest = JSON.parse(readFileSync(new URL("../public/assets/hero/playground-poster.json", import.meta.url), "utf8"));
for (const [path, expected] of Object.entries(posterManifest.sources)) {
  const actual = createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex");
  assert.equal(actual, expected, `Poster optics changed: regenerate the matching poster after editing ${path}`);
}
console.log("PASS poster provenance matches current optics and glyph geometry");
