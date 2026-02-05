/**
 * Entity Store
 * Manages entities with key-based deduplication and diff computation
 */

import type { Entity, EntityCandidate } from './types.js'

export type StoreChange = {
  added: Entity[]
  updated: Entity[]
  removed: Entity[]
}

let entityIdCounter = 0

/**
 * Generate a unique entity ID
 */
function generateId(): string {
  return `ent_${++entityIdCounter}`
}

/**
 * Creates an entity store with key-based deduplication
 */
export function createStore() {
  // Entity storage by ID
  const entitiesById = new Map<string, Entity>()
  // Key to ID mapping for deduplication
  const keyToId = new Map<string, string>()

  return {
    /**
     * Upsert entities - add new or update existing based on key
     * Returns the changes that occurred
     */
    upsert(candidates: EntityCandidate[]): StoreChange {
      const added: Entity[] = []
      const updated: Entity[] = []

      for (const candidate of candidates) {
        const existingId = keyToId.get(candidate.key)

        if (existingId) {
          // Update existing entity
          const existing = entitiesById.get(existingId)!
          const updatedEntity: Entity = {
            ...candidate,
            id: existingId,
          }

          // Only mark as updated if something changed
          if (
            existing.span.start !== candidate.span.start ||
            existing.span.end !== candidate.span.end ||
            existing.confidence !== candidate.confidence ||
            existing.status !== candidate.status ||
            JSON.stringify(existing.value) !== JSON.stringify(candidate.value)
          ) {
            entitiesById.set(existingId, updatedEntity)
            updated.push(updatedEntity)
          }
        } else {
          // Add new entity
          const id = generateId()
          const newEntity: Entity = {
            ...candidate,
            id,
          }
          entitiesById.set(id, newEntity)
          keyToId.set(candidate.key, id)
          added.push(newEntity)
        }
      }

      return { added, updated, removed: [] }
    },

    /**
     * Remove entities by their keys
     * Returns the removed entities
     */
    removeByKeys(keys: string[]): Entity[] {
      const removed: Entity[] = []

      for (const key of keys) {
        const id = keyToId.get(key)
        if (id) {
          const entity = entitiesById.get(id)
          if (entity) {
            removed.push(entity)
            entitiesById.delete(id)
            keyToId.delete(key)
          }
        }
      }

      return removed
    },

    /**
     * Remove entities by ID
     */
    removeById(id: string): Entity | undefined {
      const entity = entitiesById.get(id)
      if (entity) {
        entitiesById.delete(id)
        keyToId.delete(entity.key)
        return entity
      }
      return undefined
    },

    /**
     * Compute entities that should be removed based on new candidates
     * (entities with keys not in the new set should be removed)
     */
    computeRemovals(currentKeys: Set<string>): string[] {
      const toRemove: string[] = []

      for (const key of keyToId.keys()) {
        if (!currentKeys.has(key)) {
          toRemove.push(key)
        }
      }

      return toRemove
    },

    /**
     * Reconcile store with new entity set
     * Adds new, updates existing, removes stale
     */
    reconcile(candidates: EntityCandidate[]): StoreChange {
      const currentKeys = new Set(candidates.map((c) => c.key))

      // Find entities to remove
      const keysToRemove = this.computeRemovals(currentKeys)
      const removed = this.removeByKeys(keysToRemove)

      // Upsert new/updated entities
      const { added, updated } = this.upsert(candidates)

      return { added, updated, removed }
    },

    /**
     * Get entity by ID
     */
    get(id: string): Entity | undefined {
      return entitiesById.get(id)
    },

    /**
     * Get entity by key
     */
    getByKey(key: string): Entity | undefined {
      const id = keyToId.get(key)
      return id ? entitiesById.get(id) : undefined
    },

    /**
     * Get all entities
     */
    getAll(): Entity[] {
      return Array.from(entitiesById.values())
    },

    /**
     * Get all entity keys
     */
    getKeys(): string[] {
      return Array.from(keyToId.keys())
    },

    /**
     * Get entity count
     */
    size(): number {
      return entitiesById.size
    },

    /**
     * Clear all entities
     */
    clear(): void {
      entitiesById.clear()
      keyToId.clear()
    },

    /**
     * Confirm all provisional entities
     */
    confirmAll(): Entity[] {
      const confirmed: Entity[] = []

      for (const [id, entity] of entitiesById) {
        if (entity.status === 'provisional') {
          const confirmedEntity: Entity = {
            ...entity,
            status: 'confirmed',
          }
          entitiesById.set(id, confirmedEntity)
          confirmed.push(confirmedEntity)
        }
      }

      return confirmed
    },
  }
}

export type Store = ReturnType<typeof createStore>
