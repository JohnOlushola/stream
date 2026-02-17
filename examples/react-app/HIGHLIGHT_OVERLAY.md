# Textarea + overlay highlight: best practices

The input uses a **backdrop div** (highlight layer) behind a **textarea** (transparent background). The backdrop shows coloured spans; the user types in the textarea. For highlights to stay aligned:

## 1. Identical layout (critical)

Backdrop and textarea must have **exactly** the same:

- `font-family`, `font-size`, `line-height`, `letter-spacing`
- `padding`, `width`, `box-sizing`
- `white-space: pre-wrap` (so line breaks match)
- `overflow-wrap` / `word-break` (so long words wrap at the same place)

Any difference (e.g. textarea default border adding 2px) changes the content box and shifts wrap points → drift.

## 2. Scroll sync

- Sync **both** `scrollTop` and `scrollLeft` from textarea → backdrop on `scroll`.
- **Re-sync after the backdrop re-renders**: when entities (highlights) change, the backdrop DOM updates; sync scroll again in `useLayoutEffect` so the backdrop stays in the same scroll position as the textarea. Otherwise one frame of misalignment can appear.

## 3. No extra chrome on textarea

- Use `border-0` (or equivalent) so the textarea content area matches the backdrop. Browsers often give textarea a default border.
- Avoid extra outline/margin that could change layout.

## 4. Single source of truth for “mirror” styles

Share the same Tailwind classes (or a single style object) for padding, font, line-height on both elements so a typo can’t make them diverge.

## References

- CSS-Tricks: [replicating textarea in another element](https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/) — “exactly replicate the look, content, and position”; “same font, same padding, same margin, same border… everything.”
