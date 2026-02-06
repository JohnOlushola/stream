import type {
  RecognizerOptions,
  RecognizerState,
  EventMap,
  EventHandler,
  FeedInput,
  Recognizer,
} from "./types.js";
import { TextBuffer } from "./internal/text-buffer.js";
import { EntityStore } from "./internal/entity-store.js";
import { EventBus } from "./internal/event-bus.js";
import { Scheduler } from "./internal/scheduler.js";
import { Pipeline } from "./internal/pipeline.js";

const DEFAULTS = {
  realtimeMs: 150,
  commitAfterMs: 700,
  realtimeThreshold: 0.8,
  commitThreshold: 0.5,
  windowSize: 200,
} as const;

/**
 * Creates a StreamSense recognizer instance.
 */
export function createRecognizer(options: RecognizerOptions): Recognizer {
  const buffer = new TextBuffer();
  const store = new EntityStore();
  const bus = new EventBus();

  const windowSize = options.windowSize ?? DEFAULTS.windowSize;

  const pipeline = new Pipeline(
    options.plugins,
    store,
    buffer,
    bus,
    {
      windowSize,
      thresholds: {
        realtime: options.thresholds?.realtime ?? DEFAULTS.realtimeThreshold,
        commit: options.thresholds?.commit ?? DEFAULTS.commitThreshold,
      },
    }
  );

  const scheduler = new Scheduler({
    realtimeMs: options.schedule?.realtimeMs ?? DEFAULTS.realtimeMs,
    commitAfterMs: options.schedule?.commitAfterMs ?? DEFAULTS.commitAfterMs,
    onRealtime() {
      if (!buffer.composing) {
        pipeline.run("realtime");
      }
    },
    onCommit() {
      pipeline.run("commit");
    },
  });

  return {
    feed(input: FeedInput): void {
      buffer.update(input.text, input.cursor, input.meta?.composing);
      scheduler.onInput();
    },

    commit(_reason?: string): void {
      scheduler.cancel();
      pipeline.run("commit");
    },

    on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
      bus.on(event, handler);
    },

    off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
      bus.off(event, handler);
    },

    state(): RecognizerState {
      return {
        text: buffer.text,
        revision: buffer.revision,
        entities: store.all(),
      };
    },

    destroy(): void {
      scheduler.destroy();
      bus.clear();
      store.clear();
    },
  };
}
