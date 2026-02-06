import type { Plugin } from "../types.js";

/**
 * Email plugin — detects email addresses.
 */
export function email(): Plugin {
  return {
    name: "email",
    mode: "realtime",
    priority: 30,
    run({ window, mode }) {
      const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = [...window.text.matchAll(regex)];

      return {
        upsert: matches.map((m) => ({
          key: `email:${m[0].toLowerCase()}:${window.offset + m.index!}`,
          kind: "email" as const,
          span: {
            start: window.offset + m.index!,
            end: window.offset + m.index! + m[0].length,
          },
          text: m[0],
          value: { address: m[0].toLowerCase() },
          confidence: 0.95,
          status: mode === "commit" ? ("confirmed" as const) : ("provisional" as const),
        })),
      };
    },
  };
}
