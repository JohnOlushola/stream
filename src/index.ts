// StreamSense — Real-time semantic understanding from streaming text.

export { createRecognizer } from "./recognizer.js";

// Re-export all types
export type {
  Entity,
  EntityKind,
  EntityStatus,
  Span,
  Plugin,
  PluginMode,
  PluginContext,
  PluginResult,
  FeedInput,
  RecognizerOptions,
  RecognizerState,
  ScheduleOptions,
  ThresholdOptions,
  Recognizer,
  EventMap,
  EventHandler,
  EntityEvent,
  RemoveEvent,
  DiagnosticEvent,
  StreamSenseEvent,
} from "./types.js";

// Re-export built-in plugins as a namespace
export * as plugins from "./plugins/index.js";
