# StreamSense - React Example

A minimal React + Tailwind example with real-time text highlighting.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Try It

Type text containing:
- Quantities: `10 km`, `$50`, `5.5 kg`
- Emails: `john@example.com`
- Dates: `Jan 15`, `2024-03-15`, `tomorrow`
- URLs: `https://example.com`
- Phone numbers: `+1 (555) 123-4567`

## Using the Hook

```tsx
import { useStreamSense } from './hooks/useStreamSense'

function MyComponent() {
  const { entities, feed, commit } = useStreamSense()

  return (
    <textarea
      onChange={(e) => feed(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
```
