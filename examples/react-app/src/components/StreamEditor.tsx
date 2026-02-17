/**
 * CodeMirror 6 input with Stream entity decorations.
 * Replaces textarea+backdrop: CM handles layout/scroll, we just update a DecorationSet from entities.
 */

import { useEffect, useRef } from 'react'
import {
  EditorView,
  keymap,
  placeholder,
  Decoration,
  type KeyBinding,
} from '@codemirror/view'
import {
  EditorState,
  StateField,
  StateEffect,
  type Extension,
} from '@codemirror/state'
import { defaultKeymap, indentWithTab, insertNewline } from '@codemirror/commands'
import type { Entity } from 'streamsense'

const setEntityDecorations = StateEffect.define<{ from: number; to: number; kind: string }[]>()

const entityDecorationsField = StateField.define({
  create() {
    return Decoration.none
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setEntityDecorations)) {
        const spans = effect.value
        if (spans.length === 0) return Decoration.none
        const decos = spans.map(({ from, to, kind }) =>
          Decoration.mark({ class: `cm-entity cm-entity-${kind}` }).range(from, to)
        )
        return Decoration.set(decos, true)
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value
  },
  provide: (f) => EditorView.decorations.from(f),
})

export const ENTITY_DECORATION_CLASS = 'cm-entity'

export type StreamEditorProps = {
  /** Initial text (uncontrolled) or for initial state only */
  initialText?: string
  /** Called when content or selection changes; feed this to the recognizer */
  onFeed: (params: { text: string; cursor: number }) => void
  /** Called when user commits (e.g. Enter) */
  onCommit?: () => void
  /** Current entities from Stream; decorations are updated when this changes */
  entities: Entity[]
  placeholder?: string
  className?: string
}

export function StreamEditor({
  initialText = '',
  onFeed,
  onCommit,
  entities,
  placeholder: placeholderText = '',
  className,
}: StreamEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onFeedRef = useRef(onFeed)
  const onCommitRef = useRef(onCommit)
  onFeedRef.current = onFeed
  onCommitRef.current = onCommit

  // Build extensions once; keymap for Enter -> commit
  const extensionsRef = useRef<Extension[] | null>(null)
  if (extensionsRef.current === null) {
    const commitKeymap: KeyBinding[] = [
      {
        key: 'Enter',
        run() {
          onCommitRef.current?.()
          return true // consume so Enter doesn't insert newline
        },
      },
      {
        key: 'Shift-Enter',
        run: insertNewline,
      },
    ]
    extensionsRef.current = [
      entityDecorationsField,
      keymap.of([...defaultKeymap, indentWithTab, ...commitKeymap]),
      ...(placeholderText ? [placeholder(placeholderText)] : []),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          const doc = update.state.doc.toString()
          const cursor = update.state.selection.main.head
          onFeedRef.current({ text: doc, cursor })
        }
      }),
      EditorView.theme({
        '&': { backgroundColor: 'transparent' },
        '.cm-content': { color: '#e5e5e5', caretColor: '#e5e5e5' },
        '.cm-cursor': { borderLeftColor: '#e5e5e5' },
      }),
    ]
  }

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return
    const state = EditorState.create({
      doc: initialText,
      extensions: extensionsRef.current!,
    })
    const view = new EditorView({
      state,
      parent: containerRef.current,
    })
    viewRef.current = view
    onFeedRef.current({
      text: view.state.doc.toString(),
      cursor: view.state.selection.main.head,
    })
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- init once

  // Sync entities -> decorations (clamp to doc so ranges are valid)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc
    const len = doc.length
    const spans = entities
      .filter((e) => e.span.start < e.span.end)
      .map((e) => ({
        from: Math.max(0, Math.min(e.span.start, len)),
        to: Math.max(0, Math.min(e.span.end, len)),
        kind: e.kind,
      }))
      .filter((s) => s.from < s.to)
    view.dispatch({
      effects: setEntityDecorations.of(spans),
    })
  }, [entities])

  return (
    <div
      ref={containerRef}
      className={['stream-editor', className].filter(Boolean).join(' ')}
    />
  )
}
