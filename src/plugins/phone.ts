import type { Plugin } from "../types.js";

/**
 * Phone plugin — detects common phone number formats.
 *
 * Patterns:
 *   - (555) 123-4567
 *   - 555-123-4567
 *   - +1-555-123-4567
 *   - +44 20 7946 0958
 *   - 5551234567 (10+ digits)
 */
export function phone(): Plugin {
  return {
    name: "phone",
    mode: "realtime",
    priority: 30,
    run({ window, mode }) {
      const regex =
        /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g;
      const matches = [...window.text.matchAll(regex)];

      // Filter out matches that are too short (less than 7 digits)
      const filtered = matches.filter((m) => {
        const digits = m[0].replace(/\D/g, "");
        return digits.length >= 7;
      });

      return {
        upsert: filtered.map((m) => ({
          key: `phone:${m[0].replace(/\D/g, "")}:${window.offset + m.index!}`,
          kind: "phone" as const,
          span: {
            start: window.offset + m.index!,
            end: window.offset + m.index! + m[0].length,
          },
          text: m[0],
          value: { raw: m[0], digits: m[0].replace(/\D/g, "") },
          confidence: 0.85,
          status: mode === "commit" ? ("confirmed" as const) : ("provisional" as const),
        })),
      };
    },
  };
}
