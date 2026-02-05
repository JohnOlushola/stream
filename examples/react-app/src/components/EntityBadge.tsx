import type { EntityKind } from 'streamsense'

type EntityBadgeProps = {
  kind: EntityKind
  className?: string
}

const kindStyles: Record<EntityKind, string> = {
  quantity: 'bg-blue-500 text-white',
  email: 'bg-green-500 text-white',
  datetime: 'bg-yellow-500 text-black',
  url: 'bg-purple-500 text-white',
  phone: 'bg-pink-500 text-white',
  person: 'bg-orange-500 text-white',
  place: 'bg-teal-500 text-white',
  custom: 'bg-gray-500 text-white',
}

export function EntityBadge({ kind, className = '' }: EntityBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${kindStyles[kind]} ${className}`}
    >
      {kind}
    </span>
  )
}
