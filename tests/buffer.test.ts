import { describe, it, expect, beforeEach } from 'vitest'
import { createBuffer } from '../src/buffer.js'

describe('Buffer', () => {
  let buffer: ReturnType<typeof createBuffer>

  beforeEach(() => {
    buffer = createBuffer(100)
  })

  describe('update', () => {
    it('should track text changes', () => {
      const changed = buffer.update('hello')
      expect(changed).toBe(true)
      expect(buffer.getText()).toBe('hello')
    })

    it('should increment revision on change', () => {
      expect(buffer.getRevision()).toBe(0)
      buffer.update('hello')
      expect(buffer.getRevision()).toBe(1)
      buffer.update('hello world')
      expect(buffer.getRevision()).toBe(2)
    })

    it('should not increment revision when text is same', () => {
      buffer.update('hello')
      expect(buffer.getRevision()).toBe(1)
      const changed = buffer.update('hello')
      expect(changed).toBe(false)
      expect(buffer.getRevision()).toBe(1)
    })

    it('should track cursor position', () => {
      buffer.update('hello', 3)
      expect(buffer.getCursor()).toBe(3)
    })

    it('should default cursor to end of text', () => {
      buffer.update('hello')
      expect(buffer.getCursor()).toBe(5)
    })
  })

  describe('getWindow', () => {
    it('should return full text when smaller than window', () => {
      buffer.update('hello')
      const window = buffer.getWindow()
      expect(window.text).toBe('hello')
      expect(window.offset).toBe(0)
    })

    it('should window around cursor for long text', () => {
      const longText = 'a'.repeat(200)
      buffer.update(longText, 100) // cursor in middle
      const window = buffer.getWindow()

      // Window should be 100 chars (the windowSize)
      expect(window.text.length).toBe(100)
      // Window should be centered around cursor
      expect(window.offset).toBe(50)
    })

    it('should adjust window at start of text', () => {
      const longText = 'a'.repeat(200)
      buffer.update(longText, 10) // cursor near start
      const window = buffer.getWindow()

      expect(window.offset).toBe(0)
      expect(window.text.length).toBe(100)
    })

    it('should adjust window at end of text', () => {
      const longText = 'a'.repeat(200)
      buffer.update(longText, 190) // cursor near end
      const window = buffer.getWindow()

      expect(window.offset).toBe(100)
      expect(window.text.length).toBe(100)
    })
  })

  describe('getState', () => {
    it('should return current state', () => {
      buffer.update('hello', 3)
      const state = buffer.getState()

      expect(state.text).toBe('hello')
      expect(state.cursor).toBe(3)
      expect(state.revision).toBe(1)
    })

    it('should return a copy (not reference)', () => {
      buffer.update('hello')
      const state1 = buffer.getState()
      buffer.update('world')
      const state2 = buffer.getState()

      expect(state1.text).toBe('hello')
      expect(state2.text).toBe('world')
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      buffer.update('hello', 3)
      buffer.reset()

      expect(buffer.getText()).toBe('')
      expect(buffer.getCursor()).toBe(0)
      expect(buffer.getRevision()).toBe(0)
    })
  })
})
