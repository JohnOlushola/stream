# StreamSense - Vanilla Example

A pure HTML/CSS/JavaScript example with real-time text highlighting and event monitoring.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- Centered input with real-time entity highlighting
- Side panel showing:
  - **Metrics**: Character count, entity count, confirmed count, event count
  - **Current Entities**: List of detected entities with confidence scores
  - **Event Stream**: Live log of all StreamSense events

## Try It

Type text containing:
- Quantities: `10 km`, `$50`, `5.5 kg`
- Emails: `john@example.com`
- Dates: `Jan 15`, `2024-03-15`, `tomorrow`
- URLs: `https://example.com`
- Phone numbers: `+1 (555) 123-4567`
