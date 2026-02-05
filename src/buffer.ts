/**
 * Text Buffer
 * Tracks text content with revision history and windowing support
 */

export type BufferState = {
  text: string
  revision: number
  cursor: number
}

export type Window = {
  text: string
  offset: number
}

/**
 * Creates a text buffer that tracks content and provides windowing
 */
export function createBuffer(windowSize: number = 500) {
  let state: BufferState = {
    text: '',
    revision: 0,
    cursor: 0,
  }

  return {
    /**
     * Update buffer with new text and cursor position
     */
    update(text: string, cursor?: number): boolean {
      const hasChanged = text !== state.text

      if (hasChanged) {
        state = {
          text,
          revision: state.revision + 1,
          cursor: cursor ?? text.length,
        }
      } else if (cursor !== undefined && cursor !== state.cursor) {
        state = { ...state, cursor }
      }

      return hasChanged
    },

    /**
     * Get current buffer state
     */
    getState(): BufferState {
      return { ...state }
    },

    /**
     * Get text window around cursor for efficient analysis
     * Returns a substring centered on cursor position
     */
    getWindow(): Window {
      const { text, cursor } = state
      const halfWindow = Math.floor(windowSize / 2)

      // Calculate window bounds
      let start = Math.max(0, cursor - halfWindow)
      let end = Math.min(text.length, cursor + halfWindow)

      // Adjust if we hit boundaries
      if (start === 0) {
        end = Math.min(text.length, windowSize)
      }
      if (end === text.length) {
        start = Math.max(0, text.length - windowSize)
      }

      return {
        text: text.slice(start, end),
        offset: start,
      }
    },

    /**
     * Get the full text
     */
    getText(): string {
      return state.text
    },

    /**
     * Get current revision number
     */
    getRevision(): number {
      return state.revision
    },

    /**
     * Get cursor position
     */
    getCursor(): number {
      return state.cursor
    },

    /**
     * Reset buffer to initial state
     */
    reset(): void {
      state = {
        text: '',
        revision: 0,
        cursor: 0,
      }
    },
  }
}

export type Buffer = ReturnType<typeof createBuffer>
