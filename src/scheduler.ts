/**
 * Scheduler
 * Handles debounced realtime and commit passes
 */

import type { ScheduleConfig } from './types.js'

export type SchedulerCallbacks = {
  onRealtime: () => void | Promise<void>
  onCommit: () => void | Promise<void>
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  realtimeMs: 150,
  commitAfterMs: 700,
}

/**
 * Creates a scheduler for realtime and commit passes
 */
export function createScheduler(
  callbacks: SchedulerCallbacks,
  config: Partial<ScheduleConfig> = {}
) {
  const schedule: ScheduleConfig = {
    ...DEFAULT_SCHEDULE,
    ...config,
  }

  let realtimeTimer: ReturnType<typeof setTimeout> | null = null
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let isComposing = false
  let isDestroyed = false

  /**
   * Clear realtime timer
   */
  function clearRealtime() {
    if (realtimeTimer) {
      clearTimeout(realtimeTimer)
      realtimeTimer = null
    }
  }

  /**
   * Clear commit timer
   */
  function clearCommit() {
    if (commitTimer) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
  }

  return {
    /**
     * Schedule analysis after text change
     * Debounces realtime pass and resets commit timer
     */
    scheduleAnalysis(): void {
      if (isDestroyed || isComposing) return

      // Debounce realtime pass
      clearRealtime()
      realtimeTimer = setTimeout(async () => {
        if (isDestroyed || isComposing) return
        try {
          await callbacks.onRealtime()
        } catch {
          // Error handling is done in the callback
        }
      }, schedule.realtimeMs)

      // Reset commit timer
      clearCommit()
      commitTimer = setTimeout(async () => {
        if (isDestroyed) return
        try {
          await callbacks.onCommit()
        } catch {
          // Error handling is done in the callback
        }
      }, schedule.commitAfterMs)
    },

    /**
     * Force immediate commit
     */
    forceCommit(): void {
      if (isDestroyed) return

      clearRealtime()
      clearCommit()

      // Run commit synchronously (caller can await if needed)
      callbacks.onCommit()
    },

    /**
     * Set IME composition state
     * Analysis is paused during composition
     */
    setComposing(composing: boolean): void {
      isComposing = composing

      if (!composing) {
        // Resume analysis after composition ends
        this.scheduleAnalysis()
      }
    },

    /**
     * Check if currently composing
     */
    isComposing(): boolean {
      return isComposing
    },

    /**
     * Check if a commit is pending
     */
    isPendingCommit(): boolean {
      return commitTimer !== null
    },

    /**
     * Cancel all pending timers
     */
    cancel(): void {
      clearRealtime()
      clearCommit()
    },

    /**
     * Get current schedule config
     */
    getConfig(): ScheduleConfig {
      return { ...schedule }
    },

    /**
     * Destroy scheduler and cleanup
     */
    destroy(): void {
      isDestroyed = true
      this.cancel()
    },
  }
}

export type Scheduler = ReturnType<typeof createScheduler>
