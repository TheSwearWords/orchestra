// Right-click an Instrument, or a prerequisite (which is an Instrument shared by the whole
// project), to edit it: its name, its job, and which prerequisites must exist before it runs.
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Instrument } from '../../../preload'
import { MAX_CONCEPT } from '../canvas/shared'

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

export function InstrumentEditor({
  instrument: inst,
  foundations,
  prerequisite,
  onClose,
  onSaved
}: {
  instrument: Instrument
  foundations: Instrument[] // the prerequisites it may wait on
  prerequisite: boolean // a shared prerequisite, not one deliverable's helper
  onClose: () => void
  onSaved: () => void
}): React.JSX.Element {
  const [name, setName] = useState(inst.name)
  const [job, setJob] = useState(inst.job)
  const [needs, setNeeds] = useState(inst.needs)
  const [error, setError] = useState('')
  const toggle = (id: string): void =>
    setNeeds((n) => (n.includes(id) ? n.filter((x) => x !== id) : [...n, id]))
  const others = foundations.filter((f) => f.id !== inst.id)
  const kind = prerequisite ? 'prerequisite' : 'Instrument'

  async function save(): Promise<void> {
    setError('')
    try {
      await window.api.editAgent('instrument', inst.id, 'name', name)
      await window.api.editAgent('instrument', inst.id, 'description', job)
      await window.api.setInstrumentNeeds(inst.id, needs)
      dispatchEvent(new Event('orchestra:agents-changed'))
      onSaved()
    } catch (err) {
      setError(reason(err))
    }
  }

  const label = 'type-label-s text-dim'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${inst.name}`}
        className="flex max-h-[88vh] w-full max-w-[640px] flex-col border border-chip-line bg-card text-link shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
      >
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-8">
          <h2 className="type-heading-m">Edit {kind}</h2>
          <label className="flex flex-col gap-2">
            <span className={label}>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-0 border-b-2 border-brand bg-transparent pb-1.5 type-body-l outline-none"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={`${label} flex justify-between`}>
              What it does
              <span>
                {job.length} / {MAX_CONCEPT}
              </span>
            </span>
            <textarea
              value={job}
              maxLength={MAX_CONCEPT}
              onChange={(e) => setJob(e.target.value)}
              className="field-sizing-content min-h-20 resize-none border border-card-line bg-transparent p-3 type-body-m outline-none focus:border-brand"
            />
          </label>
          {inst.output && (
            <p className="type-caption text-dim">
              It makes <span className="type-log-s">{inst.output}</span>
            </p>
          )}
          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className={label}>What it needs first</span>
              <div className="flex flex-wrap gap-1.5">
                {others.map((f) => (
                  <button
                    key={f.id}
                    aria-pressed={needs.includes(f.id)}
                    onClick={() => toggle(f.id)}
                    title={f.job}
                    className={`border px-2.5 py-1 type-label-s ${
                      needs.includes(f.id)
                        ? 'border-brand bg-brand text-on-brand'
                        : 'border-card-line hover:bg-selected'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="type-body-s text-signal-fg">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-hair p-4">
          <button
            onClick={onClose}
            className="serif-on h-10 border-[1.5px] border-brand px-4 type-label-m hover:bg-selected"
          >
            Cancel
          </button>
          <button
            onClick={() => void save()}
            className="serif-on h-10 bg-brand px-4 type-label-m text-on-brand hover:bg-inverse"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
