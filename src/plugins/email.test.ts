import { describe, it, expect } from "vitest";
import { email } from "./email.js";

describe("email plugin", () => {
  const plugin = email();

  function run(text: string) {
    return plugin.run({
      text,
      window: { text, offset: 0 },
      mode: "realtime",
      entities: [],
    });
  }

  it("detects an email address", () => {
    const result = run("send to alice@example.com please");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].text).toBe("alice@example.com");
    expect(result.upsert![0].value).toEqual({ address: "alice@example.com" });
  });

  it("detects multiple emails", () => {
    const result = run("cc bob@test.org and carol@test.org");
    expect(result.upsert).toHaveLength(2);
  });

  it("returns empty for no matches", () => {
    const result = run("no emails here");
    expect(result.upsert).toHaveLength(0);
  });
});
