/**
 * Timeout enforcement for RSIS loops.
 * Deep port of Python timeout.py — SIGALRM with polling fallback, Budget class.
 */

import { EventEmitter } from 'node:events';

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

type TimerHandle = ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>;

/**
 * Enforce a hard deadline using timer-based abort.
 * Since Node.js doesn't have SIGALRM, we use an AbortSignal pattern.
 */
export function deadline(
  timeoutMs: number,
  label: string = 'operation',
): { signal: AbortSignal; clear: () => void } {
  if (timeoutMs <= 0) {
    throw new TimeoutError(`Deadline must be positive, got ${timeoutMs}`);
  }

  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort(new TimeoutError(`Deadline of ${timeoutMs}ms exceeded [${label}]`));
  }, timeoutMs);

  return {
    signal: ac.signal,
    clear: () => clearTimeout(timer),
  };
}

/**
 * Async wrapper: run a promise with a deadline. If it doesn't complete in time,
 * the promise is rejected with TimeoutError.
 */
export async function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string = 'operation',
): Promise<T> {
  const d = deadline(timeoutMs, label);
  try {
    const result = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        // AbortSignal listener
        const onAbort = () => {
          d.clear();
          reject(new TimeoutError(`Deadline of ${timeoutMs}ms exceeded [${label}]`));
        };
        if (d.signal.aborted) {
          onAbort();
          return;
        }
        d.signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
    return result;
  } finally {
    d.clear();
  }
}

// ── Budget ──────────────────────────────────────────────────────────────

export class Budget {
  public iterations: number = 0;
  private _start: number;
  public maxIterations: number;
  public maxTimeMs: number;
  public label: string;

  constructor(maxIterations: number, maxTimeMs: number, label: string = 'budget') {
    this.maxIterations = maxIterations;
    this.maxTimeMs = maxTimeMs;
    this.label = label;
    this._start = Date.now();
  }

  get remainingTime(): number {
    return Math.max(0, this.maxTimeMs - (Date.now() - this._start));
  }

  get expired(): boolean {
    return this.remainingTime <= 0;
  }

  /** Advance one iteration. Returns false if budget is exhausted. */
  tick(): boolean {
    this.iterations++;
    if (this.iterations > this.maxIterations) {
      console.warn(
        `%s: iteration budget exhausted (%d/%d)`,
        this.label, this.iterations, this.maxIterations,
      );
      return false;
    }
    const elapsed = Date.now() - this._start;
    if (elapsed > this.maxTimeMs) {
      console.warn(
        `%s: time budget exhausted (%dms/%dms)`,
        this.label, elapsed, this.maxTimeMs,
      );
      return false;
    }
    return true;
  }

  reset(): void {
    this.iterations = 0;
    this._start = Date.now();
  }
}

/**
 * Sleep utility used by loops.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
