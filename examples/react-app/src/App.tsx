import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { createRecognizer, plugins, type Entity, type Recognizer } from 'streamsense'

const ENTITY_STYLES: Record<string, string> = {
  quantity: 'bg-blue-500/25 shadow-[0_2px_0_#3b82f6]',
  email: 'bg-green-500/25 shadow-[0_2px_0_#22c55e]',
  datetime: 'bg-yellow-500/25 shadow-[0_2px_0_#eab308]',
  url: 'bg-purple-500/25 shadow-[0_2px_0_#a855f7]',
  phone: 'bg-pink-500/25 shadow-[0_2px_0_#ec4899]',
}

const KIND_COLORS: Record<string, string> = {
  quantity: 'bg-blue-500',
  email: 'bg-green-500',
  datetime: 'bg-yellow-500',
  url: 'bg-purple-500',
  phone: 'bg-pink-500',
}

const LEGEND = [
  { kind: 'quantity', label: 'Quantity' },
  { kind: 'email', label: 'Email' },
  { kind: 'datetime', label: 'DateTime' },
  { kind: 'url', label: 'URL' },
  { kind: 'phone', label: 'Phone' },
]

type EventLog = {
  id: number
  type: 'entity' | 'remove' | 'diagnostic'
  action: string
  detail: string
  time: string
}

// Keep events in a ref to avoid re-renders, sync to state periodically
const MAX_EVENTS = 100

export default function App() {
  const [text, setText] = useState('')
  const [entities, setEntities] = useState<Entity[]>([])
  const [events, setEvents] = useState<EventLog[]>([])
  const [eventCount, setEventCount] = useState(0)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const recognizerRef = useRef<Recognizer | null>(null)
  
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

  // Initialize recognizer once
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
        ...eventsRef.current.slice(0, MAX_EVENTS - 1)
      ]
      eventCountRef.current++
    }

    const recognizer = createRecognizer({
      plugins: [
        plugins.quantity(),
        plugins.email(),
        plugins.datetime(),
        plugins.url(),
        plugins.phone(),
      ],
      schedule: {
        realtimeMs: 100,
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

    return () => {
      recognizer.destroy()
      recognizerRef.current = null
    }
  }, [scheduleUpdate])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setText(newText)
    recognizerRef.current?.feed({
      text: newText,
      cursor: e.target.selectionStart,
    })
  }, [])

  const handleScroll = useCallback(() => {
    if (backdropRef.current && textareaRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      recognizerRef.current?.commit('enter')
    }
  }, [])

  // Memoize highlight rendering
  const highlights = useMemo(() => {
    if (!text) return null
    if (entities.length === 0) return text

    const segments: React.ReactNode[] = []
    let lastIndex = 0

    for (const entity of entities) {
      if (entity.span.start > lastIndex) {
        segments.push(
          <span key={`t-${lastIndex}`}>{text.slice(lastIndex, entity.span.start)}</span>
        )
      }
      segments.push(
        <span key={entity.id} className={`rounded-sm ${ENTITY_STYLES[entity.kind] || ''}`}>
          {entity.text}
        </span>
      )
      lastIndex = entity.span.end
    }

    if (lastIndex < text.length) {
      segments.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex)}</span>)
    }

    return segments
  }, [text, entities])

  const confirmedCount = useMemo(
    () => entities.filter(e => e.status === 'confirmed').length,
    [entities]
  )

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-semibold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent mb-2">
            StreamSense
          </h1>
          <p className="text-neutral-500 text-sm">
            Real-time semantic understanding from streaming text
          </p>
        </header>

        <div className="relative w-full max-w-xl border border-neutral-800 rounded-xl bg-neutral-900/50 overflow-hidden focus-within:border-neutral-700 transition-colors">
          <div
            ref={backdropRef}
            className="absolute inset-0 p-5 text-lg leading-7 whitespace-pre-wrap break-words overflow-hidden pointer-events-none text-transparent"
          >
            {highlights}
          </div>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            placeholder="Try: Meeting with john@example.com on Jan 15 about the 10km race..."
            spellCheck={false}
            className="relative w-full min-h-[200px] p-5 text-lg leading-7 bg-transparent text-neutral-200 placeholder-neutral-600 resize-none outline-none"
          />
        </div>

        <div className="flex justify-center gap-5 mt-6 flex-wrap">
          {LEGEND.map(({ kind, label }) => (
            <div key={kind} className="flex items-center gap-1.5 text-sm text-neutral-500">
              <span className={`w-2 h-2 rounded-full ${KIND_COLORS[kind]}`} />
              {label}
            </div>
          ))}
        </div>
      </main>

      {/* Side Panel */}
      <aside className="w-80 bg-[#111] border-l border-neutral-800 flex flex-col overflow-hidden">
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
