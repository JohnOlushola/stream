import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateLlmEntity, createLlmPlugin } from './llmPlugin'

describe('validateLlmEntity', () => {
  const textLength = 20

  it('returns null for non-objects', () => {
    expect(validateLlmEntity(null, textLength)).toBeNull()
    expect(validateLlmEntity(undefined, textLength)).toBeNull()
    expect(validateLlmEntity(42, textLength)).toBeNull()
    expect(validateLlmEntity('foo', textLength)).toBeNull()
    expect(validateLlmEntity([], textLength)).toBeNull()
  })

  it('returns null when start/end are invalid', () => {
    expect(validateLlmEntity({ start: -1, end: 5, kind: 'email', text: 'a@b.co' }, textLength)).toBeNull()
    expect(validateLlmEntity({ start: 0, end: 99, kind: 'email', text: 'a@b.co' }, textLength)).toBeNull()
    expect(validateLlmEntity({ start: 5, end: 5, kind: 'email', text: '' }, textLength)).toBeNull()
    expect(validateLlmEntity({ start: 10, end: 5, kind: 'email', text: '' }, textLength)).toBeNull()
  })

  it('returns null when kind is not in allowed set', () => {
    expect(validateLlmEntity({ start: 0, end: 5, kind: 'unknown', text: 'hello' }, textLength)).toBeNull()
    expect(validateLlmEntity({ start: 0, end: 5, kind: '', text: 'hello' }, textLength)).toBeNull()
  })

  it('returns null when types cannot coerce to valid integers', () => {
    expect(validateLlmEntity({ start: {}, end: 5, kind: 'email', text: 'a@b' }, textLength)).toBeNull()
    expect(validateLlmEntity({ start: 0, end: NaN, kind: 'email', text: 'a@b' }, textLength)).toBeNull()
  })

  it('accepts valid entity and normalizes kind to lowercase', () => {
    const out = validateLlmEntity(
      { start: 0, end: 10, kind: 'EMAIL', text: 'a@b.co' },
      textLength
    )
    expect(out).not.toBeNull()
    expect(out).toEqual({ start: 0, end: 10, kind: 'email', text: 'a@b.co' })
  })

  it('accepts all LLM kinds', () => {
    const kinds = ['quantity', 'datetime', 'email', 'url', 'phone', 'person', 'place', 'organization', 'topic']
    kinds.forEach((kind, i) => {
      const start = i * 2
      const end = start + 1
      const out = validateLlmEntity({ start, end, kind, text: 'x' }, textLength)
      expect(out).not.toBeNull()
      expect(out!.kind).toBe(kind)
    })
  })
})

describe('createLlmPlugin', () => {
  it('returns a plugin with name and mode', () => {
    const plugin = createLlmPlugin()
    expect(plugin.name).toBe('llm')
    expect(plugin.mode).toBe('commit')
    expect(plugin.run).toBeInstanceOf(Function)
  })

  it('run returns empty upsert when no API key (mocked env)', async () => {
    const plugin = createLlmPlugin()
    const result = await plugin.run!({
      text: 'hello',
      cursor: 5,
      entities: [],
      commitReason: 'enter',
    } as any)
    expect(result).toEqual({ upsert: [] })
  })

  it('run returns empty upsert for empty text', async () => {
    const plugin = createLlmPlugin()
    const result = await plugin.run!({
      text: '   ',
      cursor: 0,
      entities: [],
      commitReason: 'enter',
    } as any)
    expect(result).toEqual({ upsert: [] })
  })
})
