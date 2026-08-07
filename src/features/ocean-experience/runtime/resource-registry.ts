/**
 * Reference-counted resource registry + abortable load generations.
 * Milestone 0 defines the contract; chapter assets bind in later milestones.
 */

export type ResourceDisposer = () => void;

export type RegisteredResource = {
  id: string;
  retainCount: number;
  dispose: ResourceDisposer;
};

export type AbortableLoadHandle = {
  generation: number;
  signal: AbortSignal;
  /** True when this generation is still the active load. */
  isCurrent: () => boolean;
  abort: (reason?: unknown) => void;
};

export class ResourceRegistry {
  private readonly resources = new Map<string, RegisteredResource>();
  private loadGeneration = 0;
  private activeController: AbortController | null = null;
  private fallbackReason: string | null = null;
  private contextLost = false;

  /**
   * Acquire or retain a resource. First acquire registers disposer.
   * Returns a release function that decrements; dispose runs at zero.
   */
  acquire(id: string, create: () => { dispose: ResourceDisposer }): () => void {
    const existing = this.resources.get(id);
    if (existing) {
      existing.retainCount += 1;
      return () => this.release(id);
    }
    const created = create();
    this.resources.set(id, {
      id,
      retainCount: 1,
      dispose: created.dispose,
    });
    return () => this.release(id);
  }

  release(id: string): void {
    const existing = this.resources.get(id);
    if (!existing) return;
    existing.retainCount -= 1;
    if (existing.retainCount > 0) return;
    this.resources.delete(id);
    try {
      existing.dispose();
    } catch {
      // Disposal must not throw across chapter teardown.
    }
  }

  has(id: string): boolean {
    return this.resources.has(id);
  }

  retainCount(id: string): number {
    return this.resources.get(id)?.retainCount ?? 0;
  }

  listIds(): string[] {
    return [...this.resources.keys()];
  }

  /** Begin an abortable load generation; aborts any prior in-flight load. */
  beginLoad(): AbortableLoadHandle {
    this.activeController?.abort();
    this.loadGeneration += 1;
    const generation = this.loadGeneration;
    const controller = new AbortController();
    this.activeController = controller;
    return {
      generation,
      signal: controller.signal,
      isCurrent: () =>
        generation === this.loadGeneration && !controller.signal.aborted,
      abort: (reason?: unknown) => {
        if (generation !== this.loadGeneration) return;
        controller.abort(reason);
      },
    };
  }

  currentLoadGeneration(): number {
    return this.loadGeneration;
  }

  setFallbackReason(reason: string | null): void {
    this.fallbackReason = reason;
  }

  getFallbackReason(): string | null {
    return this.fallbackReason;
  }

  setContextLost(lost: boolean): void {
    this.contextLost = lost;
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  /** Abort in-flight loads and dispose every retained resource. */
  disposeAll(): void {
    this.activeController?.abort();
    this.activeController = null;
    const ids = this.listIds();
    for (const id of ids) {
      const resource = this.resources.get(id);
      if (!resource) continue;
      this.resources.delete(id);
      try {
        resource.dispose();
      } catch {
        /* ignore */
      }
    }
  }
}

export function createResourceRegistry(): ResourceRegistry {
  return new ResourceRegistry();
}
