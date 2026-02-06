import type { Plugin } from "../types.js";

/**
 * Quantity plugin — detects numbers with units.
 * Supports: km, mi, kg, g, lb, lbs, oz, m, cm, mm, ft, in, yd, l, ml, gal, mph, kph
 */
export function quantity(): Plugin {
  return {
    name: "quantity",
    mode: "realtime",
    priority: 10,
    run({ window, mode }) {
      const regex =
        /(\d+(?:,\d{3})*(?:\.\d+)?)\s?(km|mi|kg|g|lb|lbs|oz|m|cm|mm|ft|in|yd|l|ml|gal|mph|kph)\b/gi;
      const matches = [...window.text.matchAll(regex)];

      return {
        upsert: matches.map((m) => ({
          key: `quantity:${m[1]}:${m[2].toLowerCase()}:${window.offset + m.index!}`,
          kind: "quantity" as const,
          span: {
            start: window.offset + m.index!,
            end: window.offset + m.index! + m[0].length,
          },
          text: m[0],
          value: {
            amount: Number(m[1].replace(/,/g, "")),
            unit: m[2].toLowerCase(),
          },
          confidence: 0.9,
          status: mode === "commit" ? ("confirmed" as const) : ("provisional" as const),
        })),
      };
    },
  };
}
