import type { EventMap, EventHandler } from "../types.js";

/**
 * EventBus — typed event emitter for StreamSense events.
 */
export class EventBus {
  private _handlers: {
    [K in keyof EventMap]?: Set<EventHandler<EventMap[K]>>;
  } = {};

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this._handlers[event]) {
      this._handlers[event] = new Set() as never;
    }
    (this._handlers[event] as Set<EventHandler<EventMap[K]>>).add(handler);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const set = this._handlers[event] as Set<EventHandler<EventMap[K]>> | undefined;
    if (set) {
      set.delete(handler);
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this._handlers[event] as Set<EventHandler<EventMap[K]>> | undefined;
    if (set) {
      for (const handler of set) {
        try {
          handler(data);
        } catch {
          // Don't let a handler crash the pipeline
        }
      }
    }
  }

  /** Remove all handlers */
  clear(): void {
    this._handlers = {};
  }
}
