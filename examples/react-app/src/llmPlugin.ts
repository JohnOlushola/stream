/**
 * LLM plugin for Stream (React example)
 * Runs on commit only. Calls an OpenAI-compatible API to extract entities.
 * Set VITE_OPENAI_API_KEY to enable.
 *
 * Validation: we expect a JSON array of { start, end, kind, text }.
 * - Option 1 (OpenAI): response_format with json_schema so the API returns the shape we want.
 * - Option 2 (all): validate each item in code (type + bounds); invalid items are dropped.
 */

import type { Plugin, PluginContext, PluginResult, EntityCandidate, EntityKind } from 'streamsense'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const API_BASE = (import.meta.env.VITE_OPENAI_API_BASE as string) || 'https://api.openai.com/v1'
const IS_OPENAI = !import.meta.env.VITE_OPENAI_API_BASE

const LLM_KINDS = [
  'quantity',
  'datetime',
  'email',
  'url',
  'phone',
  'person',
  'place',
  'organization',
  'topic',
] as const

/** OpenAI Structured Outputs require root type: "object". We use { entities: [...] }. */
const LLM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          start: { type: 'integer', description: 'Character index (inclusive)' },
          end: { type: 'integer', description: 'Character index (exclusive)' },
          kind: {
            type: 'string',
            enum: [...LLM_KINDS],
            description: 'Entity type',
          },
          text: { type: 'string', description: 'Exact substring of the input text' },
        },
        required: ['start', 'end', 'kind', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['entities'],
  additionalProperties: false,
} as const
type LlmKind = (typeof LLM_KINDS)[number]

/** Shape we expect from the LLM (and validate against) */
export type LlmEntity = {
  start: number
  end: number
  kind: LlmKind
  text: string
}

const STREAM_ENTITY_KINDS: EntityKind[] = [
  'quantity',
  'datetime',
  'email',
  'url',
  'phone',
  'person',
  'place',
  'custom',
]

function toEntityKind(s: string): EntityKind {
  const lower = s?.toLowerCase()
  if (STREAM_ENTITY_KINDS.includes(lower as EntityKind)) return lower as EntityKind
  return 'custom'
}

/**
 * Validates a single item from the LLM response. Returns a valid LlmEntity or null.
 * Ensures: correct types, start/end within text bounds, start < end, kind in allowed set.
 */
export function validateLlmEntity(
  item: unknown,
  textLength: number
): LlmEntity | null {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return null
  const o = item as Record<string, unknown>
  const start = typeof o.start === 'number' ? o.start : Number(o.start)
  const end = typeof o.end === 'number' ? o.end : Number(o.end)
  const kind = typeof o.kind === 'string' ? o.kind.trim().toLowerCase() : ''
  const text = typeof o.text === 'string' ? o.text : ''
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > textLength ||
    start >= end ||
    !LLM_KINDS.includes(kind as LlmKind)
  )
    return null
  return { start, end, kind: kind as LlmKind, text }
}

const SYSTEM_PROMPT = `You are a precise entity extractor. Extract every entity from the user's text that matches the kinds below. Your output must be a JSON object with a single key "entities" whose value is an array of objects. Each object has: "start" (0-based character index of the first character), "end" (0-based index immediately after the last character), "kind" (exactly one of the kinds listed), "text" (the exact substring of the input—character-for-character).

Kinds to extract (use context to disambiguate):
- quantity: Numbers with optional units (e.g. 10 km, 5.5 kg, $50, 2 hours, 100%, 3.14). Include the unit if present.
- datetime: Dates, times, and relative references (e.g. Jan 15, 2025-03-04, tomorrow, 3pm, next Tuesday, 9:00 AM).
- email: Email addresses (e.g. john@example.com).
- url: URLs and web addresses (e.g. https://example.com, example.com/page).
- phone: Phone numbers in any format (e.g. +1 555-123-4567, (555) 123 4567, 555.123.4567).
- person: Full or partial person names, titles+names (e.g. Dr. Chen, Sarah, Mike).
- place: Locations, addresses, cities, countries, venues (e.g. London, Singapore, Hyde Park, 123 Main St).
- organization: Companies, teams, institutions (e.g. Acme Corp, the design team, MIT).
- topic: Subjects, events, activities, or things being discussed (e.g. Q3 budget, 10km run, the project).

Rules:
- start and end must be valid indices into the user's text; text must equal the substring from start to end.
- Extract every occurrence; do not merge or skip. Overlapping spans are allowed only if they represent different entities (e.g. "10 km" as quantity and "10 km run" as topic).
- If nothing matches, return {"entities":[]}.
- Use only the user's text—no hallucinated content.`

export function createLlmPlugin(): Plugin {
  return {
    name: 'llm',
    mode: 'commit',
    priority: 200, // after built-in plugins

    async run(ctx: PluginContext): Promise<PluginResult> {
      if (!API_KEY || !ctx.text.trim()) return { upsert: [] }

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: ctx.text },
      ]

      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            max_tokens: 1024,
            temperature: 0,
            ...(IS_OPENAI && {
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'llm_entities',
                  strict: true,
                  schema: LLM_RESPONSE_SCHEMA,
                },
              },
            }),
          }),
        })

        if (!res.ok) {
          const err = await res.text()
          console.warn('[llm-plugin] API error:', res.status, err)
          return { upsert: [] }
        }

        const data = await res.json()
        const content = data?.choices?.[0]?.message?.content?.trim() ?? ''
        const raw = content.replace(/^```\w*\n?|\n?```$/g, '').trim()
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          console.warn('[llm-plugin] Invalid JSON from API')
          return { upsert: [] }
        }
        const arr = Array.isArray(parsed)
          ? parsed
          : typeof parsed === 'object' && parsed !== null && 'entities' in parsed && Array.isArray((parsed as { entities: unknown[] }).entities)
            ? (parsed as { entities: unknown[] }).entities
            : []
        if (arr.length === 0) return { upsert: [] }

        const textLen = ctx.text.length
        const upsert: EntityCandidate[] = []
        for (const item of arr) {
          const validated = validateLlmEntity(item, textLen)
          if (!validated) continue
          const { start, end, kind, text } = validated
          const textSlice = text || ctx.text.slice(start, end)
          const entityKind = toEntityKind(kind)
          const key = `llm:${entityKind}:${start}:${end}:${textSlice}`
          upsert.push({
            key,
            kind: entityKind,
            span: { start, end },
            text: textSlice,
            value: { source: 'llm', rawKind: kind },
            confidence: 0.85,
            status: 'confirmed',
          })
        }
        return { upsert }
      } catch (e) {
        console.warn('[llm-plugin]', e)
        return { upsert: [] }
      }
    },
  }
}
