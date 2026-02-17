/**
 * Recognizer
 * Main entry point that wires together all components
 */

import type {
  Recognizer,
  RecognizerOptions,
  RecognizerState,
  FeedInput,
  CommitReason,
  EventHandlers,
  PluginContext,
} from './types.js'
import { createBuffer } from './buffer.js'
import { createStore } from './store.js'
import { createEmitter } from './emitter.js'
import { createScheduler } from './scheduler.js'
import { createRunner } from './runner.js'

const DEFAULT_OPTIONS = {
  windowSize: 500,
  schedule: {
    realtimeMs: 150,
    commitAfterMs: 700,
  },
  thresholds: {
    realtime: 0.8,
    commit: 0.5,
  },
}

/**
 * Creates a Stream recognizer
 */
export function createRecognizer(options: RecognizerOptions): Recognizer {
  const {
    plugins,
    schedule = {},
    thresholds = {},
    windowSize = DEFAULT_OPTIONS.windowSize,
  } = options

  // Initialize components
  const buffer = createBuffer(windowSize)
  const store = createStore()
  const emitter = createEmitter()
  const runner = createRunner(plugins, {
    ...DEFAULT_OPTIONS.thresholds,
    ...thresholds,
  })

  let isDestroyed = false

  /**
   * Build plugin context from current state
   */
  function buildContext(): Omit<PluginContext, 'mode'> {
    const window = buffer.getWindow()
    return {
      text: buffer.getText(),
      window,
      entities: store.getAll(),
      cursor: buffer.getCursor(),
    }
  }

  /**
   * Run realtime analysis
   */
  async function runRealtime() {
    if (isDestroyed) return

    try {
      const context = buildContext()
      const result = await runner.runRealtime(context)

      // For realtime, we reconcile to handle removals
      const allCandidates = result.upsert ?? []
      const changes = store.reconcile(allCandidates)

      // Emit removal events
      for (const entity of changes.removed) {
        emitter.emit('remove', {
          type: 'remove',
          id: entity.id,
          key: entity.key,
        })
      }

      // Emit entity events
      for (const entity of changes.added) {
        emitter.emit('entity', {
          type: 'entity',
          entity,
          isUpdate: false,
        })
      }

      for (const entity of changes.updated) {
        emitter.emit('entity', {
          type: 'entity',
          entity,
          isUpdate: true,
        })
      }
    } catch (error) {
      emitter.emit('diagnostic', {
        type: 'diagnostic',
        severity: 'error',
        message: `Realtime analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        source: 'recognizer',
      })
    }
  }

  /**
   * Run commit analysis
   */
  async function runCommit() {
    if (isDestroyed) return

    try {
      const context = buildContext()
      const result = await runner.runCommit(context)

      // For commit, we reconcile and confirm all entities
      const allCandidates = (result.upsert ?? []).map((c) => ({
        ...c,
        status: 'confirmed' as const,
      }))

      const changes = store.reconcile(allCandidates)

      // Emit removal events
      for (const entity of changes.removed) {
        emitter.emit('remove', {
          type: 'remove',
          id: entity.id,
          key: entity.key,
        })
      }

      // Emit entity events
      for (const entity of changes.added) {
        emitter.emit('entity', {
          type: 'entity',
          entity,
          isUpdate: false,
        })
      }

      for (const entity of changes.updated) {
        emitter.emit('entity', {
          type: 'entity',
          entity,
          isUpdate: true,
        })
      }

      // Confirm any remaining provisional entities
      const confirmed = store.confirmAll()
      for (const entity of confirmed) {
        emitter.emit('entity', {
          type: 'entity',
          entity,
          isUpdate: true,
        })
      }
    } catch (error) {
      emitter.emit('diagnostic', {
        type: 'diagnostic',
        severity: 'error',
        message: `Commit analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        source: 'recognizer',
      })
    }
  }

  // Initialize scheduler with callbacks
  const scheduler = createScheduler(
    {
      onRealtime: runRealtime,
      onCommit: runCommit,
    },
    {
      ...DEFAULT_OPTIONS.schedule,
      ...schedule,
    }
  )

  return {
    /**
     * Feed new text input
     */
    feed(input: FeedInput): void {
      if (isDestroyed) return

      const { text, cursor, meta } = input

      // Handle IME composition
      if (meta?.composing !== undefined) {
        scheduler.setComposing(meta.composing)
        if (meta.composing) return // Skip analysis during composition
      }

      // Update buffer
      const changed = buffer.update(text, cursor)

      // Schedule analysis if text changed
      if (changed) {
        scheduler.scheduleAnalysis()
      }
    },

    /**
     * Force a commit pass
     */
    commit(reason: CommitReason): void {
      if (isDestroyed) return

      emitter.emit('diagnostic', {
        type: 'diagnostic',
        severity: 'info',
        message: `Commit triggered: ${reason}`,
        source: 'recognizer',
      })

      scheduler.forceCommit()
    },

    /**
     * Get current state
     */
    state(): RecognizerState {
      return {
        text: buffer.getText(),
        revision: buffer.getRevision(),
        entities: store.getAll(),
        pendingCommit: scheduler.isPendingCommit(),
      }
    },

    /**
     * Subscribe to events
     */
    on<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void {
      emitter.on(event, handler)
    },

    /**
     * Unsubscribe from events
     */
    off<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void {
      emitter.off(event, handler)
    },

    /**
     * Cleanup and destroy
     */
    destroy(): void {
      isDestroyed = true
      scheduler.destroy()
      emitter.removeAllListeners()
      store.clear()
      buffer.reset()
    },
  }
}
