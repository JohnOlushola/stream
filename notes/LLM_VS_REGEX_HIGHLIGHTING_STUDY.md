# Study: Why Regex Highlighting Works Better Than LLM (and the Latency Gap)

**Goal:** Investigate why entity highlighting appears to work well for regex-based detection but less so for LLM-based detection, and why LLM feels slower. No implementation in this doc — research and design only.

---

## 1. Architecture: Regex vs LLM in Stream

### 1.1 Regex plugins (e.g. quantity, email, datetime, url, phone)

- **Mode:** `realtime` (and again on commit with lower threshold).
- **Input:** Use **windowed text** from `ctx.window`: a slice of the buffer centered on **cursor** (`window.text` + `window.offset`). Typical window size ~500 chars.
- **How spans are produced:** Run regex over `window.text`; each match gets `start = window.offset + match.index`, `end = start + match.length`. So spans are in **global document coordinates** and derived deterministically from the same buffer state the UI is rendering.
- **When they run:** On every `feed()` after a short debounce (~150ms realtime, ~600ms commit). So highlights appear quickly as you type and again when you pause/commit.
- **Cursor awareness:** Yes — analysis is literally restricted to text around the cursor; spans are offset into the full document.

### 1.2 LLM plugin

- **Mode:** `commit` only. No realtime.
- **Input:** Uses **only** `ctx.text` (full buffer text). Does **not** use `ctx.cursor` or `ctx.window`.
- **How spans are produced:** Send full text to the API; model returns a list of `{ start, end, kind, text }` (character indices). We validate and map to Stream entities. Spans are whatever the model says — no local derivation from the buffer.
- **When it runs:** Only when a commit happens (pause after ~600ms or explicit Enter). Then one async HTTP call; highlights appear only after the response comes back.
- **Cursor awareness:** No — the model is not told where the cursor is or which part of the text is “in focus.”

So from the start we have:
- **Regex:** Cursor-aware, windowed, synchronous (after debounce), spans derived from the same document state.
- **LLM:** Commit-only, full text, asynchronous, spans come from the model and are not tied to cursor or window.

---

## 2. Why LLM Highlighting Can Be Worse

### 2.1 Character-index accuracy (tokenization / Unicode)

- LLMs work in **tokens**, not characters. When we ask for “start and end character indices,” the model has to map from its internal representation to character offsets.
- Known issues in the literature and in practice:
  - **Token boundaries ≠ character boundaries** (e.g. subword tokenization, multi-byte UTF-8).
  - **Off-by-one** (inclusive vs exclusive end, 0- vs 1-based).
  - **Whitespace / newlines** counted differently.
- So even with a good prompt and structured output, we can get **systematic drift** or **occasional wrong spans**, especially near punctuation or non-ASCII. Regex, by contrast, uses the same string and `match.index`/length, so indices are exact for that document.

### 2.2 Stale response (text drift)

- Commit run is **async**: we call `buildContext()` once at the start of `runCommit()`, then `runner.runCommit(context)` runs all plugins. The LLM plugin does `await fetch(...)`; only when the response returns do we build candidates and call `store.reconcile(allCandidates)`.
- **While the request is in flight**, the user can keep typing. `feed()` updates the buffer and resets the commit timer, but the in-flight `runCommit()` still completes with the **old** `context` (old text).
- So we can **reconcile entities whose spans refer to a previous snapshot** of the document. The store does not re-validate spans against the **current** buffer when the LLM response arrives. Result:
  - Entities can point at the wrong slice (e.g. “hello” vs “hello world”).
  - Or spans can be **out of range** for the current text (e.g. document shortened). The UI (StreamEditor) clamps to `doc.length`, so we can get **wrong or collapsed highlights**.
- Regex does not have this to the same degree: by the time realtime/commit runs, we usually have just updated the buffer, and the same run uses that buffer’s window/text. No long network delay in between.

### 2.3 No cursor or window context for the model

- We do **not** pass cursor position or a “focus region” to the LLM. So:
  - The model cannot prioritize or disambiguate entities **near where the user is editing**.
  - For highlighting specifically, the main issue is still **span correctness** and **timing**; cursor would matter more for UX (e.g. which entities to show first) and for reducing latency (e.g. only run LLM on a window). So “LLM unaware of cursor” is a real architectural difference but may matter more for latency and relevance than for “highlight at wrong place” per se.

### 2.4 Validation is at request time, not response time

- We validate LLM entities with `textLength = ctx.text.length` (the text at **commit start**). We do not re-check that `start`/`end` are within the **current** buffer length when we apply the response. So stale responses can leave us with out-of-bounds spans until the UI clamps them.

---

## 3. Latency

### 3.1 Why regex feels fast

- **Realtime** runs on a short debounce (~150ms) and uses only the local window; no network. Highlights appear shortly after typing stops.
- **Commit** runs after a longer idle (~600ms) or on Enter; still local, so commit-based regex highlights also appear quickly.

### 3.2 Why LLM feels slower

- **Commit-only:** No realtime LLM. So the **first** LLM-based highlight can only appear after:
  - User pauses or presses Enter (commit),
  - Plus **network RTT** to the API,
  - Plus **model inference** time (e.g. hundreds of ms to a few seconds depending on model and length).
- So there is a **built-in delay** (commit + network + inference) before any LLM entity appears. Regex highlights can already be visible from the realtime pass before the LLM response comes back.
- If we ever sent cursor or window to the LLM, we could in principle run LLM on a **window** and/or **stream** the response to reduce perceived latency, but that would be a design change.

---

## 4. Summary Table

| Factor | Regex | LLM |
|--------|--------|-----|
| **When it runs** | Realtime (debounced) + commit | Commit only |
| **Input** | Window around cursor (+ offset) | Full text only |
| **Cursor used?** | Yes (window center) | No |
| **How spans are obtained** | Exact from `match.index` + length + window offset | Model output (character indices) |
| **Index accuracy** | Exact (same string as UI) | Subject to tokenization/Unicode/off-by-one |
| **Stale response risk** | Low (same tick / same buffer) | High (response can apply to old text) |
| **Latency** | Low (local, debounced) | High (commit + network + inference) |

---

## 5. Directions for Later (no code here)

- **Stale response:** When applying LLM results, either (a) re-build context from current buffer and drop/remap entities if text changed, or (b) send a “version” or hash with the request and ignore responses that don’t match the current document.
- **Index accuracy:** Prompting, few-shot examples with exact indices, or a post-pass that snaps spans to the actual substring (e.g. search for `entity.text` in the document and use that range if it matches).
- **Cursor/window:** Optionally send cursor and/or a window to the API so the model can focus and so we can run LLM on a subset of text to reduce latency and cost.
- **Latency:** Consider streaming the LLM response (emit entities as they’re produced), or running LLM on a window for realtime-like behavior with lower latency than full-doc commit.

---

## 6. References (conceptual)

- NER with LLMs and character spans: common issues with token vs character alignment (e.g. in spaCy/LF docs, Hugging Face NER docs).
- “Structured output” for span extraction: OpenAI structured outputs, tool use for NER — still need to validate and often correct indices.
- Incremental/streaming NER: doing entity extraction in a streaming or windowed way to reduce latency (relevant if we want LLM to feel closer to regex timing).
