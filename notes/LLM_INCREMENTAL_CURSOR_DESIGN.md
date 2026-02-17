# Design: LLM Incremental Streaming, Commit vs Realtime, and Cursor Awareness

**No code.** This doc covers: (1) incremental/streaming LLM responses, (2) a setting for on-commit vs realtime LLM, (3) making the LLM cursor-aware in a cheap and scalable way, and (4) what engine changes (if any) are required.

---

## 1. Incremental streaming

### What we want

- Today: the LLM plugin sends one request, waits for the full response, parses the full JSON, then returns one `PluginResult` with all entities. The UI only updates after the entire response is in.
- Goal: **stream** the API response (e.g. OpenAI SSE or compatible streaming) and **emit entities as they are produced** (or as we parse partial chunks), so the user sees highlights appear progressively instead of one big delay.

### What “streaming” implies

- **API:** Use a streaming endpoint (e.g. `stream: true` in the chat completion request). The response is a sequence of chunks (e.g. delta content or NDJSON lines).
- **Parsing:** We need to either (a) parse partial JSON as chunks arrive and emit entities as soon as we have a complete `{ start, end, kind, text }` object, or (b) use a format that is naturally incremental (e.g. one JSON object per line, or a dedicated streaming NER API that sends entities one by one). Option (a) is brittle (JSON can be split across chunks); (b) or “emit whenever we have a complete entity in the buffer” is safer.
- **Who applies updates:** Today the plugin returns a single `PluginResult`; the **runner** calls `store.reconcile(result)` once. For streaming we need the plugin to **push** entities to the engine as they arrive, so the engine can upsert and emit events incrementally.

### Engine change required: **yes**

- **Current contract:** `run(ctx): Promise<PluginResult>`. One return value at the end.
- **Streaming contract:** We need a way for a plugin to deliver results **multiple times** during a single run. Two main options:
  - **Callback on context:** Extend `PluginContext` with an optional `onEntity?(candidate: EntityCandidate) => void` (or `onChunk?(result: PluginResult) => void`). The runner/recognizer would provide this callback when calling the plugin. When the LLM plugin receives a chunk that contains a complete entity, it calls `ctx.onEntity(candidate)`. The engine then applies that candidate (upsert + emit entity event) without waiting for the full run to finish. When the stream ends, the plugin still returns a final `PluginResult` (e.g. full list for reconciliation, or empty if we already applied everything via callbacks). Reconciliation semantics need to be defined: e.g. “streaming plugin: apply each callback immediately; final result is used only for removals or for a final merge.”
  - **Async iterator:** Plugin returns `AsyncGenerator<PluginResult, void, void>` or `Promise<{ result: PluginResult; stream?: AsyncIterator<PluginResult> }>`. The runner would iterate and call reconcile (or upsert) on each yielded value. This is a bigger API change (return type is no longer just `Promise<PluginResult>`) and might complicate the runner’s merge logic (multiple PluginResults from one plugin in one “run”).
- **Recommendation:** Context callback is simpler and keeps the existing “return a Promise<PluginResult>” for the final result. Engine adds optional `ctx.onEntity` (or `ctx.onChunk`); when present, the runner/recognizer invokes it for each call and performs an upsert + emit. Final `PluginResult` can be used for a last reconciliation (e.g. to remove entities that the stream said to remove, or to do nothing if we already applied everything).
- **Cancellation:** While the stream is in flight, the user may type again. We should **abort** the in-flight request and ignore any further chunks. That implies: (a) the engine passes an `AbortSignal` (or similar) in the context when it starts a run, and clears/aborts it when a new run is scheduled (e.g. new feed); (b) the plugin passes that signal to `fetch()` and stops calling `onEntity` after abort. So the engine must support “cancel the current run when the next one starts” and expose that to plugins. Today the recognizer does not cancel an in-flight `runCommit()` when a new `feed()` happens; the old run still completes. So we need an explicit **cancel** or **abort** mechanism for long-running (streaming) plugin runs.

**Summary (streaming):** Engine needs (1) optional callback on context for incremental entities (or chunks), and (2) abort/cancel for in-flight runs (e.g. AbortSignal in context) so we can stop streaming when the buffer changes.

---

## 2. Setting: on commit vs realtime

### What we want

- A **setting** (e.g. in the React example UI) that lets the user choose:
  - **LLM on commit only:** Current behaviour. LLM runs only when the user pauses (e.g. 600 ms) or presses Enter. Lower API usage, higher latency for first LLM highlight.
  - **LLM on realtime:** LLM runs on the same debounced schedule as regex (e.g. 150 ms after last keystroke). Sooner highlights, higher API usage and cost.

### How it fits the engine today

- The engine already has **plugin mode:** `realtime` vs `commit`. The runner has `realtimePlugins` and `commitPlugins`. `runRealtime()` runs only realtime plugins; `runCommit()` runs **both** realtime and commit plugins.
- So we do **not** need an engine change for “run LLM on commit” vs “run LLM on realtime.” We only need the **plugin instance** to be created with the right `mode`. For example: `createLlmPlugin({ mode: 'realtime' })` vs `createLlmPlugin({ mode: 'commit' })`. The app reads the user setting and registers the LLM plugin with the chosen mode.
- **Caveat:** If LLM runs in realtime with the same debounce as regex (e.g. 150 ms), we could hit the API very frequently while the user is typing. That can be expensive and rate-limited. So we might want:
  - A **longer debounce** for realtime when “LLM realtime” is on (e.g. 400–600 ms), or
  - To run LLM realtime only on **window** (see below) to reduce tokens and cost.
  The scheduler’s `realtimeMs` is global; we don’t have per-plugin debounce. So the app could either (a) set a higher `realtimeMs` when the user selects “LLM realtime” (affects regex too), or (b) keep 150 ms for regex and have the LLM plugin **no-op** on some realtime invocations (e.g. only run every N-th time or when text length changed by at least X). Option (b) would be entirely inside the plugin (no engine change). Option (a) is an app-level config choice.

