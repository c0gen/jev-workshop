import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { Compartment } from '@codemirror/state'

export function JsonEditor({
  value,
  onChange,
  label = 'JSON editor',
  minHeight = 130,
  readOnly = false
}: {
  value: string
  onChange?: (value: string) => void
  label?: string
  minHeight?: number
  readOnly?: boolean
}) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView>(undefined),
    callback = useRef(onChange)
  callback.current = onChange
  useEffect(() => {
    const theme = new Compartment()
    const isDark = () => document.documentElement.dataset.theme === 'dark'
    const editor = new EditorView({
      parent: host.current!,
      doc: value,
      extensions: [
        basicSetup,
        json(),
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          'aria-label': label,
          role: 'textbox',
          'aria-multiline': 'true'
        }),
        EditorView.theme({
          '&': { minHeight: `${minHeight}px`, fontSize: '12px' },
          '.cm-scroller': { fontFamily: 'Consolas, monospace' }
        }),
        theme.of(isDark() ? oneDark : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callback.current?.(update.state.doc.toString())
        })
      ]
    })
    view.current = editor
    const observer = new MutationObserver(() =>
      editor.dispatch({ effects: theme.reconfigure(isDark() ? oneDark : []) })
    )
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
    return () => {
      observer.disconnect()
      editor.destroy()
      view.current = undefined
    }
  }, [label, minHeight, readOnly])
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } })
  }, [value])
  return <div className="json-editor" ref={host} />
}
