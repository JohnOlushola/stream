import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRecognizer } from "./recognizer.js";
import { _resetIdCounter } from "./internal/entity-store.js";
import { quantity } from "./plugins/quantity.js";
import { email } from "./plugins/email.js";
import type { Entity, EntityEvent, RemoveEvent, Plugin } from "./types.js";

describe("createRecognizer", () => {
  beforeEach(() => {
    _resetIdCounter();
  });

  it("feed + commit produces entity events", () => {
    const r = createRecognizer({
      plugins: [quantity()],
    });

    const entities: Entity[] = [];
    r.on("entity", (e: EntityEvent) => entities.push(e.entity));

    r.feed({ text: "convert 10 km to mi" });
    r.commit();

    expect(entities.length).toBeGreaterThanOrEqual(1);
    expect(entities[0].kind).toBe("quantity");
    expect(entities[0].text).toBe("10 km");
    expect(entities[0].status).toBe("confirmed");

    r.destroy();
  });

  it("state() returns current entities", () => {
    const r = createRecognizer({
      plugins: [quantity()],
    });

    r.feed({ text: "5 kg and 10 km" });
    r.commit();

    const state = r.state();
    expect(state.entities).toHaveLength(2);
    expect(state.text).toBe("5 kg and 10 km");
    expect(state.revision).toBe(1);

    r.destroy();
  });

  it("removes stale entities when text changes", () => {
    const r = createRecognizer({
      plugins: [quantity()],
    });

    const removals: string[] = [];
    r.on("remove", (e: RemoveEvent) => removals.push(e.key));

    r.feed({ text: "10 km" });
    r.commit();

    r.feed({ text: "hello world" });
    r.commit();

    expect(removals.length).toBeGreaterThanOrEqual(1);
    expect(r.state().entities).toHaveLength(0);

    r.destroy();
  });

  it("works with multiple plugins", () => {
    const r = createRecognizer({
      plugins: [quantity(), email()],
    });

    r.feed({ text: "send 10 km to alice@example.com" });
    r.commit();

    const state = r.state();
    expect(state.entities.length).toBe(2);

    const kinds = state.entities.map((e) => e.kind).sort();
    expect(kinds).toEqual(["email", "quantity"]);

    r.destroy();
  });

  it("preserves entity id on update (stable keys)", () => {
    const r = createRecognizer({
      plugins: [quantity()],
    });

    r.feed({ text: "10 km" });
    r.commit();

    const id1 = r.state().entities[0].id;

    // Same text => same key => same id
    r.feed({ text: "10 km" });
    r.commit();

    const id2 = r.state().entities[0].id;
    expect(id2).toBe(id1);

    r.destroy();
  });

  it("emits diagnostic on plugin error", () => {
    const badPlugin: Plugin = {
      name: "bad",
      mode: "realtime",
      run() {
        throw new Error("plugin crashed");
      },
    };

    const r = createRecognizer({
      plugins: [badPlugin],
    });

    const diagnostics: Array<{ plugin: string; message: string }> = [];
    r.on("diagnostic", (e) => diagnostics.push(e));

    r.feed({ text: "test" });
    r.commit();

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].plugin).toBe("bad");
    expect(diagnostics[0].message).toBe("plugin crashed");

    r.destroy();
  });

  it("filters entities below confidence threshold", () => {
    const lowConfPlugin: Plugin = {
      name: "low",
      mode: "realtime",
      run({ window, mode }) {
        return {
          upsert: [
            {
              key: "test:low",
              kind: "custom",
              span: { start: 0, end: 4 },
              text: "test",
              value: null,
              confidence: 0.3, // below default commit threshold of 0.5
              status: mode === "commit" ? "confirmed" : "provisional",
            },
          ],
        };
      },
    };

    const r = createRecognizer({
      plugins: [lowConfPlugin],
    });

    r.feed({ text: "test" });
    r.commit();

    expect(r.state().entities).toHaveLength(0);

    r.destroy();
  });

  it("off() removes event handler", () => {
    const r = createRecognizer({ plugins: [quantity()] });

    const handler = vi.fn();
    r.on("entity", handler);
    r.off("entity", handler);

    r.feed({ text: "10 km" });
    r.commit();

    expect(handler).not.toHaveBeenCalled();

    r.destroy();
  });

  it("destroy() prevents further events", () => {
    const r = createRecognizer({ plugins: [quantity()] });

    const handler = vi.fn();
    r.on("entity", handler);

    r.destroy();

    r.feed({ text: "10 km" });
    // commit after destroy — handler cleared
    expect(handler).not.toHaveBeenCalled();
  });

  it("skips analysis during IME composition", () => {
    vi.useFakeTimers();

    const r = createRecognizer({
      plugins: [quantity()],
      schedule: { realtimeMs: 50, commitAfterMs: 200 },
    });

    const entities: Entity[] = [];
    r.on("entity", (e: EntityEvent) => entities.push(e.entity));

    r.feed({ text: "10 km", meta: { composing: true } });
    vi.advanceTimersByTime(100);

    // No entities — composing is true
    expect(entities).toHaveLength(0);

    vi.useRealTimers();
    r.destroy();
  });
});
