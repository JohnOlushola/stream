import { describe, it, expect } from "vitest";
import { url } from "./url.js";

describe("url plugin", () => {
  const plugin = url();

  function run(text: string) {
    return plugin.run({
      text,
      window: { text, offset: 0 },
      mode: "realtime",
      entities: [],
    });
  }

  it("detects an https URL", () => {
    const result = run("visit https://example.com/page");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].text).toBe("https://example.com/page");
  });

  it("detects an http URL", () => {
    const result = run("link: http://test.org");
    expect(result.upsert).toHaveLength(1);
  });

  it("returns empty for no matches", () => {
    const result = run("no urls here");
    expect(result.upsert).toHaveLength(0);
  });
});
