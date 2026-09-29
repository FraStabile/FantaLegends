import type { DomainEvent, DomainEventType, EventOf } from './types';

type Handler<E> = (event: E) => void;

/**
 * Minimal synchronous typed event bus. Handlers run in subscription order; a
 * throwing handler is isolated so one broken subscriber (e.g. notifications)
 * never corrupts the authoritative flow.
 */
export class EventBus {
  private readonly handlers = new Map<DomainEventType | '*', Set<Handler<DomainEvent>>>();

  on<T extends DomainEventType>(type: T, handler: Handler<EventOf<T>>): () => void {
    return this.add(type, handler as Handler<DomainEvent>);
  }

  onAny(handler: Handler<DomainEvent>): () => void {
    return this.add('*', handler);
  }

  emit(event: DomainEvent): void {
    for (const key of [event.type, '*'] as const) {
      for (const h of this.handlers.get(key) ?? []) {
        try {
          h(event);
        } catch (err) {
          console.error(`[EventBus] handler for ${event.type} failed`, err);
        }
      }
    }
  }

  emitAll(events: DomainEvent[]): void {
    for (const e of events) this.emit(e);
  }

  private add(key: DomainEventType | '*', handler: Handler<DomainEvent>): () => void {
    let set = this.handlers.get(key);
    if (!set) this.handlers.set(key, (set = new Set()));
    set.add(handler);
    return () => set!.delete(handler);
  }
}
