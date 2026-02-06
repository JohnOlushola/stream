# StreamSense

**Real-time semantic understanding from streaming text.**

[![npm version](https://img.shields.io/npm/v/streamsense)](https://www.npmjs.com/package/streamsense)
[![license](https://img.shields.io/npm/l/streamsense)](./LICENSE)

StreamSense turns a stream of text into a stream of meaning. Feed it text incrementally — it emits structured semantic events: detected entities, removed entities, and diagnostics.

Zero dependencies. Works in Node, browsers, and edge runtimes.

> Mental model: *Language Server Protocol, but for natural language.*

---

## Install

```bash
npm install streamsense
```

## Quick Start

```ts
import { createRecognizer, plugins } from "streamsense";

const r = createRecognizer({
  plugins: [
    plugins.quantity(),
    plugins.email(),
    plugins.datetime(),
    plugins.url(),
    plugins.phone(),
  ],
});

// Subscribe to entity events
r.on("entity", (e) => {
  console.log("found:", e.entity.kind, e.entity.text, e.entity.value);
});

r.on("remove", (e) => {
  console.log("gone:", e.id);
});

// Feed text as the user types
r.feed({ text: "convert 10 km to mi" });

// Force a commit pass (e.g. on Enter)
r.commit("enter");

// Read current state at any time
console.log(r.state().entities);

// Cleanup when done
r.destroy();
```

---

## API Reference

### `createRecognizer(options)`

Creates a new recognizer instance.

```ts
const r = createRecognizer({
  plugins: [plugins.quantity()],
  schedule: {
    realtimeMs: 150,    // debounce interval for realtime passes (default: 150)
    commitAfterMs: 700, // idle time before auto-commit fires (default: 700)
  },
  thresholds: {
    realtime: 0.8, // min confidence for realtime entities (default: 0.8)
    commit: 0.5,   // min confidence for commit entities (default: 0.5)
  },
  windowSize: 200, // analysis window in chars around cursor (default: 200)
});
```

### `r.feed(input)`

Update the text buffer. Triggers debounced realtime analysis.

```ts
r.feed({
  text: "convert 10 km to mi",
  cursor: 18,                    // optional — defaults to end of text
  meta: { composing: false },    // optional — skip analysis during IME composition
});
```

### `r.commit(reason?)`

Force a commit-mode analysis pass immediately. All plugins run, entities are promoted to `"confirmed"` status.

### `r.on(event, handler)` / `r.off(event, handler)`

Subscribe to typed events:

| Event | Payload | When |
|-------|---------|------|
| `"entity"` | `{ type, entity }` | Entity created or updated |
| `"remove"` | `{ type, id, key }` | Entity removed (text changed or stale) |
| `"diagnostic"` | `{ type, plugin, message, severity }` | Plugin error or warning |

### `r.state()`

Returns a snapshot of current state:

```ts
{ text: string, revision: number, entities: Entity[] }
```

### `r.destroy()`

Tears down all timers, clears handlers, and resets state.

---

## Entity Model

Every detected entity has this shape:

```ts
type Entity = {
  id: string;                          // stable auto-generated ID
  key: string;                         // dedup key (e.g. "quantity:10:km:8")
  kind: EntityKind;                    // "quantity" | "datetime" | "email" | ...
  span: { start: number; end: number };// character offsets in full text
  text: string;                        // matched substring
  value: unknown;                      // parsed value (plugin-specific)
  confidence: number;                  // 0–1
  status: "provisional" | "confirmed"; // provisional during typing, confirmed on commit
};
```

Entities are keyed by a stable `key` string. When the same key appears across passes, the entity is updated in place (same `id`). When a key disappears, the entity is removed and a `"remove"` event fires.

---

## Built-in Plugins

| Plugin | Kind | Detects |
|--------|------|---------|
| `plugins.quantity()` | `quantity` | Numbers with units — km, mi, kg, g, lb, m, cm, mm, ft, etc. |
| `plugins.datetime()` | `datetime` | ISO dates, verbal dates (Jan 15), times (14:30), relative (tomorrow) |
| `plugins.email()` | `email` | Email addresses |
| `plugins.url()` | `url` | HTTP / HTTPS / FTP URLs |
| `plugins.phone()` | `phone` | Phone numbers — US, international, with/without country codes |

All built-in plugins run in `"realtime"` mode (triggered on every debounced tick).

---

## Custom Plugins

Plugins are simple objects. No base class, no decorators, no registration.

```ts
import type { Plugin } from "streamsense";

const currencyPlugin: Plugin = {
  name: "currency",
  mode: "realtime",   // or "commit" for expensive passes
  priority: 50,       // lower runs first (default: 100)
  run({ window, mode }) {
    const regex = /\$[\d,]+(\.\d{2})?/g;
    const matches = [...window.text.matchAll(regex)];

    return {
      upsert: matches.map((m) => ({
        key: `currency:${m[0]}:${window.offset + m.index!}`,
        kind: "custom" as const,
        span: {
          start: window.offset + m.index!,
          end: window.offset + m.index! + m[0].length,
        },
        text: m[0],
        value: { amount: parseFloat(m[0].replace(/[$,]/g, "")) },
        confidence: 0.9,
        status: mode === "commit" ? "confirmed" as const : "provisional" as const,
      })),
    };
  },
};
```

### Plugin Context

Every plugin receives:

```ts
type PluginContext = {
  text: string;                              // full text
  window: { text: string; offset: number };  // windowed slice near cursor
  mode: "realtime" | "commit";               // current pass mode
  entities: Entity[];                        // current entity snapshot
};
```

### Plugin Result

Return upserts and/or removals:

```ts
type PluginResult = {
  upsert?: Array<Omit<Entity, "id"> & { key: string }>;
  remove?: string[];  // entity keys to remove
};
```

---

## Framework Integration

### React

```tsx
import { useEffect, useState } from "react";
import { createRecognizer, plugins, Entity } from "streamsense";

function useStreamSense(text: string) {
  const [entities, setEntities] = useState<Record<string, Entity>>({});

  useEffect(() => {
    const r = createRecognizer({ plugins: [plugins.quantity(), plugins.email()] });

    r.on("entity", (e) =>
      setEntities((prev) => ({ ...prev, [e.entity.id]: e.entity }))
    );
    r.on("remove", (e) =>
      setEntities((prev) => {
        const next = { ...prev };
        delete next[e.id];
        return next;
      })
    );

    r.feed({ text });
    r.commit();

    return () => r.destroy();
  }, [text]);

  return Object.values(entities);
}
```

### Node (pipe to Python)

```js
import { createRecognizer, plugins } from "streamsense";

const r = createRecognizer({ plugins: [plugins.quantity()] });

r.on("entity", (e) =>
  process.stdout.write(JSON.stringify(e) + "\n")
);

// Feed from stdin, pipe stdout to Python
process.stdin.on("data", (chunk) => {
  r.feed({ text: chunk.toString() });
  r.commit();
});
```

---

## How It Works

StreamSense uses the **incremental compiler** pattern — the same pattern behind TypeScript's language server, Rust Analyzer, and ESLint.

```
feed(text)
   │
   ▼
┌──────────────┐
│  TextBuffer  │  ← stores text, cursor, revision
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│  Scheduler       │  ← debounces realtime (~150ms) and commit (~700ms idle)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Plugin Pipeline │  ← runs plugins by priority, collects results
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  EntityStore     │  ← deduplicates by key, diffs stale entities
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  EventBus        │  ← emits entity / remove / diagnostic events
└──────────────────┘
```

### Performance Guardrails

| Mechanism | Purpose |
|-----------|---------|
| **Windowed analysis** | Only analyze text near the cursor |
| **Debounced scheduling** | Realtime every ~150ms, commit after ~700ms idle |
| **Stable keys** | Prevent entity churn — same match = same ID |
| **Provisional / confirmed** | Avoid UI flicker while typing |
| **IME awareness** | Skip analysis during composition |
| **Diff-based removal** | Automatically clean up stale entities |

---

## Design Principles

- **Incremental** — works per keystroke, not per request
- **Cheap** — windowed analysis + debounced passes, no network required
- **Model-agnostic** — regex today, local ML or remote LLM tomorrow
- **UI-agnostic** — React, Svelte, vanilla JS, Node, Python backend
- **Deterministic** — same input stream produces same output events
- **Zero dependencies** — just TypeScript, ships ESM + CJS

---

## What StreamSense Is Not

StreamSense does not:

- Generate text or responses
- Call tools or manage agents
- Render UI or manage state
- Depend on any LLM or ML model
- Make network requests

It is a **streaming semantic compiler for natural language** — the same category as tree-sitter, ESLint, or a language server. Just applied to human language.

---

## License

[MIT](./LICENSE)
