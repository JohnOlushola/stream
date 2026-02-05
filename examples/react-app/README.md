# StreamSense - React Example

A React + TypeScript + Tailwind example demonstrating StreamSense.

## Setup

```bash
# From this directory
npm install
npm run dev
```

Then open http://localhost:5173

## Features

- Custom React hook `useStreamSense` for easy integration
- Real-time entity detection with live updates
- Highlighted text with color-coded entity types
- Statistics dashboard
- Example text buttons for quick testing

## Project Structure

```
src/
├── App.tsx                    # Main application
├── hooks/
│   └── useStreamSense.ts      # StreamSense React hook
└── components/
    ├── EntityBadge.tsx        # Entity type badge
    ├── EntityCard.tsx         # Entity display card
    └── HighlightedText.tsx    # Text with highlights
```

## Using the Hook

```tsx
import { useStreamSense } from './hooks/useStreamSense'

function MyComponent() {
  const { entities, feed, commit, clear } = useStreamSense()

  return (
    <input
      onChange={(e) => feed(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
```
