import type { Plugin } from "../types.js";

/**
 * DateTime plugin — detects common date and time patterns.
 *
 * Patterns:
 *   - ISO-like: 2024-01-15, 2024/01/15
 *   - Verbal: Jan 15, January 15, 15 Jan 2024
 *   - Time: 14:30, 2:30 PM, 2:30pm
 *   - Relative: today, tomorrow, yesterday
 */
export function datetime(): Plugin {
  const patterns: Array<{ regex: RegExp; label: string }> = [
    // ISO-like dates
    {
      regex: /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
      label: "date",
    },
    // US/verbal dates: Jan 15, January 15 2024, etc.
    {
      regex:
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s*\d{4})?)\b/gi,
      label: "date",
    },
    // Day-first verbal: 15 Jan 2024
    {
      regex:
        /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4})\b/gi,
      label: "date",
    },
    // Times: 14:30, 2:30 PM
    {
      regex: /\b(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\b/g,
      label: "time",
    },
    // Relative
    {
      regex: /\b(today|tomorrow|yesterday)\b/gi,
      label: "relative-date",
    },
  ];

  return {
    name: "datetime",
    mode: "realtime",
    priority: 20,
    run({ window, mode }) {
      const upsert: Array<{
        key: string;
        kind: "datetime";
        span: { start: number; end: number };
        text: string;
        value: { raw: string; label: string };
        confidence: number;
        status: "provisional" | "confirmed";
      }> = [];

      for (const { regex, label } of patterns) {
        // Reset lastIndex since we reuse the regex
        regex.lastIndex = 0;
        const matches = [...window.text.matchAll(regex)];

        for (const m of matches) {
          const raw = m[1] ?? m[0];
          upsert.push({
            key: `datetime:${label}:${raw.toLowerCase()}:${window.offset + m.index!}`,
            kind: "datetime",
            span: {
              start: window.offset + m.index!,
              end: window.offset + m.index! + m[0].length,
            },
            text: m[0],
            value: { raw, label },
            confidence: 0.85,
            status: mode === "commit" ? "confirmed" : "provisional",
          });
        }
      }

      return { upsert };
    },
  };
}
