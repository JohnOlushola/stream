/**
 * Email Plugin
 * Detects email addresses in text
 */

import type { Plugin, EntityCandidate } from '../types.js'

// RFC 5322 compliant email regex (simplified)
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

// Common email domains for confidence boosting
const COMMON_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'protonmail.com',
  'mail.com',
  'aol.com',
  'live.com',
  'msn.com',
]

// Common TLDs
const COMMON_TLDS = ['com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'uk', 'de', 'fr', 'jp', 'au', 'ca']

export type EmailPluginOptions = {
  /**
   * Minimum confidence (default: 0.9)
   */
  minConfidence?: number
}

/**
 * Creates an email detection plugin
 */
export function email(options: EmailPluginOptions = {}): Plugin {
  const { minConfidence = 0.9 } = options

  return {
    name: 'email',
    mode: 'realtime',
    priority: 30,

    run({ window, mode }) {
      const candidates: EntityCandidate[] = []
      const text = window.text

      EMAIL_REGEX.lastIndex = 0
      let match

      while ((match = EMAIL_REGEX.exec(text)) !== null) {
        const fullMatch = match[0]
        const start = window.offset + match.index
        const end = start + fullMatch.length

        // Parse email parts
        const [localPart, domain] = fullMatch.split('@')
        const tld = domain.split('.').pop()?.toLowerCase() ?? ''

        // Calculate confidence
        let confidence = minConfidence

        // Boost for common domains
        if (COMMON_DOMAINS.includes(domain.toLowerCase())) {
          confidence += 0.05
        }

        // Boost for common TLDs
        if (COMMON_TLDS.includes(tld)) {
          confidence += 0.02
        }

        // Slight penalty for very short local parts
        if (localPart.length < 3) {
          confidence -= 0.05
        }

        // Penalty for excessive dots or special chars
        if ((localPart.match(/\./g) || []).length > 2) {
          confidence -= 0.03
        }

        confidence = Math.min(Math.max(confidence, 0), 1)

        candidates.push({
          key: `email:${fullMatch.toLowerCase()}:${start}:${end}`,
          kind: 'email',
          span: { start, end },
          text: fullMatch,
          value: {
            email: fullMatch.toLowerCase(),
            localPart,
            domain: domain.toLowerCase(),
            tld,
          },
          confidence,
          status: mode === 'commit' ? 'confirmed' : 'provisional',
        })
      }

      return { upsert: candidates }
    },
  }
}
