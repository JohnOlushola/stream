/**
 * StreamSense Benchmarks
 *
 * Compares StreamSense against:
 *   - compromise (general NLP / entity extraction)
 *   - chrono-node (date/time parsing)
 *   - anchorme (URL/email/phone detection)
 *
 * Three benchmark categories:
 *   1. Single-pass extraction (batch — who's fastest on one call?)
 *   2. Incremental / typing simulation (per-keystroke — the real-time use case)
 *   3. Per-feed latency (single keystroke cost in a live session)
 */

import { Bench } from "tinybench";
import { createRecognizer } from "../src/recognizer.js";
import { quantity } from "../src/plugins/quantity.js";
import { datetime } from "../src/plugins/datetime.js";
import { email } from "../src/plugins/email.js";
import { url } from "../src/plugins/url.js";
import { phone } from "../src/plugins/phone.js";
import { SHORT, MEDIUM, LONG, typingSequence } from "./fixtures.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecognizer() {
  return createRecognizer({
    plugins: [quantity(), datetime(), email(), url(), phone()],
    schedule: { realtimeMs: 0, commitAfterMs: 0 },
  });
}

function fmtOps(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
}

function fmtMs(ms: number): string {
  if (ms < 0.001) return `${(ms * 1_000).toFixed(2)} µs`;
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  return `${ms.toFixed(1)} ms`;
}

function printTable(bench: Bench) {
  const rows = bench.tasks.map((t) => {
    const r = t.result!;
    return {
      name: t.name,
      opsPerSec: r.throughput.mean,
      avgMs: r.latency.mean,
      p99Ms: r.latency.p99 ?? 0,
    };
  }).sort((a, b) => b.opsPerSec - a.opsPerSec);

  const nameWidth = Math.max(20, ...rows.map((r) => r.name.length)) + 2;

  console.log(
    "  " +
      "Name".padEnd(nameWidth) +
      "ops/sec".padStart(14) +
      "avg".padStart(14) +
      "p99".padStart(14)
  );
  console.log("  " + "─".repeat(nameWidth + 42));

  for (const r of rows) {
    console.log(
      "  " +
        r.name.padEnd(nameWidth) +
        fmtOps(r.opsPerSec).padStart(14) +
        fmtMs(r.avgMs).padStart(14) +
        fmtMs(r.p99Ms).padStart(14)
    );
  }
  console.log();
}

// ---------------------------------------------------------------------------
// Lazy imports (compromise is heavy — ~400ms to import)
// ---------------------------------------------------------------------------

let _compromise: ((text: string) => { values: () => { json: () => unknown[] }; emails: () => { json: () => unknown[] }; urls: () => { json: () => unknown[] } }) | null = null;
async function getCompromise() {
  if (!_compromise) {
    const mod = await import("compromise");
    _compromise = (mod.default || mod) as typeof _compromise;
  }
  return _compromise!;
}

let _chrono: { parse: (text: string) => unknown[] } | null = null;
async function getChrono() {
  if (!_chrono) {
    _chrono = await import("chrono-node") as typeof _chrono;
  }
  return _chrono!;
}

let _anchorme: { list: (input: string) => unknown[] } | null = null;
async function getAnchorme() {
  if (!_anchorme) {
    const mod = await import("anchorme");
    const fn = (mod as Record<string, unknown>).default || mod;
    _anchorme = fn as typeof _anchorme;
  }
  return _anchorme!;
}

// ---------------------------------------------------------------------------
// 1. Single-pass extraction
// ---------------------------------------------------------------------------

