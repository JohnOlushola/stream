/**
 * LLM plugin for Stream (React example)
 * Runs on commit only. Calls an OpenAI-compatible API to extract entities.
 * Set VITE_OPENAI_API_KEY to enable.
 */

import type { Plugin, PluginContext, PluginResult, EntityCandidate, EntityKind } from 'streamsense'

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
const API_BASE = (import.meta.env.VITE_OPENAI_API_BASE as string) || 'https://api.openai.com/v1'

function toEntityKind(s: string): EntityKind {
  const lower = s?.toLowerCase()
  if (lower === 'person' || lower === 'place') return lower
  return 'custom'
}

export function createLlmPlugin(): Plugin {
  return {
    name: 'llm',
    mode: 'commit',
    priority: 200, // after built-in plugins

    async run(ctx: PluginContext): Promise<PluginResult> {
      if (!API_KEY || !ctx.text.trim()) return { upsert: [] }

      const prompt = `You are an entity extractor. Given the text below, output a JSON array of objects. Each object must have exactly: "start" (character index, number), "end" (character index, number), "kind" (one of: person, place, organization, topic), "text" (the exact substring). Use only the given text; indices must be valid. If nothing to extract, return [].
Text:
${ctx.text}

Return only the JSON array, no markdown or explanation.`

      try {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 1024,
            temperature: 0,
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
        const arr = JSON.parse(raw) as Array<{ start?: number; end?: number; kind?: string; text?: string }>

        if (!Array.isArray(arr) || arr.length === 0) return { upsert: [] }

        const upsert: EntityCandidate[] = []
        for (const item of arr) {
          const start = Number(item.start)
          const end = Number(item.end)
          if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end > ctx.text.length || start >= end) continue
          const text = typeof item.text === 'string' ? item.text : ctx.text.slice(start, end)
          const kind = toEntityKind(item.kind ?? 'custom')
          const key = `llm:${kind}:${start}:${end}:${text}`
          upsert.push({
            key,
            kind,
            span: { start, end },
            text,
            value: { source: 'llm', rawKind: item.kind },
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
