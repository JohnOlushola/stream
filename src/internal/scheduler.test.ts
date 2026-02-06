import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "./scheduler.js";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires realtime callback after debounce period", () => {
    const onRealtime = vi.fn();
    const onCommit = vi.fn();

    const s = new Scheduler({
      realtimeMs: 150,
      commitAfterMs: 700,
      onRealtime,
      onCommit,
    });

    s.onInput();
    expect(onRealtime).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(onRealtime).toHaveBeenCalledOnce();

    s.destroy();
  });

  it("fires commit callback after idle period", () => {
    const onRealtime = vi.fn();
    const onCommit = vi.fn();

    const s = new Scheduler({
      realtimeMs: 150,
      commitAfterMs: 700,
      onRealtime,
      onCommit,
    });

    s.onInput();
    vi.advanceTimersByTime(700);
    expect(onCommit).toHaveBeenCalledOnce();

    s.destroy();
  });

  it("resets commit timer on each input", () => {
    const onRealtime = vi.fn();
    const onCommit = vi.fn();

    const s = new Scheduler({
      realtimeMs: 150,
      commitAfterMs: 700,
      onRealtime,
      onCommit,
    });

    s.onInput();
    vi.advanceTimersByTime(500);
    expect(onCommit).not.toHaveBeenCalled();

    s.onInput(); // resets
    vi.advanceTimersByTime(500);
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    expect(onCommit).toHaveBeenCalledOnce();

    s.destroy();
  });

  it("does not fire after destroy", () => {
    const onRealtime = vi.fn();
    const onCommit = vi.fn();

    const s = new Scheduler({
      realtimeMs: 150,
      commitAfterMs: 700,
      onRealtime,
      onCommit,
    });

    s.onInput();
    s.destroy();
    vi.advanceTimersByTime(1000);

    expect(onRealtime).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("flush fires pending callbacks immediately", () => {
    const onRealtime = vi.fn();
    const onCommit = vi.fn();

    const s = new Scheduler({
      realtimeMs: 150,
      commitAfterMs: 700,
      onRealtime,
      onCommit,
    });

    s.onInput();
    s.flush();

    expect(onRealtime).toHaveBeenCalledOnce();
    expect(onCommit).toHaveBeenCalledOnce();

    s.destroy();
  });
});
