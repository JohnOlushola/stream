/**
 * LLM plugin for Stream (React example)
 * Calls an OpenAI-compatible API to extract entities.
 * Set VITE_OPENAI_API_KEY to enable.
 *
 * Options:
 * - mode: 'realtime' (window-only, cursor-aware) or 'commit' (full text). Default 'commit'.
 * - streaming: use streaming API and push entities via ctx.onEntity as they arrive. Default true.
 *
 * Realtime uses ctx.window (fixed token cost); commit uses full ctx.text.
 * Respects ctx.signal for abort when the user types again.
 */

import type { Plugin, PluginContext, PluginResult, EntityCandidate, EntityKind } from 'streamsense'

export type LlmPluginOptions = {
  /** When to run: realtime (window-only) or commit (full text). Default 'commit'. */
  mode?: 'realtime' | 'commit'
  /** Use streaming API and push entities incrementally via ctx.onEntity. Default true. */
  streaming?: boolean
}

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
 * Snap LLM span to the actual occurrence of `text` in `inputText`.
 * Fixes off-by-a-few character drift from token-based indices.
 * Prefers the occurrence whose midpoint is closest to the original (start, end).
 */
function snapSpanToText(
  inputText: string,
  start: number,
  end: number,
  text: string
): { start: number; end: number } {
  if (!text || text.length > inputText.length) return { start, end }
  const goalMid = (start + end) / 2
  let best: { start: number; end: number } | null = null
  let bestDist = Infinity
  let pos = 0
  for (;;) {
    const i = inputText.indexOf(text, pos)
    if (i === -1) break
    const j = i + text.length
    const mid = (i + j) / 2
    const dist = Math.abs(mid - goalMid)
    if (dist < bestDist) {
      bestDist = dist
      best = { start: i, end: j }
    }
    pos = i + 1
  }
  return best ?? { start, end }
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
- Use only the user's text—no hallucinated content.
- For streaming: you may output one JSON object per line (NDJSON), e.g. {"start":0,"end":4,"kind":"person","text":"John"} per line, so highlights can appear as you go. Or output a single {"entities":[...]} object.`

function buildCandidate(
  validated: LlmEntity,
  entityKind: EntityKind,
  textSlice: string
): EntityCandidate {
  const { start, end, kind } = validated
  const key = `llm:${entityKind}:${start}:${end}:${textSlice}`
  return {
    key,
    kind: entityKind,
    span: { start, end },
    text: textSlice,
    value: { source: 'llm', rawKind: kind },
    confidence: 0.85,
    status: 'confirmed',
  }
}

/** Snap span to actual text occurrence, then build candidate with global offsets. */
function buildCandidateSnapped(
  validated: LlmEntity,
  inputText: string,
  textOffset: number
): EntityCandidate {
  const { start, end, kind, text } = validated
  const snapped = snapSpanToText(inputText, start, end, text)
  const globalStart = snapped.start + textOffset
  const globalEnd = snapped.end + textOffset
  const textSlice = text || inputText.slice(snapped.start, snapped.end)
  return buildCandidate(
    { ...validated, start: globalStart, end: globalEnd },
    toEntityKind(kind),
    textSlice
  )
}

export function createLlmPlugin(options: LlmPluginOptions = {}): Plugin {
  const { mode = 'commit', streaming = true } = options

  return {
    name: 'llm',
    mode,
    priority: 200,

    async run(ctx: PluginContext): Promise<PluginResult> {
      const useWindow = ctx.mode === 'realtime'
      const inputText = useWindow ? ctx.window.text : ctx.text
      const textOffset = useWindow ? ctx.window.offset : 0

      if (!API_KEY || !inputText.trim()) return { upsert: [] }
      if (ctx.signal?.aborted) return { upsert: [] }

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: inputText },
      ]

      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          signal: ctx.signal,
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
            stream: streaming,
            ...(IS_OPENAI && !streaming && {
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

        const textLen = inputText.length
        const upsert: EntityCandidate[] = []
        const pushCandidate = (c: EntityCandidate) => {
          upsert.push(c)
          ctx.onEntity?.(c)
        }

        if (streaming && res.body) {
          const reader = res.body.getReader()
          const decoder = new TextDecoder()
          let contentAccum = ''
          let buffer = ''
          /** Process complete NDJSON lines from accumulated content; return remaining (incomplete) string */
          const processCompleteLines = (acc: string): string => {
            const lines = acc.split('\n')
            const incomplete = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                const item = JSON.parse(trimmed) as unknown
                const validated = validateLlmEntity(item, textLen)
                if (validated) {
                  pushCandidate(buildCandidateSnapped(validated, inputText, textOffset))
                }
              } catch {
                // not a complete entity line, skip
              }
            }
            return incomplete
          }
          while (true) {
            if (ctx.signal?.aborted) return { upsert }
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
              const trimmed = line.replace(/^data:\s*/, '').trim()
              if (trimmed === '[DONE]' || !trimmed) continue
              try {
                const chunk = JSON.parse(trimmed) as { choices?: Array<{ delta?: { content?: string } }> }
                const part = chunk.choices?.[0]?.delta?.content
                if (part) {
                  contentAccum += part
                  contentAccum = processCompleteLines(contentAccum)
                }
              } catch {
                // ignore malformed SSE
              }
            }
          }
          const raw = contentAccum.replace(/^```\w*\n?|\n?```$/g, '').trim()
          let arr: unknown[] = []
          try {
            const parsed = JSON.parse(raw)
            arr = Array.isArray(parsed)
              ? parsed
              : typeof parsed === 'object' && parsed !== null && 'entities' in parsed && Array.isArray((parsed as { entities: unknown[] }).entities)
                ? (parsed as { entities: unknown[] }).entities
                : []
          } catch {
            const seenKeys = new Set(upsert.map((c) => c.key))
            const ndjson = raw.split('\n').filter(Boolean)
            for (const line of ndjson) {
              try {
                const item = JSON.parse(line) as unknown
                const validated = validateLlmEntity(item, textLen)
                if (!validated) continue
                const c = buildCandidateSnapped(validated, inputText, textOffset)
                if (!seenKeys.has(c.key)) {
                  seenKeys.add(c.key)
                  pushCandidate(c)
                }
              } catch {
                // skip line
              }
            }
            return { upsert }
          }
          const seenKeys = new Set(upsert.map((c) => c.key))
          for (const item of arr) {
            const validated = validateLlmEntity(item, textLen)
            if (!validated) continue
            const c = buildCandidateSnapped(validated, inputText, textOffset)
            if (!seenKeys.has(c.key)) {
              seenKeys.add(c.key)
              pushCandidate(c)
            }
          }
          return { upsert }
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
        for (const item of arr) {
          const validated = validateLlmEntity(item, textLen)
          if (!validated) continue
          pushCandidate(buildCandidateSnapped(validated, inputText, textOffset))
        }
        return { upsert }
      } catch (e) {
        if ((e as Error).name === 'AbortError') return { upsert }
        console.warn('[llm-plugin]', e)
        return { upsert: [] }
      }
    },
  }
}
