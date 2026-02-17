/**
 * Stream Core Types
 * Real-time semantic understanding from streaming text
 */

// =============================================================================
// Entity Types
// =============================================================================

/**
 * Standard entity kinds supported by Stream
 */
export type EntityKind =
  | 'quantity'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'person'
  | 'place'
  | 'custom'

/**
 * Text span indicating position in the source text
 */
export type Span = {
  start: number
  end: number
}

/**
 * Entity status indicating confidence level
 * - provisional: detected during realtime pass, may change
 * - confirmed: detected during commit pass, stable
 */
export type EntityStatus = 'provisional' | 'confirmed'

/**
 * A detected semantic entity in the text
 */
export type Entity = {
  /** Unique identifier for this entity instance */
  id: string
  /** Stable key for deduplication (e.g., "quantity:10:km:8:13") */
  key: string
  /** The kind of entity */
  kind: EntityKind
  /** Position in the source text */
  span: Span
  /** The matched text */
  text: string
  /** Parsed/structured value */
  value: unknown
  /** Confidence score (0-1) */
  confidence: number
  /** Whether this entity is provisional or confirmed */
  status: EntityStatus
}

/**
 * Entity without ID, used for upsert operations
 */
export type EntityCandidate = Omit<Entity, 'id'> & { key: string }

// =============================================================================
// Plugin Types
// =============================================================================

/**
 * Plugin execution mode
 * - realtime: runs frequently during typing (~150ms)
 * - commit: runs after pause or explicit commit (~700ms)
 */
export type PluginMode = 'realtime' | 'commit'

/**
 * Optional extensions to plugin context for streaming/incremental plugins.
 * Provided by the engine when running plugins; plugins can use them to push
 * entities as they are produced (e.g. during LLM stream) and to respect abort.
 */
export type PluginContextExtensions = {
  /** Callback to push a single entity immediately (streaming). When used, plugin should still return final PluginResult for reconcile/removals. */
  onEntity?: (candidate: EntityCandidate) => void
  /** AbortSignal to cancel in-flight work when the user types again or a new run starts. */
  signal?: AbortSignal
}

/**
 * Context provided to plugins during execution
 */
export type PluginContext = {
  /** Full text content */
  text: string
  /** Windowed text near cursor for efficient analysis */
  window: {
    text: string
    offset: number
  }
  /** Current execution mode */
  mode: PluginMode
  /** Currently detected entities */
  entities: Entity[]
  /** Current cursor position */
  cursor: number
} & PluginContextExtensions

/**
 * Result returned by a plugin
 */
export type PluginResult = {
  /** Entities to upsert (add or update) */
  upsert?: EntityCandidate[]
  /** Entity keys to remove */
  remove?: string[]
}

/**
 * A plugin that extracts semantic entities from text
 */
export type Plugin = {
  /** Unique name for this plugin */
  name: string
  /** When this plugin runs */
  mode: PluginMode
  /** Priority for execution order (lower runs first) */
  priority?: number
  /** Execute the plugin */
  run(ctx: PluginContext): PluginResult | Promise<PluginResult>
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event emitted when an entity is detected or updated
 */
export type EntityEvent = {
  type: 'entity'
  entity: Entity
  /** Whether this is an update to an existing entity */
  isUpdate: boolean
}

/**
 * Event emitted when an entity is removed
 */
export type RemoveEvent = {
  type: 'remove'
  id: string
  key: string
}

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info'

/**
 * Event emitted for diagnostics/debugging
 */
export type DiagnosticEvent = {
  type: 'diagnostic'
  severity: DiagnosticSeverity
  message: string
  span?: Span
  source?: string
}

/**
 * Union of all event types
 */
export type StreamEvent = EntityEvent | RemoveEvent | DiagnosticEvent

/** @deprecated Use StreamEvent */
export type StreamSenseEvent = StreamEvent

/**
 * Event handler map for type-safe subscriptions
 */
export type EventHandlers = {
  entity: (event: EntityEvent) => void
  remove: (event: RemoveEvent) => void
  diagnostic: (event: DiagnosticEvent) => void
}

// =============================================================================
// Recognizer Types
// =============================================================================

/**
 * Input for the feed() method
 */
export type FeedInput = {
  /** Current text content */
  text: string
  /** Current cursor position */
  cursor?: number
  /** Optional metadata */
  meta?: {
    /** Whether IME composition is active */
    composing?: boolean
  }
}

/**
 * Schedule configuration for analysis passes
 */
export type ScheduleConfig = {
  /** Debounce interval for realtime passes (ms) */
  realtimeMs: number
  /** Delay after last input before commit pass (ms) */
  commitAfterMs: number
}

/**
 * Confidence thresholds for entity detection
 */
export type ThresholdConfig = {
  /** Minimum confidence for realtime detection */
  realtime: number
  /** Minimum confidence for commit detection */
  commit: number
}

/**
 * Configuration options for createRecognizer()
 */
export type RecognizerOptions = {
  /** Plugins to use for entity extraction */
  plugins: Plugin[]
  /** Schedule configuration */
  schedule?: Partial<ScheduleConfig>
  /** Confidence thresholds */
  thresholds?: Partial<ThresholdConfig>
  /** Window size for analysis (characters around cursor) */
  windowSize?: number
}

/**
 * Current state of the recognizer
 */
export type RecognizerState = {
  /** Current text */
  text: string
  /** Current revision number */
  revision: number
  /** All detected entities */
  entities: Entity[]
  /** Whether a commit is pending */
  pendingCommit: boolean
}

/**
 * Reason for commit
 */
export type CommitReason = 'enter' | 'blur' | 'timeout' | 'manual'

/**
 * The main Recognizer interface
 */
export type Recognizer = {
  /** Feed new text input */
  feed(input: FeedInput): void
  /** Force a commit pass */
  commit(reason: CommitReason): void
  /** Get current state */
  state(): RecognizerState
  /** Subscribe to events */
  on<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void
  /** Unsubscribe from events */
  off<K extends keyof EventHandlers>(event: K, handler: EventHandlers[K]): void
  /** Cleanup and destroy */
  destroy(): void
}
