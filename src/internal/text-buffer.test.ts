import { describe, it, expect } from "vitest";
import { TextBuffer } from "./text-buffer.js";

describe("TextBuffer", () => {
  it("starts empty", () => {
    const buf = new TextBuffer();
    expect(buf.text).toBe("");
    expect(buf.cursor).toBe(0);
    expect(buf.revision).toBe(0);
    expect(buf.composing).toBe(false);
  });

  it("updates text and increments revision", () => {
    const buf = new TextBuffer();
    buf.update("hello");
    expect(buf.text).toBe("hello");
    expect(buf.cursor).toBe(5); // defaults to end
    expect(buf.revision).toBe(1);

    buf.update("hello world", 5);
    expect(buf.text).toBe("hello world");
    expect(buf.cursor).toBe(5);
    expect(buf.revision).toBe(2);
  });

  it("tracks composing state", () => {
    const buf = new TextBuffer();
    buf.update("hel", 3, true);
    expect(buf.composing).toBe(true);

    buf.update("hello", 5, false);
    expect(buf.composing).toBe(false);
  });

  it("computes window around cursor", () => {
    const buf = new TextBuffer();
    buf.update("abcdefghij", 5); // cursor at 'f'

    const win = buf.window(6); // 3 chars each side
    expect(win.offset).toBe(2);
    expect(win.text).toBe("cdefgh");
  });

  it("clamps window to text boundaries", () => {
    const buf = new TextBuffer();
    buf.update("abc", 0); // cursor at start

    const win = buf.window(10);
    expect(win.offset).toBe(0);
    expect(win.text).toBe("abc");
  });

  it("handles window when cursor is at end", () => {
    const buf = new TextBuffer();
    buf.update("hello", 5);

    const win = buf.window(4);
    expect(win.offset).toBe(3);
    expect(win.text).toBe("lo");
  });
});
