import type { Plugin } from "../types.js";

/**
 * URL plugin — detects URLs (http, https, ftp).
 */
export function url(): Plugin {
  return {
    name: "url",
    mode: "realtime",
    priority: 30,
    run({ window, mode }) {
      const regex = /https?:\/\/[^\s<>)"']+|ftp:\/\/[^\s<>)"']+/gi;
      const matches = [...window.text.matchAll(regex)];

      return {
        upsert: matches.map((m) => ({
          key: `url:${m[0]}:${window.offset + m.index!}`,
          kind: "url" as const,
          span: {
            start: window.offset + m.index!,
            end: window.offset + m.index! + m[0].length,
          },
          text: m[0],
          value: { url: m[0] },
          confidence: 0.95,
          status: mode === "commit" ? ("confirmed" as const) : ("provisional" as const),
        })),
      };
    },
  };
}
