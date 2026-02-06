import { describe, it, expect } from "vitest";
import { phone } from "./phone.js";

describe("phone plugin", () => {
  const plugin = phone();

  function run(text: string) {
    return plugin.run({
      text,
      window: { text, offset: 0 },
      mode: "realtime",
      entities: [],
    });
  }

  it("detects a US phone number with dashes", () => {
    const result = run("call 555-123-4567");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].value).toEqual({
      raw: "555-123-4567",
      digits: "5551234567",
    });
  });

  it("detects a phone number with parens", () => {
    const result = run("call (555) 123-4567");
    expect(result.upsert).toHaveLength(1);
  });

  it("detects a phone with country code", () => {
    const result = run("international +1-555-123-4567");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].value).toHaveProperty("digits");
  });

  it("returns empty for no matches", () => {
    const result = run("no phone here");
    expect(result.upsert).toHaveLength(0);
  });
});
