import type { Plugin, PluginContext, PluginMode, Entity } from "../types.js";
import type { EntityStore, StoreChange } from "./entity-store.js";
import type { TextBuffer } from "./text-buffer.js";
import type { EventBus } from "./event-bus.js";

export interface PipelineOptions {
  windowSize: number;
  thresholds: { realtime: number; commit: number };
}

/**
 * Pipeline — sorts and runs plugins, merges results into the EntityStore,
 * and emits events through the EventBus.
 */
export class Pipeline {
  private _plugins: Plugin[];
  private _store: EntityStore;
  private _buffer: TextBuffer;
  private _bus: EventBus;
  private _opts: PipelineOptions;

  constructor(
    plugins: Plugin[],
    store: EntityStore,
    buffer: TextBuffer,
    bus: EventBus,
    opts: PipelineOptions
  ) {
    // Sort by priority (lower = earlier), defaulting to 100
    this._plugins = [...plugins].sort(
      (a, b) => (a.priority ?? 100) - (b.priority ?? 100)
    );
    this._store = store;
    this._buffer = buffer;
    this._bus = bus;
    this._opts = opts;
  }

  /**
   * Run all plugins that match the given mode.
   */
  run(mode: PluginMode): void {
    const threshold =
      mode === "realtime"
        ? this._opts.thresholds.realtime
        : this._opts.thresholds.commit;

    const win = this._buffer.window(this._opts.windowSize);

    const ctx: PluginContext = {
      text: this._buffer.text,
      window: win,
      mode,
      entities: this._store.all(),
    };

    // Collect all results from plugins that run in this mode
    // (commit mode also runs realtime plugins)
    const allUpsert: Array<Omit<Entity, "id"> & { key: string }> = [];
    const allRemove: string[] = [];
    const activeKeys = new Set<string>();
    const activeKinds = new Set<string>();

    for (const plugin of this._plugins) {
      if (mode === "realtime" && plugin.mode !== "realtime") continue;
      // In commit mode, run all plugins (both realtime and commit)

      // Track plugin name as an active kind — even if this plugin
      // returns zero matches, entities it previously produced should
      // be cleaned up via diff-based removal.
      activeKinds.add(plugin.name);

      try {
        const result = plugin.run(ctx);

        if (result.upsert) {
          for (const item of result.upsert) {
            // Apply confidence threshold filter
            if (item.confidence >= threshold) {
              // In commit mode, promote status to confirmed
              if (mode === "commit" && item.status === "provisional") {
                allUpsert.push({ ...item, status: "confirmed" });
              } else {
                allUpsert.push(item);
              }
              activeKeys.add(item.key);
            }
            // Also track kinds from results (for custom plugins whose
            // name might not match their entity kind)
            activeKinds.add(item.kind);
          }
        }

        if (result.remove) {
          allRemove.push(...result.remove);
        }
      } catch (err) {
        this._bus.emit("diagnostic", {
          type: "diagnostic",
          plugin: plugin.name,
          message: err instanceof Error ? err.message : String(err),
          severity: "error",
        });
      }
    }

    // Apply changes to the store
    const change: StoreChange = this._store.apply(allUpsert, allRemove);

    // Diff-based removal: remove entities of active kinds that are no longer found
    const stale = this._store.removeStale(activeKeys, activeKinds);
    change.removed.push(...stale);

    // Emit events
    for (const entity of change.upserted) {
      this._bus.emit("entity", { type: "entity", entity });
    }
    for (const entity of change.removed) {
      this._bus.emit("remove", { type: "remove", id: entity.id, key: entity.key });
    }
  }
}
