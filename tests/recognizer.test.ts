import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRecognizer } from '../src/recognizer.js'
import { quantity } from '../src/plugins/quantity.js'
import { email } from '../src/plugins/email.js'
import type { EntityEvent, RemoveEvent } from '../src/types.js'

describe('Recognizer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('creation', () => {
    it('should create a recognizer', () => {
      const r = createRecognizer({
        plugins: [quantity()],
      })

      expect(r).toBeDefined()
      expect(r.feed).toBeInstanceOf(Function)
      expect(r.commit).toBeInstanceOf(Function)
      expect(r.state).toBeInstanceOf(Function)
      expect(r.on).toBeInstanceOf(Function)
      expect(r.off).toBeInstanceOf(Function)
      expect(r.destroy).toBeInstanceOf(Function)

      r.destroy()
    })
  })

  describe('feed', () => {
    it('should update state with fed text', () => {
      const r = createRecognizer({
        plugins: [quantity()],
      })

      r.feed({ text: 'hello' })
      expect(r.state().text).toBe('hello')

      r.destroy()
    })

    it('should increment revision on text change', () => {
      const r = createRecognizer({
        plugins: [quantity()],
      })

      expect(r.state().revision).toBe(0)
      r.feed({ text: 'hello' })
      expect(r.state().revision).toBe(1)

      r.destroy()
    })
  })

  describe('entity detection', () => {
    it('should detect entities after realtime delay', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      r.feed({ text: 'convert 10 km to mi' })

      // Before delay
      expect(entityHandler).not.toHaveBeenCalled()

      // After realtime delay
      await vi.advanceTimersByTimeAsync(150)

      expect(entityHandler).toHaveBeenCalled()
      const event = entityHandler.mock.calls[0][0] as EntityEvent
      expect(event.entity.kind).toBe('quantity')
      expect(event.entity.text).toBe('10 km')

      r.destroy()
    })

    it('should emit remove event when entity disappears', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const removeHandler = vi.fn()
      r.on('remove', removeHandler)

      // First, add an entity
      r.feed({ text: 'convert 10 km to mi' })
      await vi.advanceTimersByTimeAsync(150)

      // Then remove it
      r.feed({ text: 'convert to mi' })
      await vi.advanceTimersByTimeAsync(150)

      expect(removeHandler).toHaveBeenCalled()

      r.destroy()
    })

    it('should support multiple plugins', async () => {
      const r = createRecognizer({
        plugins: [quantity(), email()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      r.feed({ text: '10 km and test@example.com' })
      await vi.advanceTimersByTimeAsync(150)

      // Should detect both quantity and email
      const kinds = entityHandler.mock.calls.map(
        (call) => (call[0] as EntityEvent).entity.kind
      )
      expect(kinds).toContain('quantity')
      expect(kinds).toContain('email')

      r.destroy()
    })
  })

  describe('commit', () => {
    it('should run commit pass immediately', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      r.feed({ text: 'convert 10 km to mi' })
      r.commit('enter')

      // Allow promises to resolve
      await vi.advanceTimersByTimeAsync(0)

      expect(entityHandler).toHaveBeenCalled()
      const event = entityHandler.mock.calls[0][0] as EntityEvent
      expect(event.entity.status).toBe('confirmed')

      r.destroy()
    })

    it('should auto-commit after timeout', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      r.feed({ text: 'convert 10 km to mi' })

      // Wait for commit timeout
      await vi.advanceTimersByTimeAsync(600)

      // Should have confirmed status from commit pass
      const calls = entityHandler.mock.calls
      const lastCall = calls[calls.length - 1][0] as EntityEvent
      expect(lastCall.entity.status).toBe('confirmed')

      r.destroy()
    })
  })

  describe('state', () => {
    it('should return current entities', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      r.feed({ text: 'convert 10 km to mi' })
      await vi.advanceTimersByTimeAsync(150)

      const state = r.state()
      expect(state.entities.length).toBe(1)
      expect(state.entities[0].text).toBe('10 km')

      r.destroy()
    })
  })

  describe('IME handling', () => {
    it('should skip analysis during composition', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      // Start composition
      r.feed({ text: '10 km', meta: { composing: true } })
      await vi.advanceTimersByTimeAsync(150)

      // No analysis during composition
      expect(entityHandler).not.toHaveBeenCalled()

      // End composition
      r.feed({ text: '10 km', meta: { composing: false } })
      await vi.advanceTimersByTimeAsync(150)

      // Now analysis runs
      expect(entityHandler).toHaveBeenCalled()

      r.destroy()
    })
  })

  describe('destroy', () => {
    it('should stop all processing after destroy', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)

      r.feed({ text: 'convert 10 km to mi' })
      r.destroy()

      await vi.advanceTimersByTimeAsync(200)

      expect(entityHandler).not.toHaveBeenCalled()
    })
  })

  describe('event subscription', () => {
    it('should allow unsubscribing', async () => {
      const r = createRecognizer({
        plugins: [quantity()],
        schedule: { realtimeMs: 100, commitAfterMs: 500 },
      })

      const entityHandler = vi.fn()
      r.on('entity', entityHandler)
      r.off('entity', entityHandler)

      r.feed({ text: 'convert 10 km to mi' })
      await vi.advanceTimersByTimeAsync(150)

      expect(entityHandler).not.toHaveBeenCalled()

      r.destroy()
    })
  })
})
