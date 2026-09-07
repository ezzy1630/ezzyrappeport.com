import { advanceSpring } from '../playground/spring';
import { clamp, PointerMomentum, resistedPull } from './interaction';
import { projectPresence } from './journey';

type SurfaceSample = { height: number; x: number; y: number; worldX: number; worldY: number; scale: number };
type Spring = { position: number; velocity: number };
const spring = (): Spring => ({ position: 0, velocity: 0 });

/** DOM surfaces and water share the scene's clock and pressure field. No independent animation loop. */
export function createWorldMotion(root: HTMLElement, sample: (x: number, y: number) => SurfaceSample, displace: (x: number, y: number, vx: number, vy: number, dt: number) => void) {
  const surfaces = Array.from(root.querySelectorAll<HTMLElement>('[data-water-surface]')).map((element, index) => ({
    element, index, visual: element.querySelector<HTMLElement>('[data-water-visual]'), visualTransform: '', featured: element.hasAttribute('data-water-featured'), depth: element.dataset.depth === 'far' ? .65 : 1, presence: -1, transform: '', lit: false, moving: false, top: 0, left: 0, width: 0, height: 0, entered: false,
    x: spring(), y: spring(), rx: spring(), ry: spring(), waterHeight: 0, waterX: 0, waterY: 0, wakeFor: 0,
  }));
  type Surface = (typeof surfaces)[number];
  let drag: {item: Surface; id: number; x: number; y: number; dx: number; dy: number; active: boolean} | null = null;
  const momentum = new PointerMomentum();
  let suppressedUntil = 0;
  const suppressClick = (event: MouseEvent) => {
    if (performance.now() < suppressedUntil) { event.preventDefault(); event.stopPropagation(); suppressedUntil = 0; }
  };
  const preventNativeDrag = (event: DragEvent) => {
    if (active && event.target instanceof Element && event.target.closest('[data-water-surface]')) event.preventDefault();
  };
  const newPress = () => { suppressedUntil = 0; };
  root.addEventListener('pointerdown',newPress,true);
  root.addEventListener('click', suppressClick, true);
  root.addEventListener('dragstart', preventNativeDrag);
  const release = (throwSurface: boolean) => {
    if (!drag) return;
    const previous = drag; drag = null;
    if (previous.active) {
      const velocity = throwSurface ? momentum.release(performance.now(), 1.4) : {x: 0, y: 0};
      previous.item.x.velocity = velocity.x * 42;
      previous.item.y.velocity = velocity.y * 42;
      previous.item.wakeFor = throwSurface ? .8 : 0;
      if (throwSurface) suppressedUntil = performance.now() + 350;
      if (root.hasPointerCapture(previous.id)) root.releasePointerCapture(previous.id);
    }
    momentum.reset(); delete root.dataset.surfaceDragging;
  };
  let dirty = true;
  let active = true;
  let hovered: HTMLElement | null = null;
  let pointerX = -1000, pointerY = -1000;
  const reveals = new Set<Animation>();
  const observer = new ResizeObserver(() => { dirty = true; });
  observer.observe(root);
  const measure = () => {
    // Clear transforms together before a single batch of layout reads.
    for (const item of surfaces) {item.element.style.transform = 'none';item.transform='';if(item.visual)item.visual.style.transform='none';item.visualTransform='';}
    for (const item of surfaces) {
      const bounds = item.element.getBoundingClientRect();
      item.top = bounds.top + scrollY; item.left = bounds.left;
      item.width = bounds.width; item.height = bounds.height;
    }
    dirty = false;
  };
  const clear = () => {
    for (const animation of reveals) animation.cancel();
    reveals.clear();
    hovered = null; release(false);
    for (const item of surfaces) {
      item.element.style.removeProperty('transform');
      item.visual?.style.removeProperty('transform');item.visualTransform='';
      item.element.style.removeProperty('will-change');
      item.element.style.removeProperty('--project-presence');item.presence=-1;item.transform='';item.lit=false;item.moving=false;
      delete item.element.dataset.waterLit;
      item.waterHeight = item.waterX = item.waterY = item.wakeFor = 0;
      for (const value of [item.x, item.y, item.rx, item.ry]) value.position = value.velocity = 0;
    }
  };
  return {
    down(event: PointerEvent) {
      if (!active || event.pointerType === 'touch') return;
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-water-surface]') : null;
      const item = surfaces.find(item => item.element === element);
      if (!item) return;
      drag = {item, id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, active: false};
      momentum.reset(); momentum.sample(event.clientX / 100, event.clientY / 100, performance.now());
    },
    up(event: PointerEvent) { if (event.pointerId === drag?.id) release(true); },
    cancel() { release(false); },
    pointer(event: PointerEvent) {
      if (event.pointerType === 'touch') return false;
      if (drag && !(event.buttons & 1)) release(false);
      if (drag && event.pointerId === drag.id) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (!drag.active && Math.hypot(dx,dy) > 7) {
          drag.active = true; root.setPointerCapture(event.pointerId); root.dataset.surfaceDragging = 'true';
        }
        drag.dx = resistedPull(dx,72); drag.dy = resistedPull(dy,56);
        momentum.sample(event.clientX / 100, event.clientY / 100, performance.now());
      }
      pointerX = event.clientX; pointerY = event.clientY;
      hovered = drag?.active ? drag.item.element : event.target instanceof Element ? event.target.closest<HTMLElement>('[data-water-surface]') : null;
      return drag?.active ?? false;
    },
    leave() { if (!drag?.active) release(false); hovered = null; pointerX = pointerY = -1000; },
    setActive(value: boolean) { active = value; if (!value) clear(); },
    update(dt: number, _time: number, current: number) {
      if (!active) return 0;
      if (dirty) measure();
      const scroll = scrollY, viewportHeight = innerHeight;
      let focus=0;
      for (const item of surfaces) {
        const top = item.top - scroll;
        const visible = top < viewportHeight + 60 && top + item.height > -60;
        if (item.featured) {
          const presence=projectPresence(top,item.height,viewportHeight);
          focus=Math.max(focus,presence);
          const quantized=Math.round(presence*100)/100;
          if(quantized!==item.presence){item.element.style.setProperty('--project-presence',String(quantized));item.presence=quantized;}
        }
        if (!visible) { if(item.moving){item.element.style.removeProperty('will-change');item.moving=false;} continue; }
        if (!item.entered) {
          item.entered = true;
          // Fade only: entrance transforms must not replace the authored icon centering.
          const visual = item.element.querySelector('img');
          if (visual) {
            const animation = visual.animate([{ opacity: .25 }, { opacity: 1 }], {
              duration: item.featured ? 1000 : 650, easing: 'cubic-bezier(.16,1,.3,1)',
            });
            reveals.add(animation); animation.onfinish = () => reveals.delete(animation);
          }
        }
        const centerX = item.left + item.width / 2, centerY = top + item.height / 2;
        const water = sample(centerX, centerY);
        const follow=1-Math.exp(-dt*4);
        item.waterHeight+=(water.height-item.waterHeight)*follow;
        item.waterX+=(water.x-item.waterX)*follow;
        item.waterY+=(water.y-item.waterY)*follow;
        const over = hovered === item.element;
        const px = over ? clamp((pointerX - centerX) / (item.width / 2), 1) : 0;
        const py = over ? clamp((pointerY - centerY) / (item.height / 2), 1) : 0;
        const mass = Math.max(.8, Math.min(2.5, item.width * item.height / 160000));
        const targets = [
          (drag?.active && drag.item === item ? drag.dx : px * 3) + clamp(item.waterX * 12, 1.5),
          (drag?.active && drag.item === item ? drag.dy : over ? -4 : 0) + clamp(item.waterHeight * 60, 2) * item.depth + current * 5 * item.depth,
          -py * 1.6 + clamp(item.waterY * 4, .45) + current * .4,
          px * 1.8 - clamp(item.waterX * 4, .45),
        ];
        const states = [item.x, item.y, item.rx, item.ry];
        for (let i = 0; i < states.length; i++) {
          const value = advanceSpring(states[i].position, states[i].velocity, targets[i], dt, (drag?.active && drag.item === item ? 700 : 140) / mass, (drag?.active && drag.item === item ? 53 : 24) / Math.sqrt(mass));
          states[i].position = value.position; states[i].velocity = value.velocity;
        }
        item.wakeFor=Math.max(0,item.wakeFor-dt);
        if ((drag?.active && drag.item === item || item.wakeFor > 0) && Math.hypot(item.x.velocity, item.y.velocity) > 12) {
          displace(water.worldX, water.worldY, item.x.velocity * water.scale, -item.y.velocity * water.scale, dt);
        }
        const atRest=states.every(state=>Math.abs(state.position)<.02 && Math.abs(state.velocity)<.02);
        const translation=`translate3d(${item.x.position.toFixed(2)}px,${item.y.position.toFixed(2)}px,0)`;
        const tilt=`perspective(1100px) rotateX(${item.rx.position.toFixed(2)}deg) rotateY(${item.ry.position.toFixed(2)}deg)`;
        const transform=atRest?'none':item.visual?translation:`${translation} ${tilt}`;
        if(item.visual){
          const visualTransform=atRest?'none':tilt;
          if(visualTransform!==item.visualTransform){item.visual.style.transform=visualTransform;item.visualTransform=visualTransform;}
        }
        if(transform!==item.transform){item.element.style.transform=transform;item.transform=transform;}
        if(over!==item.lit){item.element.dataset.waterLit=String(over);item.lit=over;}
        const moving=states.some(state=>Math.abs(state.velocity)>.05);
        if(moving!==item.moving){if(moving)item.element.style.willChange='transform';else item.element.style.removeProperty('will-change');item.moving=moving;}
        if (over) {
          item.element.style.setProperty('--light-x', `${((px + 1) * 50).toFixed(1)}%`);
          item.element.style.setProperty('--light-y', `${((py + 1) * 50).toFixed(1)}%`);
        }
      }
      return focus;
    },
    reset() { clear(); dirty = true; },
    dispose() { observer.disconnect(); clear(); root.removeEventListener('pointerdown',newPress,true); root.removeEventListener('click',suppressClick,true); root.removeEventListener('dragstart',preventNativeDrag); },
  };
}
