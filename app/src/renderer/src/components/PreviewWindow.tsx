import { useState } from 'react'
import type { Preview } from '../../../preload'

/** A deliverable's finished work: its picture, and a click takes you to the real thing. */
export function PreviewWindow({
  project,
  deliverable,
  preview: p
}: {
  project: string
  deliverable: string
  preview: Preview
}): React.JSX.Element {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const local = /^http:\/\/(localhost|127\.0\.0\.1)/.test(p.url)
  async function open(): Promise<void> {
    setBusy(true)
    setNote('')
    try {
      await window.api.openPreview(project, deliverable, p.label)
    } catch (e) {
      setNote(String(e).replace(/^.*Error: /, ''))
    }
    setBusy(false)
  }
  return (
    <div className="flex flex-col">
      <button
        onClick={() => void open()}
        disabled={busy}
        title={`Open ${p.url}`}
        className="group relative block aspect-[16/10] w-full overflow-hidden bg-brand"
      >
        {p.image ? (
          <img
            alt=""
            src={`orchestra://file/${project}/${encodeURIComponent(p.image)}`}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center type-heading-m text-on-brand">
            {busy ? 'Starting…' : 'Open'}
          </span>
        )}
      </button>
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <span className="truncate font-mono text-[11px] text-dim">
          {busy && local ? 'Starting the dev server…' : new URL(p.url).host}
        </span>
        {note && (
          <span role="alert" className="type-body-s text-signal-fg">
            {note}
          </span>
        )}
      </div>
    </div>
  )
}
