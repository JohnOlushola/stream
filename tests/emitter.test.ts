import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEmitter } from '../src/emitter.js'

describe('Emitter', () => {
  let emitter: ReturnType<typeof createEmitter>

  beforeEach(() => {
    emitter = createEmitter()
  })

  describe('on and emit', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn()
      emitter.on('entity', handler)

      const event = {
        type: 'entity' as const,
        entity: {
          id: 'ent_1',
          key: 'test',
          kind: 'quantity' as const,
          span: { start: 0, end: 5 },
          text: 'test',
          value: {},
          confidence: 0.9,
          status: 'provisional' as const,
        },
        isUpdate: false,
      }

      emitter.emit('entity', event)
      expect(handler).toHaveBeenCalledWith(event)
    })

    it('should support multiple handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('entity', handler1)
      emitter.on('entity', handler2)

      emitter.emit('entity', {
        type: 'entity',
        entity: {
          id: 'ent_1',
          key: 'test',
          kind: 'quantity',
          span: { start: 0, end: 5 },
          text: 'test',
          value: {},
          confidence: 0.9,
          status: 'provisional',
        },
        isUpdate: false,
      })

      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalled()
    })

    it('should support different event types', () => {
      const entityHandler = vi.fn()
      const removeHandler = vi.fn()

      emitter.on('entity', entityHandler)
      emitter.on('remove', removeHandler)

      emitter.emit('remove', {
        type: 'remove',
        id: 'ent_1',
        key: 'test',
      })

      expect(entityHandler).not.toHaveBeenCalled()
      expect(removeHandler).toHaveBeenCalled()
    })
  })

  describe('off', () => {
    it('should remove handler', () => {
      const handler = vi.fn()
      emitter.on('entity', handler)
      emitter.off('entity', handler)

      emitter.emit('entity', {
        type: 'entity',
        entity: {
          id: 'ent_1',
          key: 'test',
          kind: 'quantity',
          span: { start: 0, end: 5 },
          text: 'test',
          value: {},
          confidence: 0.9,
          status: 'provisional',
        },
        isUpdate: false,
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('removeAllListeners', () => {
    it('should remove all handlers for an event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      emitter.on('entity', handler1)
      emitter.on('entity', handler2)
      emitter.removeAllListeners('entity')

      emitter.emit('entity', {
        type: 'entity',
        entity: {
          id: 'ent_1',
          key: 'test',
          kind: 'quantity',
          span: { start: 0, end: 5 },
          text: 'test',
          value: {},
          confidence: 0.9,
          status: 'provisional',
        },
        isUpdate: false,
      })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should remove all handlers when no event specified', () => {
      const entityHandler = vi.fn()
      const removeHandler = vi.fn()

      emitter.on('entity', entityHandler)
      emitter.on('remove', removeHandler)
      emitter.removeAllListeners()

      expect(emitter.listenerCount('entity')).toBe(0)
      expect(emitter.listenerCount('remove')).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should emit diagnostic when handler throws', () => {
      const diagnosticHandler = vi.fn()
      emitter.on('diagnostic', diagnosticHandler)

      emitter.on('entity', () => {
        throw new Error('Handler error')
      })

      emitter.emit('entity', {
        type: 'entity',
        entity: {
          id: 'ent_1',
          key: 'test',
          kind: 'quantity',
          span: { start: 0, end: 5 },
          text: 'test',
          value: {},
          confidence: 0.9,
          status: 'provisional',
        },
        isUpdate: false,
      })

      expect(diagnosticHandler).toHaveBeenCalled()
      expect(diagnosticHandler.mock.calls[0][0].severity).toBe('error')
    })
  })

  describe('listenerCount', () => {
    it('should return correct count', () => {
      expect(emitter.listenerCount('entity')).toBe(0)

      emitter.on('entity', () => {})
      expect(emitter.listenerCount('entity')).toBe(1)

      emitter.on('entity', () => {})
      expect(emitter.listenerCount('entity')).toBe(2)
    })
  })
})
