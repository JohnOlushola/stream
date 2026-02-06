/**
 * Scheduler — manages debounced realtime and commit passes.
 *
 * - Realtime ticks fire at most every `realtimeMs` after input.
 * - Commit fires after `commitAfterMs` of idle (no new feed calls).
 */
export class Scheduler {
  private _realtimeMs: number;
  private _commitAfterMs: number;

  private _realtimeTimer: ReturnType<typeof setTimeout> | null = null;
  private _commitTimer: ReturnType<typeof setTimeout> | null = null;

  private _onRealtime: () => void;
  private _onCommit: () => void;

  private _destroyed = false;

  constructor(opts: {
    realtimeMs: number;
    commitAfterMs: number;
    onRealtime: () => void;
    onCommit: () => void;
  }) {
    this._realtimeMs = opts.realtimeMs;
    this._commitAfterMs = opts.commitAfterMs;
    this._onRealtime = opts.onRealtime;
    this._onCommit = opts.onCommit;
  }

  /**
   * Called on every feed(). Schedules a realtime pass (debounced)
   * and resets the commit idle timer.
   */
  onInput(): void {
    if (this._destroyed) return;

    // Debounce realtime pass
    if (this._realtimeTimer === null) {
      this._realtimeTimer = setTimeout(() => {
        this._realtimeTimer = null;
        if (!this._destroyed) {
          this._onRealtime();
        }
      }, this._realtimeMs);
    }

    // Reset commit idle timer
    if (this._commitTimer !== null) {
      clearTimeout(this._commitTimer);
    }
    this._commitTimer = setTimeout(() => {
      this._commitTimer = null;
      if (!this._destroyed) {
        this._onCommit();
      }
    }, this._commitAfterMs);
  }

  /**
   * Force-fire any pending timers immediately, then clear.
   */
  flush(): void {
    if (this._realtimeTimer !== null) {
      clearTimeout(this._realtimeTimer);
      this._realtimeTimer = null;
      this._onRealtime();
    }
    if (this._commitTimer !== null) {
      clearTimeout(this._commitTimer);
      this._commitTimer = null;
      this._onCommit();
    }
  }

  /**
   * Cancel all pending timers.
   */
  cancel(): void {
    if (this._realtimeTimer !== null) {
      clearTimeout(this._realtimeTimer);
      this._realtimeTimer = null;
    }
    if (this._commitTimer !== null) {
      clearTimeout(this._commitTimer);
      this._commitTimer = null;
    }
  }

  /**
   * Tear down the scheduler. No further callbacks will fire.
   */
  destroy(): void {
    this._destroyed = true;
    this.cancel();
  }
}
