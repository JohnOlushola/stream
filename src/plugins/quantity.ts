/**
 * Quantity Plugin
 * Detects numbers with units (e.g., "10 km", "5.5 kg", "100 m")
 */

import type { Plugin, EntityCandidate } from '../types.js'

// Common unit patterns grouped by type
const UNIT_PATTERNS = {
  length: ['km', 'mi', 'm', 'cm', 'mm', 'ft', 'in', 'yd', 'miles', 'meters', 'feet', 'inches'],
  mass: ['kg', 'g', 'mg', 'lb', 'lbs', 'oz', 'pounds', 'grams', 'kilograms'],
  volume: ['l', 'ml', 'L', 'mL', 'gal', 'qt', 'pt', 'liters', 'gallons'],
  temperature: ['°C', '°F', 'C', 'F', 'celsius', 'fahrenheit'],
  time: ['s', 'ms', 'min', 'hr', 'h', 'sec', 'seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'],
  data: ['B', 'KB', 'MB', 'GB', 'TB', 'bytes', 'kilobytes', 'megabytes', 'gigabytes'],
  currency: ['USD', 'EUR', 'GBP', 'JPY', '$', '€', '£', '¥'],
}

// Flatten all units for regex
const ALL_UNITS = Object.values(UNIT_PATTERNS).flat()

// Build regex pattern
// Matches: 10km, 10 km, 10.5 km, 10,000 km, $10, €50
const NUMBER_PATTERN = /(?:[$€£¥])?\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?/
const UNIT_PATTERN = new RegExp(`(?:${ALL_UNITS.join('|')})`, 'i')

// Combined pattern: number followed by optional space and unit, or currency symbol before number
const QUANTITY_REGEX = new RegExp(
  `([$€£¥]?)(${NUMBER_PATTERN.source})\\s*(${UNIT_PATTERN.source})?`,
  'gi'
)

/**
 * Parse a number string (handles commas)
 */
function parseNumber(str: string): number {
  return parseFloat(str.replace(/,/g, ''))
}

/**
 * Determine unit type
 */
function getUnitType(unit: string): string {
  const lowerUnit = unit.toLowerCase()
  for (const [type, units] of Object.entries(UNIT_PATTERNS)) {
    if (units.some((u) => u.toLowerCase() === lowerUnit)) {
      return type
    }
  }
  return 'unknown'
}

/**
 * Normalize unit to standard form
 */
function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase()

  // Length
  if (['miles', 'mi'].includes(lower)) return 'mi'
  if (['meters', 'm'].includes(lower)) return 'm'
  if (['kilometers', 'km'].includes(lower)) return 'km'
  if (['feet', 'ft'].includes(lower)) return 'ft'
  if (['inches', 'in'].includes(lower)) return 'in'

  // Mass
  if (['pounds', 'lbs', 'lb'].includes(lower)) return 'lb'
  if (['kilograms', 'kg'].includes(lower)) return 'kg'
  if (['grams', 'g'].includes(lower)) return 'g'

  // Volume
  if (['liters', 'l'].includes(lower)) return 'L'
  if (['gallons', 'gal'].includes(lower)) return 'gal'

  // Temperature
  if (['celsius', 'c', '°c'].includes(lower)) return '°C'
  if (['fahrenheit', 'f', '°f'].includes(lower)) return '°F'

  return unit
}

export type QuantityPluginOptions = {
  /**
   * Minimum confidence score (default: 0.85)
   */
  minConfidence?: number
  /**
   * Only detect specific unit types
   */
  unitTypes?: Array<keyof typeof UNIT_PATTERNS>
}

/**
 * Creates a quantity detection plugin
 */
export function quantity(options: QuantityPluginOptions = {}): Plugin {
  const { minConfidence = 0.85, unitTypes } = options

  return {
    name: 'quantity',
    mode: 'realtime',
    priority: 10,

    run({ window, mode }) {
      const matches = [...window.text.matchAll(QUANTITY_REGEX)]
      const candidates: EntityCandidate[] = []

      for (const match of matches) {
        const [fullMatch, currencySymbol, numberStr, unit] = match
        const matchIndex = match.index!

        // Skip if no unit and no currency symbol
        if (!unit && !currencySymbol) continue

        // Determine the actual unit
        const actualUnit = unit || currencySymbol

        // Filter by unit type if specified
        if (unitTypes) {
          const unitType = getUnitType(actualUnit) as keyof typeof UNIT_PATTERNS
          if (!unitTypes.includes(unitType)) continue
        }

        const amount = parseNumber(numberStr)
        const normalizedUnit = normalizeUnit(actualUnit)

        // Calculate confidence
        // Higher confidence for:
        // - Standard units
        // - Round numbers
        // - Clear separation between number and unit
        let confidence = minConfidence
        if (match[0].includes(' ')) confidence += 0.05 // Space between number and unit
        if (Number.isInteger(amount)) confidence += 0.03 // Round number
        if (ALL_UNITS.includes(actualUnit)) confidence += 0.02 // Known unit
        confidence = Math.min(confidence, 1)

        const start = window.offset + matchIndex
        const end = start + fullMatch.length

        candidates.push({
          key: `quantity:${amount}:${normalizedUnit}:${start}:${end}`,
          kind: 'quantity',
          span: { start, end },
          text: fullMatch,
          value: {
            amount,
            unit: normalizedUnit,
            unitType: getUnitType(actualUnit),
            raw: numberStr,
          },
          confidence,
          status: mode === 'commit' ? 'confirmed' : 'provisional',
        })
      }

      return { upsert: candidates }
    },
  }
}
