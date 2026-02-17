import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createRecognizer, plugins, type Entity, type Recognizer } from 'streamsense'
import { createLlmPlugin } from './llmPlugin'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import { StreamEditor } from '@/components/StreamEditor'
import { cn } from '@/lib/utils'

const KIND_COLORS: Record<string, string> = {
  quantity: 'bg-blue-500',
  email: 'bg-green-500',
  datetime: 'bg-yellow-500',
  url: 'bg-purple-500',
  phone: 'bg-pink-500',
  person: 'bg-amber-500',
  place: 'bg-teal-500',
  custom: 'bg-slate-500',
}

type EventLog = {
  id: number
  type: 'entity' | 'remove' | 'diagnostic'
  action: string
  detail: string
  time: string
}

type RecognizerMode = 'regex' | 'llm' | 'all'
type LlmTiming = 'commit' | 'realtime'

// Keep events in a ref to avoid re-renders, sync to state periodically
const MAX_EVENTS = 100

export default function App() {
  const [text, setText] = useState('')
  const [entities, setEntities] = useState<Entity[]>([])
  const [events, setEvents] = useState<EventLog[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [recognizerMode, setRecognizerMode] = useState<RecognizerMode>('all')
  const [llmTiming, setLlmTiming] = useState<LlmTiming>('commit')
  const [windowSize, setWindowSize] = useState(500)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const recognizerRef = useRef<Recognizer | null>(null)
  const textRef = useRef(text)
  textRef.current = text

  // Use refs for mutable state that doesn't need to trigger renders immediately
  const entitiesMapRef = useRef<Map<string, Entity>>(new Map())
  const eventsRef = useRef<EventLog[]>([])
  const eventIdRef = useRef(0)
  const eventCountRef = useRef(0)
  const updateScheduledRef = useRef(false)

  // Schedule a batched UI update
  const scheduleUpdate = useCallback(() => {
    if (updateScheduledRef.current) return
    updateScheduledRef.current = true
    
    requestAnimationFrame(() => {
      updateScheduledRef.current = false
      
      // Sync refs to state
      const entityList = Array.from(entitiesMapRef.current.values())
        .sort((a, b) => a.span.start - b.span.start)
      
      setEntities(entityList)
      setEvents([...eventsRef.current])
      setEventCount(eventCountRef.current)
    })
  }, [])

  // Recreate recognizer when regex toggle changes; re-feed current text
  useEffect(() => {
    const logEvent = (type: EventLog['type'], action: string, detail: string) => {
      const time = new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      eventsRef.current = [
        { id: eventIdRef.current++, type, action, detail, time },
        ...eventsRef.current.slice(0, MAX_EVENTS - 1),
      ]
      eventCountRef.current++
    }

    const regexPlugins = [
      plugins.quantity(),
      plugins.email(),
      plugins.datetime(),
      plugins.url(),
      plugins.phone(),
    ]
    const llmPlugin =
      recognizerMode === 'regex'
        ? null
        : createLlmPlugin({ mode: llmTiming, streaming: true })

    const pluginList =
      recognizerMode === 'regex'
        ? regexPlugins
        : recognizerMode === 'llm'
          ? [llmPlugin!]
          : [...regexPlugins, llmPlugin!]

    const useRealtimeLlm = (recognizerMode === 'llm' || recognizerMode === 'all') && llmTiming === 'realtime'
    const recognizer = createRecognizer({
      plugins: pluginList,
      windowSize,
      schedule: {
        realtimeMs: useRealtimeLlm ? 400 : 100,
        commitAfterMs: 600,
      },
    })

    recognizer.on('entity', (e) => {
      entitiesMapRef.current.set(e.entity.id, e.entity)
      logEvent('entity', e.isUpdate ? 'update' : 'add', e.entity.text)
      scheduleUpdate()
    })

    recognizer.on('remove', (e) => {
      const entity = entitiesMapRef.current.get(e.id)
      if (entity) {
        logEvent('remove', 'remove', entity.text)
        entitiesMapRef.current.delete(e.id)
        scheduleUpdate()
      }
    })

    recognizer.on('diagnostic', (e) => {
      if (e.severity !== 'info') {
        logEvent('diagnostic', e.severity, e.message)
        scheduleUpdate()
      }
    })

    recognizerRef.current = recognizer

    // Re-feed current text so the new recognizer state matches (StreamEditor will have called onFeed with latest)
    const currentText = textRef.current
    if (currentText) {
      recognizer.feed({ text: currentText, cursor: currentText.length })
      if ((recognizerMode === 'llm' || recognizerMode === 'all') && llmTiming === 'commit')
        recognizer.commit('manual')
    }

    return () => {
      recognizer.destroy()
      recognizerRef.current = null
      entitiesMapRef.current.clear()
      eventsRef.current = []
      eventCountRef.current = 0
      scheduleUpdate()
    }
  }, [scheduleUpdate, recognizerMode, llmTiming, windowSize])

  const handleFeed = useCallback((params: { text: string; cursor: number }) => {
    setText(params.text)
    recognizerRef.current?.feed({
      text: params.text,
      cursor: params.cursor,
    })
  }, [])

  const handleCommit = useCallback(() => {
    recognizerRef.current?.commit('enter')
  }, [])

  const confirmedCount = useMemo(
    () => entities.filter(e => e.status === 'confirmed').length,
    [entities]
  )

  return (
    <div className="flex h-screen w-full min-w-0 bg-[#0a0a0a] overflow-hidden">
      {/* Main: full-height, full-width editor; min-w-0 so it can shrink and sidebar stays on screen */}
      <main className="flex-1 flex min-w-0 flex-col min-h-0">
        <div className="flex-1 min-h-0 min-w-0 w-full border-r border-neutral-800 focus-within:ring-1 focus-within:ring-neutral-700 focus-within:ring-inset stream-editor relative">
          <StreamEditor
            initialText={text}
            onFeed={handleFeed}
            entities={entities}
            placeholder="Try: Meeting with john@example.com on Jan 15 about the 10km race..."
            className="h-full w-full min-h-0"
          />
          {/* Floating submit button */}
          <div className="absolute bottom-4 right-4 z-10">
            <Button
              onClick={handleCommit}
              className="bg-neutral-200 text-neutral-900 hover:bg-neutral-300 shadow-lg"
              size="default"
            >
              Submit
            </Button>
          </div>
        </div>
      </main>

      {/* Sidebar: minimizable, flex-shrink-0 so it never gets pushed off */}
      <aside
        className={cn(
          'flex-shrink-0 bg-[#111] border-l border-neutral-800 flex flex-col overflow-hidden transition-[width] duration-200',
          sidebarOpen ? 'w-80' : 'w-12'
        )}
      >
        {/* Toggle */}
        <div className="p-2 border-b border-neutral-800 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <span className="text-neutral-400">‹</span>
            ) : (
              <span className="text-neutral-400">›</span>
            )}
          </Button>
        </div>

        {sidebarOpen && (
          <>
            {/* Settings (Regex / LLM / All) — shadcn Toggle Group on top */}
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                Settings
              </h2>
              <ToggleGroup
                type="single"
                value={recognizerMode}
                onValueChange={(v) => v && setRecognizerMode(v as RecognizerMode)}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <ToggleGroupItem value="regex" aria-label="Regex only" className="flex-1">
                  Regex
                </ToggleGroupItem>
                <ToggleGroupItem value="llm" aria-label="LLM only" className="flex-1">
                  LLM
                </ToggleGroupItem>
                <ToggleGroupItem value="all" aria-label="All" className="flex-1">
                  All
                </ToggleGroupItem>
              </ToggleGroup>
              {(recognizerMode === 'llm' || recognizerMode === 'all') && (
                <>
                  <p className="text-[0.65rem] text-neutral-500 mt-2 mb-1">LLM when</p>
                  <ToggleGroup
                    type="single"
                    value={llmTiming}
                    onValueChange={(v) => v && setLlmTiming(v as LlmTiming)}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <ToggleGroupItem value="commit" aria-label="On commit" className="flex-1">
                      Commit
                    </ToggleGroupItem>
                    <ToggleGroupItem value="realtime" aria-label="Realtime" className="flex-1">
                      Realtime
                    </ToggleGroupItem>
                  </ToggleGroup>
                </>
              )}
              <p className="text-[0.65rem] text-neutral-600 mt-1.5">
                {recognizerMode === 'regex' && 'Quantity, email, date, URL, phone'}
                {recognizerMode === 'llm' && (llmTiming === 'commit' ? 'LLM on commit' : 'LLM on window (debounced)')}
                {recognizerMode === 'all' && (llmTiming === 'commit' ? 'Regex + LLM on commit' : 'Regex + LLM on window')}
              </p>
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <label className="text-[0.65rem] text-neutral-500 mb-1.5 block">Window size (chars)</label>
                <input
                  type="number"
                  min="100"
                  max="2000"
                  step="50"
                  value={windowSize}
                  onChange={(e) => setWindowSize(Math.max(100, Math.min(2000, parseInt(e.target.value) || 500)))}
                  className="w-full px-2 py-1.5 bg-neutral-900 border border-neutral-700 rounded text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-500"
                />
                <p className="text-[0.6rem] text-neutral-600 mt-1">
                  Cursor-centered analysis window ({windowSize} chars)
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                Metrics
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Characters" value={text.length} />
                <Metric label="Entities" value={entities.length} />
                <Metric label="Confirmed" value={confirmedCount} />
                <Metric label="Events" value={eventCount} />
              </div>
            </div>

            {/* Current Entities */}
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                Current Entities
              </h2>
              <div className="max-h-44 overflow-y-auto space-y-1.5">
                {entities.length === 0 ? (
                  <p className="text-neutral-600 text-xs italic">No entities detected</p>
                ) : (
                  entities.map(entity => (
                    <EntityItem key={entity.id} entity={entity} />
                  ))
                )}
              </div>
            </div>

            {/* Event Stream */}
            <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-0">
              <h2 className="text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-600 mb-3">
                Event Stream
              </h2>
              <div className="flex-1 overflow-y-auto space-y-1 font-mono text-[0.65rem]">
                {events.map(event => (
                  <EventItem key={event.id} event={event} />
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}

// Memoized components to prevent unnecessary re-renders
const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-neutral-900 rounded-lg p-3 text-center">
    <div className="text-xl font-semibold text-neutral-200 tabular-nums">{value}</div>
    <div className="text-[0.6rem] text-neutral-500 uppercase tracking-wide">{label}</div>
  </div>
)

const EntityItem = ({ entity }: { entity: Entity }) => (
  <div className="flex items-center gap-2 p-2 bg-neutral-900 rounded-md text-xs">
    <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-semibold uppercase text-white ${KIND_COLORS[entity.kind]}`}>
      {entity.kind}
    </span>
    <span className="flex-1 truncate text-neutral-300">{entity.text}</span>
    <span className="text-neutral-600 tabular-nums">{Math.round(entity.confidence * 100)}%</span>
  </div>
)

const EventItem = ({ event }: { event: EventLog }) => (
  <div className="flex gap-2 p-1.5 bg-neutral-900 rounded items-start">
    <span className="text-neutral-600 shrink-0">{event.time}</span>
    <span className={`font-semibold shrink-0 ${
      event.type === 'entity' ? 'text-green-500' :
      event.type === 'remove' ? 'text-red-500' :
      'text-yellow-500'
    }`}>
      {event.action}
    </span>
    <span className="text-neutral-500 truncate">{event.detail}</span>
  </div>
)
