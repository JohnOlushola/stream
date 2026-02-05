/**
 * URL Plugin
 * Detects URLs in text
 */

import type { Plugin, EntityCandidate } from '../types.js'

// URL regex that matches http(s) URLs and www URLs
const URL_REGEX = /\b(?:https?:\/\/|www\.)[^\s<>\[\]{}|\\^`"']+/gi

// Common TLDs for validation
const COMMON_TLDS = [
  'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'uk', 'de', 'fr', 'jp',
  'au', 'ca', 'ru', 'br', 'in', 'it', 'nl', 'es', 'ch', 'se', 'no', 'fi',
  'dev', 'app', 'tech', 'ai', 'me', 'info', 'biz',
]

/**
 * Clean trailing punctuation from URL
 */
function cleanUrl(url: string): string {
  // Remove trailing punctuation that's likely not part of the URL
  return url.replace(/[.,;:!?)]+$/, '')
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    // Add protocol if missing for URL parsing
    const urlWithProtocol = url.startsWith('http') ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)
    return parsed.hostname
  } catch {
    return null
  }
}

/**
 * Extract TLD from domain
 */
function extractTld(domain: string): string {
  const parts = domain.split('.')
  return parts[parts.length - 1].toLowerCase()
}

export type UrlPluginOptions = {
  /**
   * Minimum confidence (default: 0.9)
   */
  minConfidence?: number
  /**
   * Require protocol (http/https) (default: false)
   */
  requireProtocol?: boolean
}

/**
 * Creates a URL detection plugin
 */
export function url(options: UrlPluginOptions = {}): Plugin {
  const { minConfidence = 0.9, requireProtocol = false } = options

  return {
    name: 'url',
    mode: 'realtime',
    priority: 35,

    run({ window, mode }) {
      const candidates: EntityCandidate[] = []
      const text = window.text

      URL_REGEX.lastIndex = 0
      let match

      while ((match = URL_REGEX.exec(text)) !== null) {
        let fullMatch = cleanUrl(match[0])
        const matchIndex = match.index
        const start = window.offset + matchIndex
        const end = start + fullMatch.length

        // Skip if requiring protocol and none present
        if (requireProtocol && !fullMatch.startsWith('http')) {
          continue
        }

        // Extract and validate domain
        const domain = extractDomain(fullMatch)
        if (!domain) continue

        const tld = extractTld(domain)

        // Calculate confidence
        let confidence = minConfidence

        // Boost for https
        if (fullMatch.startsWith('https://')) {
          confidence += 0.03
        }

        // Boost for common TLDs
        if (COMMON_TLDS.includes(tld)) {
          confidence += 0.02
        }

        // Penalty for very long URLs (might be false positive)
        if (fullMatch.length > 200) {
          confidence -= 0.1
        }

        // Penalty for URLs with unusual characters
        if (/[<>{}|\\^`]/.test(fullMatch)) {
          confidence -= 0.2
        }

        confidence = Math.min(Math.max(confidence, 0), 1)

        // Normalize URL for value
        const normalizedUrl = fullMatch.startsWith('http')
          ? fullMatch
          : `https://${fullMatch}`

        candidates.push({
          key: `url:${domain}:${start}:${end}`,
          kind: 'url',
          span: { start, end },
          text: fullMatch,
          value: {
            url: normalizedUrl,
            domain,
            tld,
            hasProtocol: fullMatch.startsWith('http'),
            isSecure: fullMatch.startsWith('https'),
          },
          confidence,
          status: mode === 'commit' ? 'confirmed' : 'provisional',
        })
      }

      return { upsert: candidates }
    },
  }
}
