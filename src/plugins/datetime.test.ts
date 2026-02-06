import { describe, it, expect } from "vitest";
import { datetime } from "./datetime.js";

describe("datetime plugin", () => {
  const plugin = datetime();

  function run(text: string) {
    return plugin.run({
      text,
      window: { text, offset: 0 },
      mode: "realtime",
      entities: [],
    });
  }

  it("detects ISO dates", () => {
    const result = run("meeting on 2024-01-15");
    expect(result.upsert!.length).toBeGreaterThanOrEqual(1);
    const date = result.upsert!.find((e) => e.value && (e.value as { label: string }).label === "date");
    expect(date).toBeDefined();
    expect(date!.text).toBe("2024-01-15");
  });

  it("detects verbal dates", () => {
    const result = run("deadline is Jan 15, 2024");
    expect(result.upsert!.length).toBeGreaterThanOrEqual(1);
    expect(result.upsert!.some((e) => e.text.includes("Jan 15"))).toBe(true);
  });

  it("detects times", () => {
    const result = run("meeting at 14:30");
    expect(result.upsert!.length).toBeGreaterThanOrEqual(1);
    expect(result.upsert!.some((e) => e.text === "14:30")).toBe(true);
  });

  it("detects relative dates", () => {
    const result = run("let's do it tomorrow");
    expect(result.upsert!.length).toBeGreaterThanOrEqual(1);
    expect(result.upsert!.some((e) => e.text.toLowerCase() === "tomorrow")).toBe(true);
  });

  it("returns empty for no matches", () => {
    const result = run("hello world");
    expect(result.upsert).toHaveLength(0);
  });
});
