import { useEffect, useRef, useCallback, useState } from "react";
import {
  createRecognizer,
  plugins,
  type Recognizer,
  type Entity,
  type EntityEvent,
  type RemoveEvent,
  type DiagnosticEvent,
} from "streamsense";

export type StreamEvent =
  | { type: "entity"; entity: Entity; ts: number }
  | { type: "remove"; id: string; key: string; ts: number }
  | { type: "diagnostic"; plugin: string; message: string; severity: string; ts: number };

export function useStreamSense() {
  const recognizerRef = useRef<Recognizer | null>(null);
  const [entities, setEntities] = useState<Record<string, Entity>>({});
  const [events, setEvents] = useState<StreamEvent[]>([]);

  // Initialize recognizer once
  useEffect(() => {
    const r = createRecognizer({
      plugins: [
        plugins.quantity(),
        plugins.datetime(),
        plugins.email(),
        plugins.url(),
        plugins.phone(),
      ],
      schedule: {
        realtimeMs: 120,
        commitAfterMs: 600,
      },
      thresholds: {
        realtime: 0.6,
        commit: 0.4,
      },
    });

    r.on("entity", (e: EntityEvent) => {
      setEntities((prev) => ({ ...prev, [e.entity.id]: e.entity }));
      setEvents((prev) => {
        const evt: StreamEvent = { type: "entity" as const, entity: e.entity, ts: Date.now() };
        return [evt, ...prev].slice(0, 200);
      });
    });

    r.on("remove", (e: RemoveEvent) => {
      setEntities((prev) => {
        const next = { ...prev };
        delete next[e.id];
        return next;
      });
      setEvents((prev) => {
        const evt: StreamEvent = { type: "remove" as const, id: e.id, key: e.key, ts: Date.now() };
        return [evt, ...prev].slice(0, 200);
      });
    });

    r.on("diagnostic", (e: DiagnosticEvent) => {
      setEvents((prev) => {
        const evt: StreamEvent = { type: "diagnostic" as const, plugin: e.plugin, message: e.message, severity: e.severity, ts: Date.now() };
        return [evt, ...prev].slice(0, 200);
      });
    });

    recognizerRef.current = r;

    return () => {
      r.destroy();
      recognizerRef.current = null;
    };
  }, []);

  const feed = useCallback((text: string, cursor?: number) => {
    recognizerRef.current?.feed({ text, cursor });
  }, []);

  const commit = useCallback((reason?: string) => {
    recognizerRef.current?.commit(reason);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    entities: Object.values(entities),
    entityMap: entities,
    events,
    feed,
    commit,
    clearEvents,
  };
}
