import type { Entity } from 'streamsense'
import { EntityBadge } from './EntityBadge'

type EntityCardProps = {
  entity: Entity
}

function formatValue(value: unknown): string {
  if (typeof value !== 'object' || value === null) {
    return String(value)
  }

  const obj = value as Record<string, unknown>

  if ('amount' in obj && 'unit' in obj) {
    return `${obj.amount} ${obj.unit}`
  }
  if ('email' in obj) {
    return String(obj.email)
  }
  if ('url' in obj) {
    return String(obj.domain)
  }
  if ('phone' in obj) {
    return String(obj.digits)
  }
  if ('type' in obj) {
    return String(obj.type)
  }

  return JSON.stringify(value)
}

export function EntityCard({ entity }: EntityCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-800 rounded-lg">
      <EntityBadge kind={entity.kind} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-white truncate">{entity.text}</div>
        <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
          <span>{formatValue(entity.value)}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-xs ${
              entity.status === 'confirmed'
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {entity.status}
          </span>
          <span className="text-gray-500">
            {Math.round(entity.confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  )
}
