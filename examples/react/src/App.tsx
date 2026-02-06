import { useState, useRef, useEffect } from "react";
import { useStreamSense, type StreamEvent } from "./useStreamSense";
import type { Entity } from "streamsense";
import "./App.css";

// ---------------------------------------------------------------------------
// Highlighted text renderer — overlays entity spans on the input text
// ---------------------------------------------------------------------------

const KIND_COLORS: Record<string, string> = {
  quantity: "#3b82f6",
  datetime: "#8b5cf6",
  email: "#10b981",
  url: "#f59e0b",
  phone: "#ef4444",
  person: "#ec4899",
  place: "#06b6d4",
  custom: "#6b7280",
};

function HighlightedText({ text, entities }: { text: string; entities: Entity[] }) {
  if (!text) return <span className="placeholder-text">Start typing to see entities...</span>;

  // Sort entities by span start
  const sorted = [...entities].sort((a, b) => a.span.start - b.span.start);

  const parts: React.ReactElement[] = [];
  let cursor = 0;

  for (const entity of sorted) {
    // Skip overlapping entities (simple approach: skip if start < cursor)
    if (entity.span.start < cursor) continue;

    // Plain text before entity
    if (entity.span.start > cursor) {
      parts.push(
        <span key={`t-${cursor}`}>{text.slice(cursor, entity.span.start)}</span>
      );
    }

    // Entity span
    const color = KIND_COLORS[entity.kind] ?? KIND_COLORS.custom;
    parts.push(
      <span
        key={`e-${entity.id}`}
        className="entity-highlight"
        style={{ "--entity-color": color } as React.CSSProperties}
        title={`${entity.kind}: ${JSON.stringify(entity.value)}\nconfidence: ${entity.confidence}\nstatus: ${entity.status}`}
      >
        {text.slice(entity.span.start, entity.span.end)}
        <span className="entity-badge">{entity.kind}</span>
      </span>
    );

    cursor = entity.span.end;
  }

  // Remaining text
  if (cursor < text.length) {
    parts.push(<span key={`t-${cursor}`}>{text.slice(cursor)}</span>);
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Event stream item
// ---------------------------------------------------------------------------

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventItem({ event }: { event: StreamEvent }) {
  if (event.type === "entity") {
    const color = KIND_COLORS[event.entity.kind] ?? KIND_COLORS.custom;
    return (
      <div className="event-item event-entity">
        <span className="event-time">{formatTime(event.ts)}</span>
        <span className="event-type-badge" style={{ background: color }}>
          {event.entity.kind}
        </span>
        <span className="event-detail">
          <strong>{event.entity.text}</strong>
          <span className="event-meta">
            {event.entity.status === "confirmed" ? " confirmed" : " provisional"}
            {" \u00b7 "}
            {(event.entity.confidence * 100).toFixed(0)}%
          </span>
        </span>
      </div>
    );
  }

  if (event.type === "remove") {
    return (
      <div className="event-item event-remove">
        <span className="event-time">{formatTime(event.ts)}</span>
        <span className="event-type-badge event-type-remove">removed</span>
        <span className="event-detail">
          <span className="event-key">{event.key}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="event-item event-diagnostic">
      <span className="event-time">{formatTime(event.ts)}</span>
      <span className="event-type-badge event-type-diag">{event.severity}</span>
      <span className="event-detail">{event.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity pills (summary below input)
// ---------------------------------------------------------------------------

function EntityPills({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) return null;

  return (
    <div className="entity-pills">
      {entities.map((e) => {
        const color = KIND_COLORS[e.kind] ?? KIND_COLORS.custom;
        return (
          <span
            key={e.id}
            className="entity-pill"
            style={{ "--entity-color": color } as React.CSSProperties}
          >
            <span className="pill-kind">{e.kind}</span>
            <span className="pill-text">{e.text}</span>
            <span className="pill-value">{JSON.stringify(e.value)}</span>
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export default function App() {
  const [text, setText] = useState("");
  const { entities, events, feed, commit, clearEvents } = useStreamSense();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Feed text on every change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart ?? value.length;
    setText(value);
    feed(value, cursor);
  };

  // Commit on Enter (but allow Shift+Enter for newlines)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      commit("enter");
    }
  };

  // Auto-scroll events
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Event Stream</h2>
          <div className="sidebar-actions">
            <span className="event-count">{events.length}</span>
            <button onClick={clearEvents} className="clear-btn">
              Clear
            </button>
          </div>
        </div>
        <div className="event-list">
          {events.length === 0 ? (
            <div className="empty-events">
              Events will appear here as you type...
            </div>
          ) : (
            events.map((event, i) => <EventItem key={`${event.ts}-${i}`} event={event} />)
          )}
          <div ref={eventsEndRef} />
        </div>
      </aside>

      {/* Main content */}
      <main className="main">
        <div className="content">
          <div className="header">
            <h1>StreamSense</h1>
            <p className="tagline">Real-time semantic understanding from streaming text</p>
          </div>

          <div className="input-section">
            {/* Highlighted overlay */}
            <div className="highlight-layer" aria-hidden>
              <HighlightedText text={text} entities={entities} />
            </div>

            {/* Actual textarea */}
            <textarea
              ref={inputRef}
              className="text-input"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Try: send 10 km to alice@example.com by January 15 at 14:30 or call 555-123-4567..."
              rows={4}
              spellCheck={false}
            />
          </div>

          <EntityPills entities={entities} />

          <div className="legend">
            {Object.entries(KIND_COLORS).map(([kind, color]) => (
              <span key={kind} className="legend-item">
                <span className="legend-dot" style={{ background: color }} />
                {kind}
              </span>
            ))}
          </div>

          <div className="hint">
            Press <kbd>Enter</kbd> to commit &middot; Entities are detected as you type
          </div>
        </div>
      </main>
    </div>
  );
}
