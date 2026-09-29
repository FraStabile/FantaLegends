export type TimerHandle = { readonly id: number };

/** Clock + timers abstraction: real in production, manual in tests. */
export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle | null | undefined): void;
}

export function createRealScheduler(): Scheduler {
  let seq = 0;
  const timers = new Map<number, unknown>();
  return {
    now: () => Date.now(),
    setTimeout(fn, ms) {
      const id = ++seq;
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          fn();
        }, Math.max(0, ms)),
      );
      return { id };
    },
    clearTimeout(h) {
      if (!h) return;
      const t = timers.get(h.id);
      if (t !== undefined) clearTimeout(t as never);
      timers.delete(h.id);
    },
  };
}

/**
 * Deterministic scheduler for tests: time only moves with `advance()`, and due
 * timers fire in chronological order (ties in creation order).
 */
export class ManualScheduler implements Scheduler {
  private current: number;
  private seq = 0;
  private readonly timers = new Map<number, { at: number; fn: () => void }>();

  constructor(start = 1_700_000_000_000) {
    this.current = start;
  }

  now(): number {
    return this.current;
  }

  setTimeout(fn: () => void, ms: number): TimerHandle {
    const id = ++this.seq;
    this.timers.set(id, { at: this.current + Math.max(0, ms), fn });
    return { id };
  }

  clearTimeout(h: TimerHandle | null | undefined): void {
    if (h) this.timers.delete(h.id);
  }

  /** Move time forward, firing every timer that becomes due. */
  advance(ms: number): void {
    const target = this.current + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const entry of this.timers) if (entry[1].at <= target && (!next || entry[1].at < next[1].at || (entry[1].at === next[1].at && entry[0] < next[0]))) next = entry;
      if (!next) break;
      this.timers.delete(next[0]);
      this.current = Math.max(this.current, next[1].at);
      next[1].fn();
    }
    this.current = target;
  }

  /** Run until no timers are left (or the safety limit is reached). */
  runAll(limitMs = 24 * 3600 * 1000): void {
    const end = this.current + limitMs;
    while (this.timers.size && this.current < end) {
      const nextAt = Math.min(...[...this.timers.values()].map((t) => t.at));
      this.advance(Math.max(0, nextAt - this.current));
    }
  }

  pending(): number {
    return this.timers.size;
  }
}
