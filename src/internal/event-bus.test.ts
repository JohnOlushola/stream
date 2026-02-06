import { describe, it, expect, vi } from "vitest";
import { EventBus } from "./event-bus.js";

describe("EventBus", () => {
  it("emits events to subscribers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("entity", handler);
    bus.emit("entity", {
      type: "entity",
      entity: {
        id: "ent_1",
        key: "test",
        kind: "custom",
        span: { start: 0, end: 4 },
        text: "test",
        value: null,
        confidence: 1,
        status: "confirmed",
      },
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].entity.id).toBe("ent_1");
  });

  it("supports multiple handlers", () => {
    const bus = new EventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();

    bus.on("remove", h1);
    bus.on("remove", h2);
    bus.emit("remove", { type: "remove", id: "ent_1", key: "test" });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it("off() removes a handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("entity", handler);
    bus.off("entity", handler);
    bus.emit("entity", {
      type: "entity",
      entity: {
        id: "ent_1",
        key: "test",
        kind: "custom",
        span: { start: 0, end: 4 },
        text: "test",
        value: null,
        confidence: 1,
        status: "confirmed",
      },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("clear() removes all handlers", () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.on("entity", handler);
    bus.on("remove", handler);
    bus.clear();

    bus.emit("entity", {
      type: "entity",
      entity: {
        id: "ent_1",
        key: "test",
        kind: "custom",
        span: { start: 0, end: 4 },
        text: "test",
        value: null,
        confidence: 1,
        status: "confirmed",
      },
    });
    bus.emit("remove", { type: "remove", id: "ent_1", key: "test" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not crash if handler throws", () => {
    const bus = new EventBus();
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();

    bus.on("entity", bad);
    bus.on("entity", good);

    bus.emit("entity", {
      type: "entity",
      entity: {
        id: "ent_1",
        key: "test",
        kind: "custom",
        span: { start: 0, end: 4 },
        text: "test",
        value: null,
        confidence: 1,
        status: "confirmed",
      },
    });

    expect(bad).toHaveBeenCalledOnce();
    expect(good).toHaveBeenCalledOnce();
  });
});
