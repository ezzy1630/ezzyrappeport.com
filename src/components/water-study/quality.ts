import type { RenderMode } from '../playground/render-budget';

/** Presentation feedback, with slow recovery probes and no synchronous GPU readback. */
export class WaterQuality {
  scale = 1;
  private mode: RenderMode | undefined;
  private elapsed = 0;
  private frames = 0;
  private stable = 0;
  private cooldown = 0;
  private slowRun = 0;
  sample(mode: RenderMode, milliseconds: number) {
    if (mode !== this.mode) { this.resetSamples(); this.mode = mode; return false; }
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) { this.resetSamples(); return false; }
    if (milliseconds > 250) {
      this.slowRun++;
      if (this.slowRun < 3) { this.elapsed = this.frames = this.stable = 0; return false; }
      milliseconds = 250;
    } else this.slowRun = 0;
    this.cooldown = Math.max(0, this.cooldown - milliseconds);
    this.elapsed += milliseconds; this.frames++;
    if (this.elapsed < 1800) return false;
    const mean = this.elapsed / this.frames;
    const overloaded = mean > 23;
    const healthy = mean < 18.5;
    this.stable = healthy ? this.stable + this.elapsed : 0;
    this.elapsed = this.frames = 0;
    if (this.cooldown > 0) return false;
    if (overloaded && this.scale > .65) {
      this.scale = Math.max(.65, Math.round((this.scale - .1) * 100) / 100);
      this.cooldown = 3000; this.stable = 0; return true;
    }
    // Quiet-scene measurements cannot establish headroom for interaction and physics.
    if (mode === 'active' && this.stable >= 12000 && this.scale < 1) {
      this.scale = Math.min(1, Math.round((this.scale + .05) * 100) / 100);
      this.cooldown = 6000; this.stable = 0; return true;
    }
    return false;
  }
  resetSamples() { this.elapsed = this.frames = this.stable = this.slowRun = 0; this.mode = undefined; }
}
