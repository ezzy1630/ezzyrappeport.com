import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import * as THREE from "three";
import { fitHeroCamera, HERO_CAMERA_DISTANCE } from "../src/components/playground/hero-camera.ts";

const [source, desktopSource, mobileSource] = process.argv.slice(2);
assert.ok(source && desktopSource && mobileSource, "Usage: node scripts/encode-hero-poster.mjs <title.png> <water-desktop.png> <water-mobile.png>");
const input = sharp(source);
const metadata = await input.metadata();
assert.equal(metadata.width, 1600, "Export at the canonical 1600 × 780 size");
assert.equal(metadata.height, 780);
assert.ok(metadata.hasAlpha, "The background must remain transparent");
const alpha = await input.clone().extractChannel("alpha").raw().toBuffer();
let minX = 1600, minY = 780, maxX = -1, maxY = -1;
for (let y = 0; y < 780; y++) {
  for (let x = 0; x < 1600; x++) {
    if (alpha[y * 1600 + x] < 128) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
// Validate the actual projected vertices, rather than an orthographic pixel constant.
const glb = await readFile(new URL("../public/assets/hero/playground-glyphs.glb", import.meta.url));
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.toString("utf8", 20, 20 + jsonLength));
const binaryOffset = 20 + jsonLength + 8;
const camera = new THREE.PerspectiveCamera();
camera.position.z = HERO_CAMERA_DISTANCE;
fitHeroCamera(camera, 5.1, 5.1 * 780 / 1600);
camera.updateMatrixWorld();
const projected = new THREE.Box2();
const vertex = new THREE.Vector3();
function visit(index, parent) {
  const node = gltf.nodes[index];
  const local = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
    new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
    new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
    new THREE.Vector3(...(node.scale ?? [1, 1, 1])),
  );
  const world = parent.clone().multiply(local);
  if (node.mesh !== undefined) {
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      assert.equal(accessor.componentType, 5126);
      assert.equal(accessor.type, "VEC3");
      const view = gltf.bufferViews[accessor.bufferView];
      const offset = binaryOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
      for (let i = 0; i < accessor.count; i++) {
        const at = offset + i * (view.byteStride ?? 12);
        vertex.set(glb.readFloatLE(at), glb.readFloatLE(at + 4), glb.readFloatLE(at + 8)).applyMatrix4(world).project(camera);
        projected.expandByPoint(new THREE.Vector2((vertex.x + 1) * 800, (1 - vertex.y) * 390));
      }
    }
  }
  for (const child of node.children ?? []) visit(child, world);
}
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new THREE.Matrix4());
for (const [actual, expected] of [[minX, projected.min.x], [minY, projected.min.y], [maxX, projected.max.x], [maxY, projected.max.y]]) {
  assert.ok(Math.abs(actual - expected) < 8, `Poster bound ${actual} must match projected geometry ${expected}`);
}
for (const [path, name, width, height] of [[desktopSource, "desktop", 1600, 900], [mobileSource, "mobile", 780, 1688]]) {
  const water = sharp(path);
  const info = await water.metadata();
  assert.equal(info.width, width);
  assert.equal(info.height, height);
  if (info.hasAlpha) assert.equal((await water.stats()).channels[3].min, 255, "Water plate must cover every pixel");
  await water.removeAlpha().webp({ quality: 92, effort: 6 }).toFile(new URL(`../public/assets/hero/playground-water-${name}.webp`, import.meta.url).pathname);
}
const output = new URL("../public/assets/hero/playground-title.webp", import.meta.url);
await input.webp({ quality: 94, alphaQuality: 100, effort: 6 }).toFile(output.pathname);
const sources = {};
for (const path of [
  "src/components/playground/glass-material.ts",
  "src/components/playground/glass-scene.ts",
  "src/components/playground/hero-camera.ts",
  "src/components/playground/water-canopy.ts",
  "public/assets/water/shallow-desktop-v1.webp",
  "src/components/playground/glass-contact.ts",
  "src/components/playground/glass-studio.ts",
  "src/components/playground/water-shader.ts",
  "public/assets/hero/playground-glyphs.glb",
]) {
  const bytes = await readFile(new URL(`../${path}`, import.meta.url));
  sources[path] = createHash("sha256").update(bytes).digest("hex");
}
const bytes = await readFile(output);
await writeFile(new URL("../public/assets/hero/playground-poster.json", import.meta.url), JSON.stringify({
  renderer: "Three.js live hero at rest",
  width: 1600, height: 780, worldWidth: 5.1, cameraDistance: HERO_CAMERA_DISTANCE,
  alphaBounds: { minX, minY, maxX, maxY },
  bytes: bytes.length,
  sources,
}, null, 2) + "\n");
console.log(`Saved matching ${bytes.length}-byte poster with verified alpha bounds.`);
