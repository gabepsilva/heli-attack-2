/**
 * Fixed-capacity particle FX event queue (issue #35).
 *
 * Mirrors bullet pooling: capacity never grows. When full, the oldest pending
 * event is dropped so heavy simultaneous kills/impacts stay within budget.
 */

import { PARTICLE_FX } from '../config/particles';
import type { ParticleFxEvent } from './particleEvents';

/**
 * Ring buffer of pending {@link ParticleFxEvent}s.
 * After construction, {@link push} / {@link drain} mutate in place — no
 * array growth beyond the fixed capacity.
 */
export class ParticleFxQueue {
  readonly capacity: number;

  private readonly slots: (ParticleFxEvent | null)[];
  private head = 0;
  private tail = 0;
  private _length = 0;
  private _dropped = 0;
  private _pushed = 0;

  constructor(capacity: number = PARTICLE_FX.eventQueueCapacity) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `ParticleFxQueue capacity must be a positive integer, got ${capacity}`,
      );
    }
    this.capacity = capacity;
    this.slots = new Array<ParticleFxEvent | null>(capacity).fill(null);
  }

  get length(): number {
    return this._length;
  }

  /** Events rejected because the ring was full. */
  get dropped(): number {
    return this._dropped;
  }

  /** Lifetime push attempts (including those that overwrote). */
  get pushed(): number {
    return this._pushed;
  }

  /**
   * Enqueue one event. If at capacity, drops the oldest and records
   * {@link dropped}. Never allocates a larger buffer.
   */
  push(event: ParticleFxEvent): void {
    this._pushed += 1;
    if (this._length === this.capacity) {
      // Drop oldest.
      this.slots[this.head] = null;
      this.head = (this.head + 1) % this.capacity;
      this._length -= 1;
      this._dropped += 1;
    }
    this.slots[this.tail] = event;
    this.tail = (this.tail + 1) % this.capacity;
    this._length += 1;
  }

  /** Push every event from a builder result. */
  pushAll(events: readonly ParticleFxEvent[]): void {
    for (let i = 0; i < events.length; i += 1) {
      this.push(events[i]!);
    }
  }

  /**
   * Take ownership of every pending event since the last drain.
   * Returns a fresh array for the binder; the ring is cleared.
   */
  drain(): ParticleFxEvent[] {
    if (this._length === 0) {
      return [];
    }
    const out: ParticleFxEvent[] = [];
    while (this._length > 0) {
      const event = this.slots[this.head];
      this.slots[this.head] = null;
      this.head = (this.head + 1) % this.capacity;
      this._length -= 1;
      if (event) {
        out.push(event);
      }
    }
    this.head = 0;
    this.tail = 0;
    return out;
  }

  /** Clear pending events without returning them (scene restart). */
  clear(): void {
    this.slots.fill(null);
    this.head = 0;
    this.tail = 0;
    this._length = 0;
  }

  /** Reset counters + pending (full session restart). */
  reset(): void {
    this.clear();
    this._dropped = 0;
    this._pushed = 0;
  }
}
