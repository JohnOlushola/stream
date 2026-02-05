import { useState, useCallback, useRef, useEffect } from 'react'
import { useStreamSense } from './hooks/useStreamSense'
import { EntityCard } from './components/EntityCard'
import { HighlightedText } from './components/HighlightedText'

const EXAMPLE_TEXTS = [
  'Meeting with john@example.com on Jan 15 about the 10km race. Details at https://example.com',
  'Convert 10 km to miles. The price is $50.99 per unit. Deadline: 2024-03-15 at 14:30',
  'Call me at +1 (555) 123-4567 or email support@company.io. Ship 5kg package for €25.',
]

function App() {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { entities, feed, commit, clear, isReady } = useStreamSense()

  // Feed text to recognizer on change
  useEffect(() => {
    if (isReady) {
      const cursor = textareaRef.current?.selectionStart ?? text.length
      feed(text, cursor)
    }
  }, [text, isReady, feed])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
    },
    []
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commit()
      }
    },
    [commit]
  )

  const handleClear = useCallback(() => {
    setText('')
    clear()
  }, [clear])

  const handleExample = useCallback((example: string) => {
    setText(example)
  }, [])

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            StreamSense
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time semantic understanding from streaming text
          </p>
        </header>

        {/* Input Section */}
        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">
            Type something with quantities, emails, dates, or URLs:
          </label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Try: 'Meeting with john@example.com on Jan 15 about the 10km race...'"
            rows={4}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={commit}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-blue-600 hover:border-blue-600 transition-colors"
            >
              Commit (Enter)
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white hover:bg-red-600 hover:border-red-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Example Buttons */}
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_TEXTS.map((example, index) => (
              <button
                key={index}
                onClick={() => handleExample(example)}
                className="px-3 py-1.5 text-sm bg-gray-800/50 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors truncate max-w-xs"
              >
                {example.slice(0, 40)}...
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Entities Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-800">
              Detected Entities ({entities.length})
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {entities.length === 0 ? (
                <p className="text-gray-500 italic">
                  Start typing to detect entities...
                </p>
              ) : (
                entities.map((entity) => (
                  <EntityCard key={entity.id} entity={entity} />
                ))
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4 pb-2 border-b border-gray-800">
              Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Characters"
                value={text.length}
                color="text-blue-400"
              />
              <StatCard
                label="Entities"
                value={entities.length}
                color="text-green-400"
              />
              <StatCard
                label="Confirmed"
                value={entities.filter((e) => e.status === 'confirmed').length}
                color="text-yellow-400"
              />
              <StatCard
                label="Provisional"
                value={entities.filter((e) => e.status === 'provisional').length}
                color="text-purple-400"
              />
            </div>

            {/* Entity Type Breakdown */}
            {entities.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <h3 className="text-xs text-gray-500 uppercase mb-2">
                  By Type
                </h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    entities.reduce(
                      (acc, e) => {
                        acc[e.kind] = (acc[e.kind] || 0) + 1
                        return acc
                      },
                      {} as Record<string, number>
                    )
                  ).map(([kind, count]) => (
                    <span
                      key={kind}
                      className="px-2 py-1 bg-gray-800 rounded text-sm"
                    >
                      <span className="text-gray-400">{kind}:</span>{' '}
                      <span className="text-white font-medium">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Highlighted Text Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Highlighted Text
          </h2>
          <div className="text-lg leading-relaxed whitespace-pre-wrap">
            <HighlightedText text={text} entities={entities} />
          </div>
        </div>

        {/* Legend */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Entity Types
          </h2>
          <div className="flex flex-wrap gap-3">
            <LegendItem color="bg-blue-500" label="Quantity" />
            <LegendItem color="bg-green-500" label="Email" />
            <LegendItem color="bg-yellow-500" label="DateTime" />
            <LegendItem color="bg-purple-500" label="URL" />
            <LegendItem color="bg-pink-500" label="Phone" />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm mt-8 pt-4 border-t border-gray-800">
          StreamSense v0.1.0 - A streaming semantic engine
        </footer>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded ${color}`} />
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  )
}

export default App
