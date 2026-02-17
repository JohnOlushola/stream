/**
 * Stream
 * Real-time semantic understanding from streaming text
 */

// Main API
export { createRecognizer } from './recognizer.js'

// Plugins
export { plugins } from './plugins/index.js'
export {
  quantity,
  datetime,
  email,
  url,
  phone,
} from './plugins/index.js'

// Types
export type {
  // Entity types
  Entity,
  EntityKind,
  EntityStatus,
  EntityCandidate,
  Span,

  // Plugin types
  Plugin,
  PluginMode,
  PluginContext,
  PluginContextExtensions,
  PluginResult,

  // Event types
  EntityEvent,
  RemoveEvent,
  DiagnosticEvent,
  DiagnosticSeverity,
  StreamEvent,
  /** @deprecated Use StreamEvent */
  StreamSenseEvent,
  EventHandlers,

  // Recognizer types
  Recognizer,
  RecognizerOptions,
  RecognizerState,
  FeedInput,
  CommitReason,
  ScheduleConfig,
  ThresholdConfig,
} from './types.js'

// Plugin option types
export type {
  QuantityPluginOptions,
  DateTimePluginOptions,
  EmailPluginOptions,
  UrlPluginOptions,
  PhonePluginOptions,
} from './plugins/index.js'
