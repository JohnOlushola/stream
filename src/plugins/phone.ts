/**
 * Phone Plugin
 * Detects phone numbers in text
 */

import type { Plugin, EntityCandidate } from '../types.js'

// Phone number patterns for various formats
const PHONE_PATTERNS = [
  // International: +1 234 567 8900, +44 20 7123 4567
  /\+\d{1,3}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}[\s.-]?\d{0,4}/g,
  // US/Canada: (123) 456-7890, 123-456-7890, 123.456.7890
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
  // UK: 020 7123 4567, 07700 900123
  /\b0\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b/g,
]

// Country codes for validation
const COUNTRY_CODES = [
  '1',    // US, Canada
  '44',   // UK
  '49',   // Germany
  '33',   // France
  '81',   // Japan
  '86',   // China
  '91',   // India
  '61',   // Australia
  '55',   // Brazil
  '7',    // Russia
  '34',   // Spain
  '39',   // Italy
]

/**
 * Normalize phone number (remove formatting)
 */
function normalizePhone(phone: string): string {
  return phone.replace(/[\s.()\-]/g, '')
}

/**
 * Check if a string is likely a phone number
 */
function isLikelyPhone(str: string): boolean {
  const normalized = normalizePhone(str)
  const digitsOnly = normalized.replace(/\D/g, '')

  // Phone numbers typically have 7-15 digits
  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return false
  }

  // Avoid matching years, zip codes, etc.
  // Years: 1900-2099
  if (/^(19|20)\d{2}$/.test(digitsOnly)) {
    return false
  }

  return true
}

/**
 * Detect country from phone number
 */
function detectCountry(phone: string): string | null {
  const normalized = normalizePhone(phone)

  if (normalized.startsWith('+')) {
    for (const code of COUNTRY_CODES) {
      if (normalized.startsWith(`+${code}`)) {
        return code
      }
    }
  }

  // US/Canada detection (10 digits, area code patterns)
  const digits = normalized.replace(/\D/g, '')
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))) {
    return '1'
  }

  return null
}

export type PhonePluginOptions = {
  /**
   * Minimum confidence (default: 0.85)
   */
  minConfidence?: number
  /**
   * Country codes to prioritize (increases confidence)
   */
  preferredCountries?: string[]
}

/**
 * Creates a phone number detection plugin
 */
export function phone(options: PhonePluginOptions = {}): Plugin {
  const { minConfidence = 0.85, preferredCountries = ['1', '44'] } = options

  return {
    name: 'phone',
    mode: 'realtime',
    priority: 40,

    run({ window, mode }) {
      const candidates: EntityCandidate[] = []
      const text = window.text
      const seenSpans = new Set<string>()

      for (const pattern of PHONE_PATTERNS) {
        pattern.lastIndex = 0
        let match

        while ((match = pattern.exec(text)) !== null) {
          const fullMatch = match[0].trim()
          const start = window.offset + match.index
          const end = start + fullMatch.length
          const spanKey = `${start}:${end}`

          // Skip duplicates (patterns may overlap)
          if (seenSpans.has(spanKey)) continue
          seenSpans.add(spanKey)

          // Validate
          if (!isLikelyPhone(fullMatch)) continue

          const normalized = normalizePhone(fullMatch)
          const digitsOnly = normalized.replace(/\D/g, '')
          const country = detectCountry(fullMatch)

          // Calculate confidence
          let confidence = minConfidence

          // Boost for international format
          if (fullMatch.startsWith('+')) {
            confidence += 0.05
          }

          // Boost for preferred countries
          if (country && preferredCountries.includes(country)) {
            confidence += 0.03
          }

          // Boost for formatted numbers (more likely intentional)
          if (/[\s.\-()]/.test(fullMatch)) {
            confidence += 0.02
          }

          // Penalty for very short numbers
          if (digitsOnly.length < 10) {
            confidence -= 0.05
          }

          confidence = Math.min(Math.max(confidence, 0), 1)

          candidates.push({
            key: `phone:${digitsOnly}:${start}:${end}`,
            kind: 'phone',
            span: { start, end },
            text: fullMatch,
            value: {
              phone: normalized,
              digits: digitsOnly,
              country,
              formatted: fullMatch,
              isInternational: fullMatch.startsWith('+'),
            },
            confidence,
            status: mode === 'commit' ? 'confirmed' : 'provisional',
          })
        }
      }

      return { upsert: candidates }
    },
  }
}
