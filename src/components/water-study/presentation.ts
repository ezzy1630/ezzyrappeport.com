import type { RenderMode } from '../playground/render-budget';

/** Preserve fractional deadlines on displays whose refresh rate is not a multiple of 60. */
export class PresentationClock {
  private next = 0;
  private mode: RenderMode | undefined;
  due(now: number, mode: RenderMode) {
    const interval = 1000 / 60;
    if (mode !== this.mode || now - this.next > interval * 3) {
      this.mode = mode; this.next = now;
    }
    if (now + .5 < this.next) return false;
    this.next += interval;
    return true;
  }
  reset() { this.next = 0; this.mode = undefined; }
}
