import { useState, type FormEvent } from 'react'
import type { Project } from '../../../preload'

interface Props {
  onCreated: (project: Project) => void
}

const field =
  'w-full border border-line bg-canvas px-3 type-body-m outline-none placeholder:text-fg-2 focus:border-focus'

export function NewProject({ onCreated }: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [concept, setConcept] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onCreated(await window.api.createProject({ name, client, concept }))
    } catch (err) {
      // Electron prefixes IPC errors with the channel name; show only the reason
      setError(String(err).replace(/^.*Error: /, ''))
      setSaving(false)
    }
  }

  return (
    <div className="grid flex-1 grid-cols-[minmax(0,640px)_minmax(0,1fr)] gap-16 px-10 pt-14 pb-10">
      <form onSubmit={submit} className="stagger flex flex-col [--stagger-start:100ms]">
        <h2 className="type-heading-m text-fg italic">Start with a point of view.</h2>

        <label htmlFor="np-name" className="mt-6 type-label-m">
          Name
        </label>
        <input
          id="np-name"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`mt-2 h-10 ${field}`}
        />

        <label htmlFor="np-client" className="mt-6 type-label-m">
          Client <span className="text-fg-2">(optional)</span>
        </label>
        <input
          id="np-client"
          value={client}
          onChange={(e) => setClient(e.target.value)}
          className={`mt-2 h-10 ${field}`}
        />

        <label htmlFor="np-concept" className="mt-6 type-label-m">
          Concept
        </label>
        <textarea
          id="np-concept"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
          placeholder="What is this project trying to say?"
          rows={4}
          className={`mt-2 resize-y py-3 ${field}`}
        />

        {error && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
          >
            {error}
          </p>
        )}

        <div className="mt-11 flex items-center gap-5">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="h-9 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 active:scale-[0.97] hover:bg-brand-hover active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled"
          >
            {saving ? 'Creating…' : 'Create project'}
          </button>
          <span className="type-caption text-fg-2">Private by default. Always yours.</span>
        </div>
      </form>

      <aside className="stagger flex flex-col [--stagger-start:160ms]">
        <p className="type-display-l-italic text-brand">A beginning.</p>
        <hr className="mt-4 border-line" />
        <p className="mt-6 type-body-s text-fg-2">
          Give your agents a little context. You can shape the rest together.
        </p>
      </aside>
    </div>
  )
}
