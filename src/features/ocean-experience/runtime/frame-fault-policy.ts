/**
 * Bounded per-subscriber failure isolation for the shared frame clock.
 * One bad callback must not freeze scroll, renderer, audio, or navigation.
 */

export type FrameFaultRecord = {
  id: string;
  failureCount: number;
  disabled: boolean;
  lastErrorMessage: string;
  lastFailedAtMs: number;
};

export type FrameFaultPolicyOptions = {
  /** Consecutive failures before a subscriber is disabled. */
  disableAfter?: number;
  /** Optional sink for development diagnostics. */
  onFault?: (record: FrameFaultRecord) => void;
};

const DEFAULT_DISABLE_AFTER = 3;

export class FrameFaultPolicy {
  private readonly disableAfter: number;
  private readonly onFault: ((record: FrameFaultRecord) => void) | null;
  private readonly records = new Map<string, FrameFaultRecord>();

  constructor(options: FrameFaultPolicyOptions = {}) {
    this.disableAfter = Math.max(1, options.disableAfter ?? DEFAULT_DISABLE_AFTER);
    this.onFault = options.onFault ?? null;
  }

  isDisabled(id: string): boolean {
    return this.records.get(id)?.disabled === true;
  }

  /** Clear consecutive-failure streak after a successful callback. */
  noteSuccess(id: string): void {
    const record = this.records.get(id);
    if (!record || record.disabled) return;
    if (record.failureCount === 0) return;
    record.failureCount = 0;
    record.lastErrorMessage = "";
  }

  noteFailure(id: string, error: unknown, nowMs = 0): FrameFaultRecord {
    const message = error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "unknown frame subscriber error";
    const existing = this.records.get(id);
    const record: FrameFaultRecord = existing ?? {
      id,
      failureCount: 0,
      disabled: false,
      lastErrorMessage: "",
      lastFailedAtMs: 0,
    };
    record.failureCount += 1;
    record.lastErrorMessage = message;
    record.lastFailedAtMs = nowMs;
    if (record.failureCount >= this.disableAfter) {
      record.disabled = true;
    }
    this.records.set(id, record);
    this.onFault?.(record);
    return record;
  }

  getRecord(id: string): FrameFaultRecord | null {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  listFaults(): FrameFaultRecord[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  /** Re-enable a previously disabled subscriber (tests / recovery). */
  clear(id: string): void {
    this.records.delete(id);
  }

  reset(): void {
    this.records.clear();
  }
}

export function createFrameFaultPolicy(
  options: FrameFaultPolicyOptions = {},
): FrameFaultPolicy {
  return new FrameFaultPolicy(options);
}
