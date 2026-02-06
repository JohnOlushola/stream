import { describe, it, expect } from "vitest";
import { quantity } from "./quantity.js";

describe("quantity plugin", () => {
  const plugin = quantity();

  function run(text: string) {
    return plugin.run({
      text,
      window: { text, offset: 0 },
      mode: "realtime",
      entities: [],
    });
  }

  it("detects a simple quantity", () => {
    const result = run("convert 10 km to mi");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].text).toBe("10 km");
    expect(result.upsert![0].value).toEqual({ amount: 10, unit: "km" });
    expect(result.upsert![0].span).toEqual({ start: 8, end: 13 });
  });

  it("detects multiple quantities", () => {
    const result = run("I ran 5 km and lifted 20 kg");
    expect(result.upsert).toHaveLength(2);
    expect(result.upsert![0].value).toEqual({ amount: 5, unit: "km" });
    expect(result.upsert![1].value).toEqual({ amount: 20, unit: "kg" });
  });

  it("handles decimal quantities", () => {
    const result = run("temperature dropped 3.5 cm");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].value).toEqual({ amount: 3.5, unit: "cm" });
  });

  it("returns confirmed status in commit mode", () => {
    const result = plugin.run({
      text: "10 km",
      window: { text: "10 km", offset: 0 },
      mode: "commit",
      entities: [],
    });
    expect(result.upsert![0].status).toBe("confirmed");
  });

  it("returns empty for no matches", () => {
    const result = run("hello world");
    expect(result.upsert).toHaveLength(0);
  });

  it("handles quantities with comma separators", () => {
    const result = run("that's 1,500 km away");
    expect(result.upsert).toHaveLength(1);
    expect(result.upsert![0].value).toEqual({ amount: 1500, unit: "km" });
  });
});
