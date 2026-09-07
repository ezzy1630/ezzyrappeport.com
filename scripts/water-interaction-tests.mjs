import assert from 'node:assert/strict';
import { PointerMomentum, ScrollCurrent, disturbStroke } from '../src/components/water-study/interaction.ts';
import { WaterField } from '../src/components/playground/water-field.ts';
import { advanceSpring } from '../src/components/playground/spring.ts';

function gesture(hz) {
  const pointer = new PointerMomentum();
  for (let i = 0; i <= hz / 2; i++) pointer.sample(i / hz * 4, 0, i / hz * 1000);
  return pointer;
}
const low = gesture(30), high = gesture(120);
assert.ok(Math.abs(low.vx - high.vx) < .02, 'Throw velocity does not depend on event frequency');
assert.ok(low.release(500, 1).x > 2.5, 'A fast gesture transfers momentum');
assert.ok(low.release(500, 4).x < low.release(500, 1).x, 'Mass reduces throwing speed');
assert.ok(low.release(1000, 1).x < .01, 'Holding still before release does not throw');
low.reset();
assert.equal(low.release(500, 1).x, 0, 'Cancellation clears momentum');
low.sample(30, 30, 2000);
assert.equal(low.vx, 0, 'Re-entry at another location does not create a throw');
for (const mass of [.75, 1, 3]) {
  let x = 1.5, velocity = high.release(500, mass).x;
  for (let i = 0; i < 1800; i++) {
    const next = advanceSpring(x, velocity, 0, 1 / 120, 9 / mass, 4.8 / Math.sqrt(mass));
    x = next.position; velocity = next.velocity;
    assert.ok(Number.isFinite(x) && Math.abs(x) < 4, 'Thrown letters remain bounded');
  }
  assert.ok(Math.abs(x) < .002, 'Thrown letters settle');
}
console.log('PASS event-rate independent throws, mass, cancellation, stale input, bounded release and settling');

const flow = new ScrollCurrent();
flow.add(10000, 800);
assert.ok(flow.advance(1 / 60) < 1.6, 'Programmatic scroll jumps are bounded');
for (let i = 0; i < 240; i++) flow.advance(1 / 60);
assert.ok(flow.value < 1e-6, 'Scroll energy decays');
flow.add(-100, 800); assert.ok(flow.advance(1 / 60) < 0, 'Scroll direction is preserved');
flow.reset(); assert.equal(flow.value, 0, 'Pausing cancels scroll current');
console.log('PASS scroll-current bounds, direction, decay and reset');

function stroke(hz) {
  const field = new WaterField(192, 256, false, 1.8);
  field.resize(18, 24);
  for (let i = 1; i <= hz; i++) {
    const previous = -2 + (i - 1) / hz * 4, next = -2 + i / hz * 4;
    disturbStroke(field, previous, 0, next, 0, 4);
    field.advance(1 / hz);
  }
  return field;
}
const coarse = stroke(30), fine = stroke(120);
let difference = 0, amplitude = 0;
for (let i = 0; i < coarse.height.length; i++) {
  difference += Math.abs(coarse.height[i] - fine.height[i]);
  amplitude += Math.abs(fine.height[i]);
}
assert.ok(difference / amplitude < .18, 'Distance-sampled wakes remain consistent across event rates');
assert.ok(amplitude > .1, 'The cursor leaves a visible traveling wake');
for (let i = 0; i < 1200; i++) {
  if (i < 120) disturbStroke(fine, -2, 0, 2, 0, 12);
  fine.advance(1 / 120);
  assert.ok(fine.height.every(value => Number.isFinite(value) && Math.abs(value) <= .081), 'Fast repeated strokes stay stable');
}
fine.advance(.05);
assert.ok(Math.max(...fine.height.map(Math.abs)) < .003, 'Wakes settle after input ends');
console.log('PASS continuous wakes, 30/120Hz input, accelerated water stability, repeated impacts and settling');