**Summary (setting):** No engine change. Expose a UI setting and create the LLM plugin with `mode: 'realtime'` or `mode: 'commit'`. Optionally use a longer global realtime debounce or plugin-internal throttling when LLM is in realtime to control cost.

---

## 3. Cursor awareness: cheap and scalable

### What the engine already provides

- **PluginContext** already has:
  - `text`: full buffer text
  - `window`: `{ text: string, offset: number }` — a slice of the buffer centered on the cursor (e.g. 500 chars), with `offset` so we can map window indices back to document indices
  - `cursor`: character index of the cursor
- So the **engine is already cursor-aware.** The LLM plugin today simply **does not use** `ctx.window` or `ctx.cursor`. Making the LLM “cursor-aware” is a **plugin-side** choice of what to send to the API; no new engine API is required.

### Cheap and scalable options

**Option A: Window-only input (recommended for realtime)**

- Send **only** `ctx.window.text` to the LLM (and optionally tell the model “this is a slice of a larger document starting at character offset N” if we want it to return global indices; or we can add `window.offset` to all returned spans ourselves).
- **Cost:** Fixed tokens per request (e.g. ~500 characters = on the order of 100–200 tokens), independent of document length. **Scalable.**
- **Latency:** Shorter context = faster inference. **Cheap.**
- **Cursor focus:** The window is centered on the cursor, so the model is implicitly focused on “where the user is editing.” No need to say “cursor at N” in the prompt.
- **Caveat:** We only get entities inside the window. For realtime that’s consistent with how regex plugins already work (they run on the same window). For commit we could either (a) run LLM on full text (current behaviour) to get full-doc coverage when the user pauses, or (b) run on window only for commit too (cheaper, but we’d only have entities near the cursor unless we merge with previous runs).

**Option B: Full text + cursor in prompt**

- Keep sending full `ctx.text` and add one line to the system or user prompt: e.g. “The cursor is at character index N. Prefer or prioritize entities near the cursor.”
- **Cost:** Same as today (full document tokens). Not cheaper; scalability is unchanged.
- **Cursor awareness:** The model *might* prioritize or disambiguate near the cursor, but behaviour is prompt-dependent and not guaranteed. No structural guarantee that spans are correct near the cursor.
- **Engine:** No change. Plugin just reads `ctx.cursor` and injects it into the prompt.

**Option C: Full text + structured cursor in request**

- Same as B but pass cursor as a separate field (e.g. in a JSON blob or API metadata) so the model can use it programmatically. Same cost and scalability as B; slightly cleaner than free-text “cursor at N.”

**Recommendation**

- **Realtime:** Use **window-only** (Option A). Plugin sends `ctx.window.text`, and adds `window.offset` to every returned span so spans are in global document coordinates. Cheap, scalable, and naturally cursor-focused. No engine change.
- **Commit:** Either (a) keep full text for a complete pass when the user pauses, or (b) use window-only here too and accept that commit only updates entities near the cursor (and rely on previous realtime runs for the rest). Trade-off: full-doc commit vs lower cost and simpler behaviour.
- **Optional:** If we ever want “full text but hint at cursor” without changing token count, we can add Option B/C on top (e.g. for commit with full text). Engine still unchanged.

**Summary (cursor):** No engine change. Use existing `ctx.window` and `ctx.cursor`. For cheap and scalable behaviour, send only `ctx.window.text` to the LLM (especially in realtime) and map spans back with `window.offset`.

---

## 4. Engine changes summary

| Feature | Engine change? | What’s needed |
|--------|----------------|----------------|
| **Incremental streaming** | **Yes** | (1) Optional callback on `PluginContext` (e.g. `onEntity` or `onChunk`) so plugins can push partial results; (2) Abort/cancel for in-flight runs (e.g. `AbortSignal` in context) so the engine can cancel when the user types again and the plugin can abort `fetch` and stop calling the callback. |
| **Setting: commit vs realtime** | **No** | Plugin is created with `mode: 'realtime'` or `mode: 'commit'` based on user setting. Optional: app-level realtime debounce or plugin-internal throttling for cost control. |
| **Cursor awareness** | **No** | Context already has `cursor` and `window`. Plugin uses them (e.g. send only `window.text`, add `window.offset` to spans). |

---

## 5. Interaction of the three

- **Realtime + window-only + streaming:** LLM runs on a debounce (e.g. 150–600 ms), sends only the window to the API, streams the response, and pushes entities via the new callback as they arrive. Highlights appear quickly and incrementally near the cursor, with minimal token cost and abort when the user types.
- **Commit + full text (optional) + streaming:** On commit, LLM can still run on full text for full-doc coverage; if we add streaming, we still get progressive highlights during that commit run. Cursor can be passed as a hint (Option B/C) if desired.
- **Setting:** User picks “LLM: commit only” vs “LLM: realtime.” Realtime implies window-only and possibly longer debounce in the app; commit can stay full-text or be switched to window-only for cost.

No code in this doc; it’s a design and engine-impact summary only.
