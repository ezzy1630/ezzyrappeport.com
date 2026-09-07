/** Damped shallow surface waves in world units. One field drives optics and buoyancy. */
export class WaterField {
  readonly columns: number;
  readonly rows: number;
  readonly height: Float32Array;
  private readonly velocity: Float32Array;
  private readonly next: Float32Array;
  readonly pixels: Uint8Array;
  private readonly encodePixels: boolean;
  private readonly waveSpeed: number;
  private debt = 0;
  private activeFor = 0;
  private dx = 1;
  private dy = 1;
  private width = 5.1;
  private depth = 3;

  constructor(columns = 96, rows = 80, encodePixels = true, waveSpeed = .9) {
    this.encodePixels = encodePixels;
    this.waveSpeed = waveSpeed;
    this.columns = columns;
    this.rows = rows;
    this.height = new Float32Array(columns * rows);
    this.velocity = new Float32Array(columns * rows);
    this.next = new Float32Array(columns * rows);
    this.pixels = new Uint8Array(columns * rows * 4);
    this.resize(5.1, 3);
    this.encode();
  }

  resize(width: number, depth: number) {
    this.width = width;
    this.depth = depth;
    this.dx = width / (this.columns - 1);
    this.dy = depth / (this.rows - 1);
    this.reset();
  }

  reset() {
    this.height.fill(0);
    this.velocity.fill(0);
    this.debt = 0;
    this.activeFor = 0;
    this.encode();
  }

  /** Localized pressure, bounded even during dense pointer input. */
  disturb(x: number, y: number, strength: number, radius = 0.16) {
    if (
      Math.abs(x) > this.width / 2 + radius ||
      Math.abs(y) > this.depth / 2 + radius ||
      Math.abs(strength) < 1e-5
    )
      return;
    this.activeFor = 9;
    const cx = (x / this.width + 0.5) * (this.columns - 1);
    const cy = (y / this.depth + 0.5) * (this.rows - 1);
    const rx = Math.ceil(radius / this.dx);
    const ry = Math.ceil(radius / this.dy);
    for (
      let row = Math.max(1, Math.floor(cy) - ry);
      row <= Math.min(this.rows - 2, Math.ceil(cy) + ry);
      row++
    ) {
      for (
        let col = Math.max(1, Math.floor(cx) - rx);
        col <= Math.min(this.columns - 2, Math.ceil(cx) + rx);
        col++
      ) {
        const distance =
          Math.hypot((col - cx) * this.dx, (row - cy) * this.dy) / radius;
        if (distance >= 1) continue;
        const weight = (1 - distance * distance) ** 2;
        const index = row * this.columns + col;
        this.velocity[index] = Math.max(
          -0.45,
          Math.min(0.45, this.velocity[index] + strength * weight),
        );
      }
    }
  }

  sample(x: number, y: number) {
    const gx = Math.max(
      0,
      Math.min(
        this.columns - 1.001,
        (x / this.width + 0.5) * (this.columns - 1),
      ),
    );
    const gy = Math.max(
      0,
      Math.min(this.rows - 1.001, (y / this.depth + 0.5) * (this.rows - 1)),
    );
    const col = Math.floor(gx),
      row = Math.floor(gy),
      tx = gx - col,
      ty = gy - row;
    const i = row * this.columns + col;
    return (
      (this.height[i] * (1 - tx) + this.height[i + 1] * tx) * (1 - ty) +
      (this.height[i + this.columns] * (1 - tx) +
        this.height[i + this.columns + 1] * tx) *
        ty
    );
  }

  advance(elapsed: number) {
    if (this.activeFor <= 0) return false;
    this.activeFor -= Math.min(Math.max(elapsed, 0), 0.05);
    if (this.activeFor <= 0) {
      this.reset();
      return true;
    }
    const step = 1 / 120;
    this.debt = Math.min(this.debt + Math.max(0, elapsed), 0.05);
    // CFL bound protects unusually wide/short responsive canvases too.
    const speedSquared = Math.min(
      this.waveSpeed ** 2,
      0.4 / (step * step * (1 / this.dx ** 2 + 1 / this.dy ** 2)),
    );
    while (this.debt + 1e-9 >= step) {
      for (let row = 1; row < this.rows - 1; row++) {
        for (let col = 1; col < this.columns - 1; col++) {
          const i = row * this.columns + col;
          const laplacian =
            (this.height[i - 1] + this.height[i + 1] - 2 * this.height[i]) /
              this.dx ** 2 +
            (this.height[i - this.columns] +
              this.height[i + this.columns] -
              2 * this.height[i]) /
              this.dy ** 2;
          const edge = Math.min(
            col,
            row,
            this.columns - 1 - col,
            this.rows - 1 - row,
          );
          const damping = edge < 7 ? 0.94 : 0.993;
          this.velocity[i] =
            (this.velocity[i] + laplacian * speedSquared * step) * damping;
          this.next[i] = Math.max(
            -0.08,
            Math.min(0.08, this.height[i] + this.velocity[i] * step),
          );
        }
      }
      this.height.set(this.next);
      this.debt -= step;
    }
    this.encode();
    return true;
  }

  private encode() {
    if (!this.encodePixels) return;
    const h = this.height;
    for (let row = 0; row < this.rows; row++)
      for (let col = 0; col < this.columns; col++) {
        const i = row * this.columns + col;
        const left = h[row * this.columns + Math.max(0, col - 1)];
        const right =
          h[row * this.columns + Math.min(this.columns - 1, col + 1)];
        const down = h[Math.max(0, row - 1) * this.columns + col];
        const up = h[Math.min(this.rows - 1, row + 1) * this.columns + col];
        this.pixels[i * 4] = Math.round(128 + h[i] * 1400);
        this.pixels[i * 4 + 1] = Math.round(
          128 +
            Math.max(-1, Math.min(1, ((right - left) / (2 * this.dx)) * 5)) *
              127,
        );
        this.pixels[i * 4 + 2] = Math.round(
          128 +
            Math.max(-1, Math.min(1, ((up - down) / (2 * this.dy)) * 5)) * 127,
        );
        this.pixels[i * 4 + 3] = Math.round(
          Math.min(1, Math.abs(left + right + down + up - 4 * h[i]) * 140) *
            255,
        );
      }
  }
}
