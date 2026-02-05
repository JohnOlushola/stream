import { describe, it, expect } from 'vitest'
import { quantity } from '../../src/plugins/quantity.js'
import type { PluginContext } from '../../src/types.js'

describe('Quantity Plugin', () => {
  const plugin = quantity()

  const createContext = (text: string, mode: 'realtime' | 'commit' = 'realtime'): PluginContext => ({
    text,
    window: { text, offset: 0 },
    mode,
    entities: [],
    cursor: text.length,
  })

  describe('detection', () => {
    it('should detect simple quantities', () => {
      const result = plugin.run(createContext('10 km'))
      expect(result.upsert?.length).toBe(1)
      expect(result.upsert?.[0].value).toEqual({
        amount: 10,
        unit: 'km',
        unitType: 'length',
        raw: '10',
      })
    })

    it('should detect quantities without space', () => {
      const result = plugin.run(createContext('10km'))
      expect(result.upsert?.length).toBe(1)
    })

    it('should detect decimal quantities', () => {
      const result = plugin.run(createContext('5.5 kg'))
      expect(result.upsert?.[0].value).toEqual({
        amount: 5.5,
        unit: 'kg',
        unitType: 'mass',
        raw: '5.5',
      })
    })

    it('should detect multiple quantities', () => {
      const result = plugin.run(createContext('convert 10 km to 6.2 mi'))
      expect(result.upsert?.length).toBe(2)
    })

    it('should detect currency amounts', () => {
      const result = plugin.run(createContext('Price: $50'))
      expect(result.upsert?.length).toBe(1)
      expect(result.upsert?.[0].value).toEqual({
        amount: 50,
        unit: '$',
        unitType: 'currency',
        raw: '50',
      })
    })

    it('should detect various units', () => {
      const cases = [
        { input: '100 m', unit: 'm', type: 'length' },
        { input: '50 g', unit: 'g', type: 'mass' },
        { input: '2 L', unit: 'L', type: 'volume' },
        { input: '30 min', unit: 'min', type: 'time' },
        { input: '500 MB', unit: 'MB', type: 'data' },
      ]

      for (const { input, unit, type } of cases) {
        const result = plugin.run(createContext(input))
        expect(result.upsert?.length).toBeGreaterThan(0)
        expect((result.upsert?.[0].value as { unit: string }).unit).toBe(unit)
        expect((result.upsert?.[0].value as { unitType: string }).unitType).toBe(type)
      }
    })
  })

  describe('span calculation', () => {
    it('should calculate correct span', () => {
      const result = plugin.run(createContext('convert 10 km to mi'))
      const entity = result.upsert?.[0]

      expect(entity?.span).toEqual({ start: 8, end: 13 })
      expect(entity?.text).toBe('10 km')
    })

    it('should handle window offset', () => {
      const context: PluginContext = {
        text: 'prefix text convert 10 km to mi',
        window: { text: 'convert 10 km to mi', offset: 12 },
        mode: 'realtime',
        entities: [],
        cursor: 31,
      }

      const result = plugin.run(context)
      const entity = result.upsert?.[0]

      // Span should be relative to full text, not window
      expect(entity?.span).toEqual({ start: 20, end: 25 })
    })
  })

  describe('status', () => {
    it('should be provisional in realtime mode', () => {
      const result = plugin.run(createContext('10 km', 'realtime'))
      expect(result.upsert?.[0].status).toBe('provisional')
    })

    it('should be confirmed in commit mode', () => {
      const result = plugin.run(createContext('10 km', 'commit'))
      expect(result.upsert?.[0].status).toBe('confirmed')
    })
  })

  describe('key generation', () => {
    it('should generate unique stable keys', () => {
      const result = plugin.run(createContext('10 km and 20 km'))
      const keys = result.upsert?.map((e) => e.key)

      expect(keys?.length).toBe(2)
      expect(new Set(keys).size).toBe(2) // All unique
    })

    it('should include position in key for same value at different positions', () => {
      const result = plugin.run(createContext('10 km ... 10 km'))
      const keys = result.upsert?.map((e) => e.key)

      expect(keys?.length).toBe(2)
      expect(keys?.[0]).not.toBe(keys?.[1])
    })
  })

  describe('edge cases', () => {
    it('should not match numbers without units', () => {
      const result = plugin.run(createContext('I have 10 apples'))
      expect(result.upsert?.length ?? 0).toBe(0)
    })

    it('should handle empty input', () => {
      const result = plugin.run(createContext(''))
      expect(result.upsert?.length ?? 0).toBe(0)
    })

    it('should handle input with no matches', () => {
      const result = plugin.run(createContext('hello world'))
      expect(result.upsert?.length ?? 0).toBe(0)
    })
  })
})
