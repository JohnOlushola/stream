// ---------------------------------------------------------------------------
// Entity Model
// ---------------------------------------------------------------------------

export type EntityKind =
  | "quantity"
  | "datetime"
  | "email"
  | "phone"
  | "url"
  | "person"
  | "place"
  | "custom";

export type EntityStatus = "provisional" | "confirmed";

export interface Span {
  start: number;
  end: number;
}

export interface Entity {
  id: string;
  key: string;
  kind: EntityKind;
  span: Span;
  text: string;
  value: unknown;
  confidence: number;
  status: EntityStatus;
}

// ---------------------------------------------------------------------------
// Plugin System
// ---------------------------------------------------------------------------

export type PluginMode = "realtime" | "commit";

export interface PluginContext {
  /** Full text in the buffer */
  text: string;
  /** Windowed slice of text near the cursor */
  window: { text: string; offset: number };
  /** Current analysis mode */
  mode: PluginMode;
  /** Snapshot of currently-known entities */
  entities: Entity[];
}

export interface PluginResult {
  /** Entities to upsert (matched by key) */
  upsert?: Array<Omit<Entity, "id"> & { key: string }>;
  /** Entity keys to remove */
  remove?: string[];
}

export interface Plugin {
  name: string;
  mode: PluginMode;
  priority?: number;
  run(ctx: PluginContext): PluginResult;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EntityEvent {
  type: "entity";
  entity: Entity;
}

export interface RemoveEvent {
  type: "remove";
  id: string;
  key: string;
}

export interface DiagnosticEvent {
  type: "diagnostic";
  plugin: string;
  message: string;
  severity: "info" | "warn" | "error";
}

export type StreamSenseEvent = EntityEvent | RemoveEvent | DiagnosticEvent;

export interface EventMap {
  entity: EntityEvent;
  remove: RemoveEvent;
  diagnostic: DiagnosticEvent;
}

// ---------------------------------------------------------------------------
// Feed Input
// ---------------------------------------------------------------------------

export interface FeedInput {
  text: string;
  cursor?: number;
  meta?: {
    composing?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Recognizer Options
// ---------------------------------------------------------------------------

export interface ScheduleOptions {
  /** Milliseconds between realtime analysis passes (default: 150) */
  realtimeMs?: number;
  /** Milliseconds of idle before a commit pass fires (default: 700) */
  commitAfterMs?: number;
}

export interface ThresholdOptions {
  /** Minimum confidence for realtime entities (default: 0.8) */
  realtime?: number;
  /** Minimum confidence for commit entities (default: 0.5) */
  commit?: number;
}

export interface RecognizerOptions {
  plugins: Plugin[];
  schedule?: ScheduleOptions;
  thresholds?: ThresholdOptions;
  /** Size of the analysis window in characters around the cursor (default: 200) */
  windowSize?: number;
}

// ---------------------------------------------------------------------------
// Recognizer State (public snapshot)
// ---------------------------------------------------------------------------

export interface RecognizerState {
  text: string;
  revision: number;
  entities: Entity[];
}

// ---------------------------------------------------------------------------
// Recognizer Interface
// ---------------------------------------------------------------------------

export type EventHandler<T> = (event: T) => void;

export interface Recognizer {
  feed(input: FeedInput): void;
  commit(reason?: string): void;
  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void;
  state(): RecognizerState;
  destroy(): void;
}