async function benchSinglePass() {
  console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
  console.log("┃  BENCHMARK 1: Single-pass extraction                      ┃");
  console.log("┃  One call to extract all entities from the text.           ┃");
  console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
  console.log();

  const nlp = await getCompromise();
  const chrono = await getChrono();
  const anchorme = await getAnchorme();

  for (const [label, text] of [
    ["short", SHORT],
    ["medium", MEDIUM],
    ["long", LONG],
  ] as const) {
    console.log(`  ▸ ${label} (${text.length} chars)`);

    const bench = new Bench({ time: 2000, warmupTime: 500 });

    bench
      .add(`StreamSense (all plugins)`, () => {
        const r = makeRecognizer();
        r.feed({ text });
        r.commit();
        r.destroy();
      })
      .add(`compromise`, () => {
        const doc = nlp(text);
        doc.values().json();
        doc.emails().json();
        doc.urls().json();
      })
      .add(`chrono-node (dates only)`, () => {
        chrono.parse(text);
      })
      .add(`anchorme (urls/emails)`, () => {
        anchorme.list(text);
      });

    await bench.run();
    printTable(bench);
  }
}

// ---------------------------------------------------------------------------
// 2. Incremental typing simulation
// ---------------------------------------------------------------------------

async function benchIncremental() {
  console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
  console.log("┃  BENCHMARK 2: Incremental typing simulation                ┃");
  console.log("┃  Feed text char-by-char, commit at each step.              ┃");
  console.log("┃  This is the real-time use case StreamSense is built for.  ┃");
  console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
  console.log();

  const nlp = await getCompromise();
  const chrono = await getChrono();
  const anchorme = await getAnchorme();

  const text = MEDIUM;
  const steps = typingSequence(text, 3); // every 3 chars
  console.log(`  ▸ medium text, ${text.length} chars, ${steps.length} incremental steps\n`);

  const bench = new Bench({ time: 3000, warmupTime: 500 });

  bench
    .add("StreamSense (incremental feed + commit)", () => {
      const r = makeRecognizer();
      for (const slice of steps) {
        r.feed({ text: slice, cursor: slice.length });
        r.commit();
      }
      r.destroy();
    })
    .add("compromise (re-parse each step)", () => {
      for (const slice of steps) {
        const doc = nlp(slice);
        doc.values().json();
        doc.emails().json();
        doc.urls().json();
      }
    })
    .add("chrono-node (re-parse each step)", () => {
      for (const slice of steps) {
        chrono.parse(slice);
      }
    })
    .add("anchorme (re-parse each step)", () => {
      for (const slice of steps) {
        anchorme.list(slice);
      }
    });

  await bench.run();
  printTable(bench);
}

// ---------------------------------------------------------------------------
// 3. Per-feed latency (single keystroke cost)
// ---------------------------------------------------------------------------

async function benchPerFeed() {
  console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓");
  console.log("┃  BENCHMARK 3: Per-feed latency                             ┃");
  console.log("┃  Cost of a single feed() + commit() on existing state.     ┃");
  console.log("┃  Measures the overhead of one keystroke in a live session.  ┃");
  console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛");
  console.log();

  const nlp = await getCompromise();
  const chrono = await getChrono();
  const anchorme = await getAnchorme();

  const text = LONG;

  // Pre-create a recognizer with existing state
  const r = makeRecognizer();
  r.feed({ text });
  r.commit();

  console.log(`  ▸ long text, ${text.length} chars, single-operation cost\n`);

  const bench = new Bench({ time: 2000, warmupTime: 500 });

  bench
    .add("StreamSense (reuse instance)", () => {
      r.feed({ text, cursor: text.length });
      r.commit();
    })
    .add("StreamSense (new instance)", () => {
      const r2 = makeRecognizer();
      r2.feed({ text });
      r2.commit();
      r2.destroy();
    })
    .add("compromise (full parse)", () => {
      const doc = nlp(text);
      doc.values().json();
      doc.emails().json();
      doc.urls().json();
    })
    .add("chrono-node (full parse)", () => {
      chrono.parse(text);
    })
    .add("anchorme (full parse)", () => {
      anchorme.list(text);
    });

  await bench.run();
  printTable(bench);

  r.destroy();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log();
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║     StreamSense Benchmarks v0.1.0    ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log();

  await benchSinglePass();
  await benchIncremental();
  await benchPerFeed();

  console.log("  ✓ Done.\n");
}

main().catch(console.error);
