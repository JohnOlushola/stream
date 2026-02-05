import { useState, useCallback, useRef } from 'react'
import { useStreamSense } from './hooks/useStreamSense'

const ENTITY_STYLES: Record<string, string> = {
  quantity: 'bg-blue-500/25 shadow-[0_2px_0_#3b82f6]',
  email: 'bg-green-500/25 shadow-[0_2px_0_#22c55e]',
  datetime: 'bg-yellow-500/25 shadow-[0_2px_0_#eab308]',
  url: 'bg-purple-500/25 shadow-[0_2px_0_#a855f7]',
  phone: 'bg-pink-500/25 shadow-[0_2px_0_#ec4899]',
}

const LEGEND = [
  { kind: 'quantity', color: 'bg-blue-500', label: 'Quantity' },
  { kind: 'email', color: 'bg-green-500', label: 'Email' },
  { kind: 'datetime', color: 'bg-yellow-500', label: 'DateTime' },
  { kind: 'url', color: 'bg-purple-500', label: 'URL' },
  { kind: 'phone', color: 'bg-pink-500', label: 'Phone' },
]

export default function App() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const { entities, feed, commit } = useStreamSense()

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value
      setText(newText)
      feed(newText, e.target.selectionStart)
    },
    [feed]
  )

  const handleScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        commit()
      }
    },
    [commit]
  )

  // Build highlighted content
  const renderHighlights = () => {
    if (!text) return null
    if (entities.length === 0) return text

    const segments: React.ReactNode[] = []
    let lastIndex = 0

    for (const entity of entities) {
      if (entity.span.start > lastIndex) {
        segments.push(text.slice(lastIndex, entity.span.start))
      }
      segments.push(
        <span
          key={entity.id}
          className={`rounded-sm ${ENTITY_STYLES[entity.kind] || ''}`}
        >
          {entity.text}
        </span>
      )
      lastIndex = entity.span.end
    }

    if (lastIndex < text.length) {
      segments.push(text.slice(lastIndex))
    }

    return segments
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[#0a0a0a]">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
            StreamSense
          </h1>
          <p className="text-neutral-500 text-sm">
            Real-time semantic understanding from streaming text
          </p>
        </header>

        {/* Input with highlighting */}
        <div className="relative border border-neutral-800 rounded-xl bg-neutral-900/50 overflow-hidden focus-within:border-neutral-700 transition-colors">
          {/* Backdrop for highlights */}
          <div
            ref={backdropRef}
            className="absolute inset-0 p-5 text-lg leading-7 whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-transparent"
          >
            {renderHighlights()}
          </div>

          {/* Actual textarea */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            placeholder="Try: Meeting with john@example.com on Jan 15 about the 10km race..."
            spellCheck={false}
            className="relative w-full min-h-[200px] p-5 text-lg leading-7 bg-transparent text-neutral-200 placeholder-neutral-600 resize-none outline-none caret-neutral-200"
          />
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-5 mt-6 flex-wrap">
          {LEGEND.map(({ kind, color, label }) => (
            <div key={kind} className="flex items-center gap-1.5 text-sm text-neutral-500">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
