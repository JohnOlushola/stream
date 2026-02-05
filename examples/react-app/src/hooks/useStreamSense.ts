import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createRecognizer,
  plugins,
  type Recognizer,
  type Entity,
  type RecognizerOptions,
  type EntityEvent,
  type RemoveEvent,
} from 'streamsense'

export type UseStreamSenseOptions = Partial<RecognizerOptions>

export type UseStreamSenseReturn = {
  entities: Entity[]
  feed: (text: string, cursor?: number) => void
  commit: () => void
  clear: () => void
  isReady: boolean
}

export function useStreamSense(
  options: UseStreamSenseOptions = {}
): UseStreamSenseReturn {
  const [entities, setEntities] = useState<Record<string, Entity>>({})
  const [isReady, setIsReady] = useState(false)
  const recognizerRef = useRef<Recognizer | null>(null)

  // Initialize recognizer
  useEffect(() => {
    const recognizer = createRecognizer({
      plugins: [
        plugins.quantity(),
        plugins.email(),
        plugins.datetime(),
        plugins.url(),
        plugins.phone(),
      ],
      schedule: {
        realtimeMs: 150,
        commitAfterMs: 800,
      },
      ...options,
    })

    // Handle entity events
    recognizer.on('entity', (event: EntityEvent) => {
      setEntities((prev) => ({
        ...prev,
        [event.entity.id]: event.entity,
      }))
    })

    // Handle remove events
    recognizer.on('remove', (event: RemoveEvent) => {
      setEntities((prev) => {
        const next = { ...prev }
        delete next[event.id]
        return next
      })
    })

    recognizerRef.current = recognizer
    setIsReady(true)

    return () => {
      recognizer.destroy()
      recognizerRef.current = null
      setIsReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const feed = useCallback((text: string, cursor?: number) => {
    recognizerRef.current?.feed({
      text,
      cursor: cursor ?? text.length,
    })
  }, [])

  const commit = useCallback(() => {
    recognizerRef.current?.commit('manual')
  }, [])

  const clear = useCallback(() => {
    recognizerRef.current?.feed({ text: '', cursor: 0 })
    setEntities({})
  }, [])

  // Convert entities object to sorted array
  const entityList = Object.values(entities).sort(
    (a, b) => a.span.start - b.span.start
  )

  return {
    entities: entityList,
    feed,
    commit,
    clear,
    isReady,
  }
}
