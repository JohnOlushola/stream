/**
 * TextBuffer — stores the current text, cursor position, and revision counter.
 * Computes the analysis window around the cursor.
 */
export class TextBuffer {
  private _text = "";
  private _cursor = 0;
  private _revision = 0;
  private _composing = false;

  get text(): string {
    return this._text;
  }

  get cursor(): number {
    return this._cursor;
  }

  get revision(): number {
    return this._revision;
  }

  get composing(): boolean {
    return this._composing;
  }

  /**
   * Update the buffer contents. Increments revision.
   */
  update(text: string, cursor?: number, composing?: boolean): void {
    this._text = text;
    this._cursor = cursor ?? text.length;
    this._composing = composing ?? false;
    this._revision++;
  }

  /**
   * Returns a windowed slice of text centered around the cursor.
   * @param windowSize total window size in characters
   */
  window(windowSize: number): { text: string; offset: number } {
    const half = Math.floor(windowSize / 2);
    const start = Math.max(0, this._cursor - half);
    const end = Math.min(this._text.length, this._cursor + half);

    return {
      text: this._text.slice(start, end),
      offset: start,
    };
  }
}
