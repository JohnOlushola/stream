import type { Entity, EntityKind } from 'streamsense'

type HighlightedTextProps = {
  text: string
  entities: Entity[]
}

const highlightStyles: Record<EntityKind, string> = {
  quantity: 'bg-blue-500/30 border-b-2 border-blue-500',
  email: 'bg-green-500/30 border-b-2 border-green-500',
  datetime: 'bg-yellow-500/30 border-b-2 border-yellow-500',
  url: 'bg-purple-500/30 border-b-2 border-purple-500',
  phone: 'bg-pink-500/30 border-b-2 border-pink-500',
  person: 'bg-orange-500/30 border-b-2 border-orange-500',
  place: 'bg-teal-500/30 border-b-2 border-teal-500',
  custom: 'bg-gray-500/30 border-b-2 border-gray-500',
}

export function HighlightedText({ text, entities }: HighlightedTextProps) {
  if (!text) {
    return (
      <span className="text-gray-500 italic">
        Highlighted text will appear here...
      </span>
    )
  }

  if (entities.length === 0) {
    return <span>{text}</span>
  }

  // Build segments
  const segments: Array<{
    text: string
    entity?: Entity
  }> = []

  let lastIndex = 0

  for (const entity of entities) {
    // Add text before this entity
    if (entity.span.start > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, entity.span.start),
      })
    }

    // Add entity
    segments.push({
      text: entity.text,
      entity,
    })

    lastIndex = entity.span.end
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
    })
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.entity ? (
          <span
            key={index}
            className={`px-0.5 mx-0.5 rounded ${highlightStyles[segment.entity.kind]}`}
            title={`${segment.entity.kind}: ${JSON.stringify(segment.entity.value)}`}
          >
            {segment.text}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  )
}
