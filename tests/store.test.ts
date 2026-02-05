import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from '../src/store.js'
import type { EntityCandidate } from '../src/types.js'

describe('Store', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  const createCandidate = (overrides: Partial<EntityCandidate> = {}): EntityCandidate => ({
    key: 'test:1:0:5',
    kind: 'quantity',
    span: { start: 0, end: 5 },
    text: 'test',
    value: { amount: 1 },
    confidence: 0.9,
    status: 'provisional',
    ...overrides,
  })

  describe('upsert', () => {
    it('should add new entities', () => {
      const candidate = createCandidate()
      const { added, updated } = store.upsert([candidate])

      expect(added.length).toBe(1)
      expect(updated.length).toBe(0)
      expect(added[0].key).toBe(candidate.key)
      expect(added[0].id).toMatch(/^ent_\d+$/)
    })

    it('should update existing entities with same key', () => {
      const candidate1 = createCandidate({ confidence: 0.8 })
      store.upsert([candidate1])

      const candidate2 = createCandidate({ confidence: 0.95 })
      const { added, updated } = store.upsert([candidate2])

      expect(added.length).toBe(0)
      expect(updated.length).toBe(1)
      expect(updated[0].confidence).toBe(0.95)
    })

    it('should preserve ID when updating', () => {
      const candidate = createCandidate()
      const { added } = store.upsert([candidate])
      const originalId = added[0].id

      const { updated } = store.upsert([createCandidate({ confidence: 0.99 })])
      expect(updated[0].id).toBe(originalId)
    })

    it('should not mark as updated if nothing changed', () => {
      const candidate = createCandidate()
      store.upsert([candidate])

      const { updated } = store.upsert([candidate])
      expect(updated.length).toBe(0)
    })
  })

  describe('removeByKeys', () => {
    it('should remove entities by key', () => {
      const candidate = createCandidate()
      store.upsert([candidate])
      expect(store.size()).toBe(1)

      const removed = store.removeByKeys([candidate.key])
      expect(removed.length).toBe(1)
      expect(store.size()).toBe(0)
    })

    it('should ignore non-existent keys', () => {
      const removed = store.removeByKeys(['non-existent'])
      expect(removed.length).toBe(0)
    })
  })

  describe('reconcile', () => {
    it('should add new, update existing, and remove stale', () => {
      // Initial entities
      store.upsert([
        createCandidate({ key: 'a' }),
        createCandidate({ key: 'b' }),
        createCandidate({ key: 'c' }),
      ])
      expect(store.size()).toBe(3)

      // Reconcile: keep a (updated), keep b, remove c, add d
      const changes = store.reconcile([
        createCandidate({ key: 'a', confidence: 0.99 }), // update
        createCandidate({ key: 'b' }), // no change
        createCandidate({ key: 'd' }), // new
      ])

      expect(changes.added.length).toBe(1)
      expect(changes.added[0].key).toBe('d')

      expect(changes.updated.length).toBe(1)
      expect(changes.updated[0].key).toBe('a')

      expect(changes.removed.length).toBe(1)
      expect(changes.removed[0].key).toBe('c')

      expect(store.size()).toBe(3)
    })
  })

  describe('get and getByKey', () => {
    it('should retrieve entities by id', () => {
      const candidate = createCandidate()
      const { added } = store.upsert([candidate])
      const id = added[0].id

      const entity = store.get(id)
      expect(entity).toBeDefined()
      expect(entity?.key).toBe(candidate.key)
    })

    it('should retrieve entities by key', () => {
      const candidate = createCandidate()
      store.upsert([candidate])

      const entity = store.getByKey(candidate.key)
      expect(entity).toBeDefined()
      expect(entity?.text).toBe(candidate.text)
    })
  })

  describe('confirmAll', () => {
    it('should confirm all provisional entities', () => {
      store.upsert([
        createCandidate({ key: 'a', status: 'provisional' }),
        createCandidate({ key: 'b', status: 'provisional' }),
        createCandidate({ key: 'c', status: 'confirmed' }),
      ])

      const confirmed = store.confirmAll()
      expect(confirmed.length).toBe(2)

      const entities = store.getAll()
      expect(entities.every((e) => e.status === 'confirmed')).toBe(true)
    })
  })

  describe('clear', () => {
    it('should remove all entities', () => {
      store.upsert([createCandidate()])
      expect(store.size()).toBe(1)

      store.clear()
      expect(store.size()).toBe(0)
    })
  })
})
