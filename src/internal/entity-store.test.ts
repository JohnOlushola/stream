import { describe, it, expect, beforeEach } from "vitest";
import { EntityStore, _resetIdCounter } from "./entity-store.js";

describe("EntityStore", () => {
  beforeEach(() => {
    _resetIdCounter();
  });

  it("starts empty", () => {
    const store = new EntityStore();
    expect(store.all()).toEqual([]);
    expect(store.size).toBe(0);
  });

  it("upserts new entities", () => {
    const store = new EntityStore();
    const change = store.apply(
      [
        {
          key: "quantity:10:km:8",
          kind: "quantity",
          span: { start: 8, end: 13 },
          text: "10 km",
          value: { amount: 10, unit: "km" },
          confidence: 0.9,
          status: "provisional",
        },
      ],
      []
    );

    expect(change.upserted).toHaveLength(1);
    expect(change.upserted[0].id).toBe("ent_1");
    expect(change.upserted[0].key).toBe("quantity:10:km:8");
    expect(store.size).toBe(1);
  });

  it("updates existing entity by key (preserves id)", () => {
    const store = new EntityStore();
    store.apply(
      [
        {
          key: "quantity:10:km:8",
          kind: "quantity",
          span: { start: 8, end: 13 },
          text: "10 km",
          value: { amount: 10, unit: "km" },
          confidence: 0.9,
          status: "provisional",
        },
      ],
      []
    );

    const change = store.apply(
      [
        {
          key: "quantity:10:km:8",
          kind: "quantity",
          span: { start: 8, end: 13 },
          text: "10 km",
          value: { amount: 10, unit: "km" },
          confidence: 0.95,
          status: "confirmed",
        },
      ],
      []
    );

    expect(change.upserted).toHaveLength(1);
    expect(change.upserted[0].id).toBe("ent_1"); // same id
    expect(change.upserted[0].status).toBe("confirmed");
    expect(store.size).toBe(1);
  });

  it("removes entities by key", () => {
    const store = new EntityStore();
    store.apply(
      [
        {
          key: "email:test@example.com:0",
          kind: "email",
          span: { start: 0, end: 16 },
          text: "test@example.com",
          value: { address: "test@example.com" },
          confidence: 0.95,
          status: "confirmed",
        },
      ],
      []
    );

    const change = store.apply([], ["email:test@example.com:0"]);
    expect(change.removed).toHaveLength(1);
    expect(store.size).toBe(0);
  });

  it("removes stale entities by kind", () => {
    const store = new EntityStore();
    store.apply(
      [
        {
          key: "quantity:10:km:8",
          kind: "quantity",
          span: { start: 8, end: 13 },
          text: "10 km",
          value: { amount: 10, unit: "km" },
          confidence: 0.9,
          status: "confirmed",
        },
        {
          key: "email:a@b.com:0",
          kind: "email",
          span: { start: 0, end: 7 },
          text: "a@b.com",
          value: { address: "a@b.com" },
          confidence: 0.95,
          status: "confirmed",
        },
      ],
      []
    );

    // Only quantity:10:km:8 is active; email should not be removed
    const stale = store.removeStale(
      new Set(["quantity:10:km:8"]),
      new Set(["quantity"])
    );
    expect(stale).toHaveLength(0);
    expect(store.size).toBe(2);
  });

  it("removes stale entities when key is gone", () => {
    const store = new EntityStore();
    store.apply(
      [
        {
          key: "quantity:10:km:8",
          kind: "quantity",
          span: { start: 8, end: 13 },
          text: "10 km",
          value: { amount: 10, unit: "km" },
          confidence: 0.9,
          status: "confirmed",
        },
      ],
      []
    );

    // Nothing active for quantity kind
    const stale = store.removeStale(new Set(), new Set(["quantity"]));
    expect(stale).toHaveLength(1);
    expect(store.size).toBe(0);
  });
});
