/**
 * Event Emitter
 * Type-safe event subscription system
 */

import type {
  EventHandlers,
  EntityEvent,
  RemoveEvent,
  DiagnosticEvent,
} from './types.js'

type EventMap = {
  entity: EntityEvent
  remove: RemoveEvent
  diagnostic: DiagnosticEvent
}

/**
 * Creates a type-safe event emitter
 */
export function createEmitter() {
  const listeners = new Map<keyof EventHandlers, Set<EventHandlers[keyof EventHandlers]>>()

  // Initialize listener sets
  listeners.set('entity', new Set())
  listeners.set('remove', new Set())
  listeners.set('diagnostic', new Set())

  return {
    /**
     * Subscribe to an event
     */
    on<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void {
      const set = listeners.get(event)
      if (set) {
        set.add(handler as EventHandlers[keyof EventHandlers])
      }
    },

    /**
     * Unsubscribe from an event
     */
    off<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void {
      const set = listeners.get(event)
      if (set) {
        set.delete(handler as EventHandlers[keyof EventHandlers])
      }
    },

    /**
     * Emit an event to all subscribers
     */
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
      const set = listeners.get(event)
      if (set) {
        for (const handler of set) {
          try {
            (handler as (data: EventMap[K]) => void)(data)
          } catch (error) {
            // Emit error as diagnostic but don't throw
            if (event !== 'diagnostic') {
              this.emit('diagnostic', {
                type: 'diagnostic',
                severity: 'error',
                message: `Error in ${event} handler: ${error instanceof Error ? error.message : String(error)}`,
                source: 'emitter',
              })
            }
          }
        }
      }
    },

    /**
     * Remove all listeners for an event (or all events if no event specified)
     */
    removeAllListeners(event?: keyof EventHandlers): void {
      if (event) {
        listeners.get(event)?.clear()
      } else {
        for (const set of listeners.values()) {
          set.clear()
        }
      }
    },

    /**
     * Get listener count for an event
     */
    listenerCount(event: keyof EventHandlers): number {
      return listeners.get(event)?.size ?? 0
    },
  }
}

export type Emitter = ReturnType<typeof createEmitter>
