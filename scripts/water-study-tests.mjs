import assert from 'node:assert/strict';
import { refractDirection, surfaceHeight } from '../src/components/water-study/surface.ts';
import { WaterField } from '../src/components/playground/water-field.ts';
const normal=[0,0,1];
const direct=refractDirection([0,0,-1],normal);
assert.deepEqual(direct,[0,0,-1]);
for(const angle of [.1,.4,.8,1.2]){
  const outgoing=refractDirection([Math.sin(angle),0,-Math.cos(angle)],normal);
  assert.ok(Math.abs(Math.hypot(...outgoing)-1)<1e-12);
  assert.ok(Math.abs(outgoing[0]*1.333-Math.sin(angle))<1e-12,'Snell law');
  assert.ok(outgoing[2]<0,'Ray continues into water');
}
assert.equal(refractDirection([.9,0,-Math.sqrt(1-.81)],normal,1.5),null,'Total internal reflection');
const field=new WaterField();
const before=surfaceHeight(field,0,0,0);
field.disturb(0,0,-.3,.3);field.advance(.04);
assert.ok(surfaceHeight(field,0,0,0)<before,'Pressure changes the optical surface');
field.reset();assert.equal(surfaceHeight(field,0,0,0),before);
console.log('PASS refraction direction, Snell law, total internal reflection, optical pressure and reset');

const {waveResponse,addWake}=await import('../src/components/water-study/dynamics.ts');
const {advanceSpring}=await import('../src/components/playground/spring.ts');
function rideWave(mass){
 const water=new WaterField(192,256);water.resize(18,24);water.disturb(0,0,-.45,.42);
 let x=.65,velocity=0,peak=0,first=null;
 for(let i=0;i<1200;i++){
  const dt=1/120;water.advance(dt);
  const response=waveResponse(water,x,0,mass);
  velocity+=response.ax*dt;
  const next=advanceSpring(x,velocity,.65,dt,7/mass,4.2/Math.sqrt(mass));
  x=next.position;velocity=next.velocity;addWake(water,x,0,velocity,0,dt);
  peak=Math.max(peak,Math.abs(x-.65));
  if(first===null&&Math.abs(x-.65)>.002)first=i/120;
  assert.ok(Number.isFinite(x)&&Math.abs(x-.65)<.3,'Coupled response stays bounded');
 }
 return {peak,first,rest:Math.abs(x-.65)};
}
const reaction=rideWave(1);
assert.ok(reaction.first>.15,'A remote letter waits for the wave to arrive');
assert.ok(reaction.peak>.03,'The arriving wave produces visible displacement');
assert.ok(reaction.rest<.005,'Wave-driven motion settles back to rest');
assert.ok(rideWave(2).peak<reaction.peak,'More massive letters respond less');
console.log('PASS delayed wave-to-letter response, mass weighting, coupled wake bounds, and settling');

const {encodeOpticalField}=await import('../src/components/water-study/field-texture.ts');
const {DataUtils}=await import('three');
const precise=new WaterField(32,32,false),legacy=new WaterField(32,32);
for(const water of [precise,legacy]){water.resize(5.1,3);water.disturb(0,0,-.015,.6);water.advance(.025);}
assert.deepEqual(precise.height,legacy.height,'Skipping legacy byte encoding preserves simulation');
const pixels=new Uint16Array(32*32*4);encodeOpticalField(precise,5.1,3,pixels);
let maximumError=0,nonzero=0;
for(let i=0;i<precise.height.length;i++){
 const value=DataUtils.fromHalfFloat(pixels[i*4]);
 maximumError=Math.max(maximumError,Math.abs(value-precise.height[i]*2.2));
 if(value!==0)nonzero++;
}
assert.ok(nonzero>0,'Small optical waves survive encoding');
assert.ok(maximumError<1e-5,'Half-float upload preserves sub-pixel wave heights');
console.log('PASS high-precision optical upload and unchanged simulation without byte encoding');

const {readFile}=await import('node:fs/promises');
const {createHash}=await import('node:crypto');
const poster=JSON.parse(await readFile(new URL('../public/assets/hero/water-hero-poster.json',import.meta.url),'utf8'));
for(const [path,expected] of Object.entries(poster.sources)){
 const actual=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
 assert.equal(actual,expected,'Re-export water hero posters after changing '+path);
}
console.log('PASS current homepage posters match their optical sources');