const { splash, resistedPull } = await import('../src/components/water-study/interaction.ts');
const { WaterQuality } = await import('../src/components/water-study/quality.ts');
const { addBodyWake } = await import('../src/components/water-study/dynamics.ts');
const ring=new WaterField(192,256,false,1.8);ring.resize(18,24);splash(ring,0,0);ring.advance(.025);
assert.ok(ring.sample(0,0)<0 && ring.sample(.38,0)>0,'Splash starts with a depression and surrounding crest');
let remotePeak=0;
for(let i=0;i<240;i++){ring.advance(1/120);remotePeak=Math.max(remotePeak,Math.abs(ring.sample(1,0)));}
assert.ok(remotePeak>.0001,'Click pressure propagates beyond its initial footprint');
const bodyWater=new WaterField(192,256,false,1.8);bodyWater.resize(18,24);
for(let i=0;i<90;i++){addBodyWake(bodyWater,i/90,0,1,0,1.2,1/60);bodyWater.advance(1/60);}
assert.ok(bodyWater.height.every(Number.isFinite),'Moving bodies produce stable displaced water');
assert.ok(bodyWater.sample(.8,.36)>0,'A moving body pushes water outward at its shoulders');
assert.ok(resistedPull(500,72)<72 && resistedPull(100,72)<100,'Long pulls resist increasing distance');
assert.ok(resistedPull(101,72)>resistedPull(100,72),'Resistance never hard-clips the drag');
assert.equal(resistedPull(-40,72),-resistedPull(40,72),'Drag resistance is symmetric');
const quality=new WaterQuality();
for(let i=0;i<600;i++)quality.sample('active',33.3);
assert.equal(quality.scale,.65,'Persistent slow frames reach the bounded quality floor');
quality.resetSamples();assert.equal(quality.scale,.65,'Resize and resume preserve quality');
for(let i=0;i<900;i++)quality.sample('idle',33.3);
assert.equal(quality.scale,.65,'Idle cadence cannot prove active rendering headroom');
for(let i=0;i<1800;i++)quality.sample('active',16.67);
assert.ok(quality.scale>.65 && quality.scale<1,'Healthy active frames recover gradually');
const beforeStall=quality.scale;quality.sample('active',5000);
assert.equal(quality.scale,beforeStall,'A hidden-tab-size stall cannot lower quality');
console.log('PASS expanding splash, body displacement, smooth drag resistance and adaptive quality degradation/recovery');

const severe=new WaterQuality();
for(let i=0;i<240;i++)severe.sample('active',260);
assert.equal(severe.scale,.65,'Sustained very slow rendering still reduces quality');

const { journeyState, projectPresence } = await import('../src/components/water-study/journey.ts');
assert.equal(journeyState(0,800,6200,800).depth,0,'Opening starts at the bright surface');
assert.equal(journeyState(2400,800,6200,800).depth,1,'Work reaches full atmospheric depth');
assert.ok(journeyState(6200,800,6200,800).depth<.05,'Contact returns to light');
for(let scroll=0;scroll<7000;scroll+=13){
 const current=journeyState(scroll,800,6200,800),next=journeyState(scroll+1,800,6200,800);
 assert.ok(current.depth>=0&&current.depth<=1,'Journey depth remains bounded');
 assert.ok(Math.abs(next.depth-current.depth)<.003,'Atmosphere stays continuous across landmarks');
}
assert.equal(projectPresence(100,600,800),1,'A centered project is the focal point');
assert.equal(projectPresence(1800,600,800),0,'An offscreen project cannot dim the atmosphere');
console.log('PASS scroll journey, bright return, continuous depth and project focus');

const { PresentationClock } = await import('../src/components/water-study/presentation.ts');
for(const refresh of [60,75,90,120,144,165]){
 const clock=new PresentationClock();let active=0;
 for(let tick=0;tick<refresh*10;tick++)if(clock.due(tick*1000/refresh,'active'))active++;
 assert.ok(Math.abs(active-600)<=1,`${refresh} Hz preserves 60 presentations without cumulative timing loss`);
 clock.reset();let idle=0;
 for(let tick=0;tick<refresh*10;tick++)if(clock.due(tick*1000/refresh,'idle'))idle++;
 assert.ok(Math.abs(idle-600)<=1,`${refresh} Hz keeps ambient water at the same smooth cadence`);
 assert.equal(clock.due(60000,'active'),true,'Resume presents immediately');
 assert.equal(clock.due(60001,'active'),false,'Resume never bursts to repay missed frames');
}
console.log('PASS 60/75/90/120/144/165 Hz pacing, idle cadence and suspension without catch-up bursts');
