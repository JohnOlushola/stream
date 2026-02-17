# Stream - React Example

A React + Tailwind example with real-time text highlighting and event monitoring.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

### Optional: LLM plugin

On **commit** (e.g. after you stop typing or press Enter), an LLM can extract person/place/topic entities. To enable:

1. Copy `.env.example` to `.env`
2. Set `VITE_OPENAI_API_KEY` to your OpenAI API key (or use `VITE_OPENAI_API_BASE` for an OpenAI-compatible endpoint)
3. Restart the dev server

Without the key, the app runs with regex plugins only.

## Features

- Full-width, full-height editor (CodeMirror 6) with real-time entity highlighting
- **Settings**: Toggle Regex only / LLM only / All (regex + LLM) for recognition
- Collapsible side panel:
  - **Settings**: Regex / LLM / All toggle
  - **Metrics**: Character count, entity count, confirmed count, event count
  - **Current Entities**: List of detected entities with confidence scores
  - **Event Stream**: Live log of all Stream events

## Tests

```bash
npm run test:run
npm run test:coverage
```

## Try It

Type text containing:
- Quantities: `10 km`, `$50`, `5.5 kg`
- Emails: `john@example.com`
- Dates: `Jan 15`, `2024-03-15`, `tomorrow`
- URLs: `https://example.com`
- Phone numbers: `+1 (555) 123-4567`

With the LLM plugin enabled, pause or press Enter to see person/place/organization/topic entities from the commit pass.
