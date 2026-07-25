/**
 * Allocation-free frame-time sampling for adaptive quality.
 * Salvaged from rejected observatory-frame-stats; observatory knobs removed.
 */

export const FRAME_SAMPLE_CAPACITY = 24;
export const FRAME_EVAL_MIN_SAMPLES = 8;
/** Evaluate p95 at most once per this many pushes after the buffer is warm. */
export const FRAME_EVAL_CADENCE = 8;

export type FrameSamplePushResult = {
  evaluated: boolean;
  /** Meaningful only when evaluated is true. */
  p95: number;
  sampleCount: number;
};

/**
 * Preallocated ring of frame durations. push() never allocates.
 * Percentile uses an in-place sort on a fixed scratch buffer.
 */
export class FrameMsRingBuffer {
  private readonly samples: Float64Array;
  private readonly scratch: Float64Array;
  private readonly result: FrameSamplePushResult = {
    evaluated: false,
    p95: 0,
    sampleCount: 0,
  };
  private writeIndex = 0;
  private count = 0;
  private framesSinceEval = 0;

  constructor(capacity = FRAME_SAMPLE_CAPACITY) {
    const size = Math.max(4, capacity | 0);
    this.samples = new Float64Array(size);
    this.scratch = new Float64Array(size);
  }

  get capacity(): number {
    return this.samples.length;
  }

  get sampleCount(): number {
    return this.count;
  }

  reset(): void {
    this.writeIndex = 0;
    this.count = 0;
    this.framesSinceEval = 0;
  }

  push(frameMs: number): FrameSamplePushResult {
    const value = Number.isFinite(frameMs) ? frameMs : 0;
    this.samples[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.samples.length;
    if (this.count < this.samples.length) this.count += 1;
    this.framesSinceEval += 1;

    if (
      this.count < FRAME_EVAL_MIN_SAMPLES
      || this.framesSinceEval < FRAME_EVAL_CADENCE
    ) {
      this.result.evaluated = false;
      this.result.p95 = 0;
      this.result.sampleCount = this.count;
      return this.result;
    }

    this.framesSinceEval = 0;
    this.result.evaluated = true;
    this.result.p95 = this.percentileInPlace(0.95);
    this.result.sampleCount = this.count;
    return this.result;
  }

  /** Copy ring contents into scratch and sort scratch[0..count) in place. */
  private percentileInPlace(fraction: number): number {
    const n = this.count;
    for (let i = 0; i < n; i += 1) {
      this.scratch[i] = this.samples[i];
    }
    // Insertion sort — n is tiny and allocation-free.
    for (let i = 1; i < n; i += 1) {
      const key = this.scratch[i];
      let j = i - 1;
      while (j >= 0 && this.scratch[j] > key) {
        this.scratch[j + 1] = this.scratch[j];
        j -= 1;
      }
      this.scratch[j + 1] = key;
    }
    const index = Math.min(n - 1, Math.max(0, Math.ceil(fraction * n) - 1));
    return this.scratch[index];
  }
}
