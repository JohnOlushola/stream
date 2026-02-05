# StreamSense

> Real-time semantic understanding from streaming text

StreamSense is a small library that turns a stream of text into a stream of meaning. You feed it text incrementally, and it emits structured semantic events like detected entities, removed entities, and diagnostics.

## Mental Model

Think of it as **Language Server Protocol, but for natural language**.

## Installation

```bash
npm install streamsense
```

## Quick Start

```ts
import { createRecognizer, plugins } from 'streamsense'

// Create a recognizer with plugins
const r = createRecognizer({
  plugins: [plugins.quantity(), plugins.email()],
  schedule: {
    realtimeMs: 150,
    commitAfterMs: 700,
  },
})

// Subscribe to events
r.on('entity', (e) => {
  console.log('Entity detected:', e.entity)
})

r.on('remove', (e) => {
  console.log('Entity removed:', e.id)
})

// Feed text as user types
r.feed({
  text: 'convert 10 km to mi',
  cursor: 18,
})

// Force commit on Enter
r.commit('enter')

// Read current state
const state = r.state()
console.log(state.entities)

// Cleanup
r.destroy()
```

## Features

- **Incremental** - Works per keystroke
- **Cheap** - Windowed analysis + debounced passes
- **Model-agnostic** - Regex, local ML, or remote LLM
- **UI-agnostic** - React, vanilla JS, Python backend
- **Deterministic** - Same input stream → same output events

## Built-in Plugins

- `quantity()` - Numbers with units (10 km, 5 kg)
- `datetime()` - Dates and times
- `email()` - Email addresses
- `url()` - URLs
- `phone()` - Phone numbers

## Custom Plugins

```ts
const myPlugin = {
  name: 'my-plugin',
  mode: 'realtime',
  run({ window, mode }) {
    // Your extraction logic
    return {
      upsert: [
        {
          key: 'unique-key',
          kind: 'custom',
          span: { start: 0, end: 5 },
          text: 'hello',
          value: { custom: 'data' },
          confidence: 0.9,
          status: mode === 'commit' ? 'confirmed' : 'provisional',
        },
      ],
    }
  },
}
```

## License

MIT
