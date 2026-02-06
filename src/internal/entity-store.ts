import type { Entity } from "../types.js";

let nextId = 1;
function generateId(): string {
  return `ent_${nextId++}`;
}

/** Reset the ID counter (for testing) */
export function _resetIdCounter(): void {
  nextId = 1;
}

export interface StoreChange {
  upserted: Entity[];
  removed: Entity[];
}

/**
 * EntityStore — manages entities indexed by their stable key.
 * Handles upsert (dedup by key), removal, and diff-based cleanup.
 */
export class EntityStore {
  private _entities: Map<string, Entity> = new Map();

  /** Get all entities as an array */
  all(): Entity[] {
    return Array.from(this._entities.values());
  }

  /** Get entity by key */
  get(key: string): Entity | undefined {
    return this._entities.get(key);
  }

  /** Number of entities */
  get size(): number {
    return this._entities.size;
  }

  /**
   * Apply a batch of upserts and removals. Returns what actually changed.
   */
  apply(
    upsert: Array<Omit<Entity, "id"> & { key: string }>,
    remove: string[]
  ): StoreChange {
    const upserted: Entity[] = [];
    const removed: Entity[] = [];

    // Process removals first
    for (const key of remove) {
      const existing = this._entities.get(key);
      if (existing) {
        this._entities.delete(key);
        removed.push(existing);
      }
    }

    // Process upserts
    for (const item of upsert) {
      const existing = this._entities.get(item.key);

      if (existing) {
        // Update in place — keep the same id
        const updated: Entity = {
          ...item,
          id: existing.id,
        } as Entity;
        this._entities.set(item.key, updated);
        upserted.push(updated);
      } else {
        // New entity
        const entity: Entity = {
          ...item,
          id: generateId(),
        } as Entity;
        this._entities.set(item.key, entity);
        upserted.push(entity);
      }
    }

    return { upserted, removed };
  }

  /**
   * Diff-based removal: given a set of keys that should still exist
   * (from the latest plugin pass), remove any entities from the specified
   * plugin kinds that are no longer present.
   */
  removeStale(activeKeys: Set<string>, kinds: Set<string>): Entity[] {
    const removed: Entity[] = [];

    for (const [key, entity] of this._entities) {
      if (kinds.has(entity.kind) && !activeKeys.has(key)) {
        this._entities.delete(key);
        removed.push(entity);
      }
    }

    return removed;
  }

  /** Clear all entities */
  clear(): void {
    this._entities.clear();
  }
}
