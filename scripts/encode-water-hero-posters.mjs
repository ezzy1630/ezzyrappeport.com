import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const [desktop,mobile,tablet]=process.argv.slice(2);
assert.ok(desktop&&mobile&&tablet,'Usage: node scripts/encode-water-hero-posters.mjs <desktop.png> <mobile.png> <tablet.png>');
for(const [kind,path] of [['desktop',desktop],['mobile',mobile],['tablet',tablet]]){
  const metadata=await sharp(path).metadata();
  assert.ok(metadata.width&&metadata.height);
  const ratio=metadata.width/metadata.height;
  assert.ok(Math.abs(ratio-(kind==='desktop'?16/9:kind==='tablet'?768/1024:390/844))<.01,'Use the documented export viewport');
  await sharp(path).webp({quality:95}).toFile(`public/assets/hero/water-study-${kind}.webp`);
}
const sources=['src/components/water-study/scene.ts','src/components/water-study/optics.ts','src/components/water-study/environment.ts','src/components/water-study/surface.ts','public/assets/hero/playground-glyphs.glb','src/components/water-study/field-texture.ts','src/components/water-study/dynamics.ts','src/components/playground/water-field.ts'];
const hashes={};
for(const path of sources)hashes[path]=createHash('sha256').update(await readFile(path)).digest('hex');
await writeFile('public/assets/hero/water-hero-poster.json',JSON.stringify({viewports:{desktop:[1440,810],mobile:[390,844],tablet:[768,1024]},sources:hashes},null,2)+'\n');
console.log('Encoded matching desktop/mobile/tablet hero posters and source hashes');
