export type RenderMode = "active" | "idle";

/** Compare real frame intervals with each mode's own cadence, not capped physics dt. */
export class RenderBudget {
  private mode: RenderMode | undefined;
  private frames = 0;
  private elapsed = 0;

  sample(mode: RenderMode, frameMs: number): boolean {
    if (mode !== this.mode) {
      this.reset();
      this.mode = mode;
    }
    if (!Number.isFinite(frameMs) || frameMs <= 0) return false;
    this.frames++;
    this.elapsed += frameMs;
    if (this.frames < 90) return false;
    const overloaded = this.elapsed / this.frames > (mode === "active" ? 24 : 44);
    this.frames = 0;
    this.elapsed = 0;
    return overloaded;
  }

  reset() {
    this.mode = undefined;
    this.frames = 0;
    this.elapsed = 0;
  }
}
