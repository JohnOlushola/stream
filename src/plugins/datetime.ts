/**
 * DateTime Plugin
 * Detects dates and times in text
 */

import type { Plugin, EntityCandidate } from '../types.js'

// Date patterns
const DATE_PATTERNS = [
  // ISO: 2024-01-15
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  // US: 01/15/2024 or 1/15/24
  /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
  // European: 15.01.2024
  /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/g,
  // Written: January 15, 2024 or Jan 15 2024
  /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/gi,
  // Written reversed: 15 January 2024
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+(\d{4}))?\b/gi,
]

// Time patterns
const TIME_PATTERNS = [
  // 24-hour: 14:30, 14:30:00
  /\b([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/g,
  // 12-hour: 2:30 PM, 2:30pm
  /\b(1[0-2]|0?[1-9]):([0-5]\d)(?::([0-5]\d))?\s*(am|pm|AM|PM)\b/g,
]

// Relative date patterns
const RELATIVE_PATTERNS = [
  /\b(today|tomorrow|yesterday)\b/gi,
  /\b(next|last|this)\s+(week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,
  /\b(\d+)\s+(days?|weeks?|months?|years?)\s+(ago|from now|later)\b/gi,
]

const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

/**
 * Parse month name to number
 */
function parseMonth(str: string): number {
  return MONTHS[str.toLowerCase()] ?? 0
}

/**
 * Normalize year (handle 2-digit years)
 */
function normalizeYear(year: string | undefined): number | undefined {
  if (!year) return undefined
  const num = parseInt(year, 10)
  if (num < 100) {
    return num > 50 ? 1900 + num : 2000 + num
  }
  return num
}

export type DateTimePluginOptions = {
  /**
   * Detect dates (default: true)
   */
  dates?: boolean
  /**
   * Detect times (default: true)
   */
  times?: boolean
  /**
   * Detect relative dates like "tomorrow" (default: true)
   */
  relative?: boolean
  /**
   * Minimum confidence (default: 0.85)
   */
  minConfidence?: number
}

/**
 * Creates a datetime detection plugin
 */
export function datetime(options: DateTimePluginOptions = {}): Plugin {
  const {
    dates = true,
    times = true,
    relative = true,
    minConfidence = 0.85,
  } = options

  return {
    name: 'datetime',
    mode: 'realtime',
    priority: 20,

    run({ window, mode }) {
      const candidates: EntityCandidate[] = []
      const text = window.text

      // Process date patterns
      if (dates) {
        for (const pattern of DATE_PATTERNS) {
          // Reset regex state
          pattern.lastIndex = 0
          let match

          while ((match = pattern.exec(text)) !== null) {
            const fullMatch = match[0]
            const start = window.offset + match.index
            const end = start + fullMatch.length

            let value: Record<string, unknown> = { raw: fullMatch, type: 'date' }

            // Try to parse the date
            if (fullMatch.includes('-')) {
              // ISO format
              value = {
                ...value,
                year: parseInt(match[1], 10),
                month: parseInt(match[2], 10),
                day: parseInt(match[3], 10),
                format: 'iso',
              }
            } else if (fullMatch.includes('/')) {
              // US format
              value = {
                ...value,
                month: parseInt(match[1], 10),
                day: parseInt(match[2], 10),
                year: normalizeYear(match[3]),
                format: 'us',
              }
            } else if (/[A-Za-z]/.test(fullMatch)) {
              // Written format
              if (/^\d/.test(match[1])) {
                // Day first: "15 January 2024"
                value = {
                  ...value,
                  day: parseInt(match[1], 10),
                  month: parseMonth(match[2]),
                  year: normalizeYear(match[3]),
                  format: 'written',
                }
              } else {
                // Month first: "January 15, 2024"
                value = {
                  ...value,
                  month: parseMonth(match[1]),
                  day: parseInt(match[2], 10),
                  year: normalizeYear(match[3]),
                  format: 'written',
                }
              }
            }

            candidates.push({
              key: `datetime:date:${start}:${end}`,
              kind: 'datetime',
              span: { start, end },
              text: fullMatch,
              value,
              confidence: minConfidence + 0.1,
              status: mode === 'commit' ? 'confirmed' : 'provisional',
            })
          }
        }
      }

      // Process time patterns
      if (times) {
        for (const pattern of TIME_PATTERNS) {
          pattern.lastIndex = 0
          let match

          while ((match = pattern.exec(text)) !== null) {
            const fullMatch = match[0]
            const start = window.offset + match.index
            const end = start + fullMatch.length

            const hour = parseInt(match[1], 10)
            const minute = parseInt(match[2], 10)
            const second = match[3] ? parseInt(match[3], 10) : undefined
            const meridiem = match[4]?.toLowerCase()

            let hour24 = hour
            if (meridiem === 'pm' && hour !== 12) hour24 += 12
            if (meridiem === 'am' && hour === 12) hour24 = 0

            candidates.push({
              key: `datetime:time:${start}:${end}`,
              kind: 'datetime',
              span: { start, end },
              text: fullMatch,
              value: {
                raw: fullMatch,
                type: 'time',
                hour: hour24,
                minute,
                second,
                format: meridiem ? '12h' : '24h',
              },
              confidence: minConfidence + 0.05,
              status: mode === 'commit' ? 'confirmed' : 'provisional',
            })
          }
        }
      }

      // Process relative patterns
      if (relative) {
        for (const pattern of RELATIVE_PATTERNS) {
          pattern.lastIndex = 0
          let match

          while ((match = pattern.exec(text)) !== null) {
            const fullMatch = match[0]
            const start = window.offset + match.index
            const end = start + fullMatch.length

            candidates.push({
              key: `datetime:relative:${start}:${end}`,
              kind: 'datetime',
              span: { start, end },
              text: fullMatch,
              value: {
                raw: fullMatch,
                type: 'relative',
              },
              confidence: minConfidence,
              status: mode === 'commit' ? 'confirmed' : 'provisional',
            })
          }
        }
      }

      return { upsert: candidates }
    },
  }
}
