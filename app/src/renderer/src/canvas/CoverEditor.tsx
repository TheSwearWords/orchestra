// C2 · The cover editor: new project (one question at a time) and edit project (every field
// at once). The cover on the left is the result, updating as you type.
import { useEffect, useRef, useState } from 'react'
import type { Project } from '../../../preload'
import { Shell } from './Chrome'
import { CoverFace } from './Cover'

type Field = 'name' | 'client' | 'concept'
const QUESTIONS: { field: Field; ask: string; label: string; optional?: boolean }[] = [
  { field: 'name', ask: "What's it called?", label: 'Name' },
  { field: 'client', ask: 'Who is it for?', label: 'Client', optional: true },
  { field: 'concept', ask: 'What is this project trying to say?', label: 'Concept' }
]

const underline =
  'w-full border-0 border-b-2 border-brand bg-transparent pb-2 text-link outline-none placeholder:text-placeholder focus-visible:outline-none'

function reason(err: unknown): string {
  return String(err).replace(/^.*Error: /, '') // Electron prefixes IPC errors with the channel
}

interface Props {
  project: Project | null // null: a new project
  no: number
  onDone: () => void // back to the Studio
  onCreated: (p: Project, open: boolean) => void
  onSaved: () => void
  onEnter: (id: string) => void
}

export function CoverEditor({
  project,
  no,
  onDone,
  onCreated,
  onSaved,
  onEnter
}: Props): React.JSX.Element {
  const [v, setV] = useState({
    name: project?.name ?? '',
    client: project?.client ?? '',
    concept: project?.concept ?? ''
  })
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented) onDone()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [onDone])

  // edit mode saves as you type, a moment after the last key
  const timer = useRef(0)
  function change(field: Field, value: string): void {
    setV((old) => ({ ...old, [field]: value }))
    setError('')
    if (!project) return
    setSaved(false)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      if (field === 'name' && !value.trim()) return setError('Give the project a name.')
      try {
        await window.api.editProject(project.id, { [field]: value })
        setSaved(true)
        onSaved()
      } catch (err) {
        setError(reason(err))
      }
    }, 500)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  async function create(open: boolean): Promise<void> {
    setBusy(true)
    try {
      onCreated(await window.api.createProject(v), open)
    } catch (err) {
      setError(reason(err))
      setBusy(false)
    }
  }

  const q = QUESTIONS[step]
  const last = step === QUESTIONS.length - 1
  function next(e: React.FormEvent): void {
    e.preventDefault()
    if (!q.optional && !v[q.field].trim()) return setError(`${q.label} first.`)
    if (last) void create(false)
    else setStep(step + 1)
  }

  return (
    <div className="bg-dots relative flex h-full w-full items-center justify-center gap-[clamp(32px,6vw,120px)] px-10 animate-[area-in_550ms_var(--ease)_both]">
      <Shell
        crumbs={[
          { label: 'Studio', onClick: onDone },
          ...(project ? [{ label: project.name, onClick: () => onEnter(project.id) }] : []),
          { label: project ? 'Edit' : 'New project' }
        ]}
      />

      {/* the cover, at about 500×680 */}
      <div
        className="shrink-0 shadow-book"
        style={{ width: 300 * 1.7, height: 400 * 1.7 }}
        aria-hidden
      >
        <div
          className="origin-top-left"
          style={{ width: 300, height: 400, transform: 'scale(1.7)' }}
        >
          <CoverFace info={{ id: project?.id ?? 'new', name: v.name, client: v.client, no }} />
        </div>
      </div>

      <div className="flex w-[min(520px,45vw)] flex-col">
        {project ? (
          <>
            <p className="type-label-mono text-link">Edit project</p>
            {QUESTIONS.map((x) => (
              <label key={x.field} className="mt-8 flex flex-col gap-2">
                <span className="type-label-s text-dim">{x.label}</span>
                {x.field === 'concept' ? (
                  <textarea
                    rows={3}
                    value={v.concept}
                    onChange={(e) => change('concept', e.target.value)}
                    className={`${underline} resize-none type-body-l`}
                  />
                ) : (
                  <input
                    value={v[x.field]}
                    onChange={(e) => change(x.field, e.target.value)}
                    className={`${underline} type-heading-m`}
                  />
                )}
              </label>
            ))}
            <p role="status" className="mt-4 h-5 type-caption text-dim">
              {error ? <span className="text-danger-fg">{error}</span> : saved && 'Saved'}
            </p>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => onEnter(project.id)}
                className="serif-on h-11 bg-brand px-5 type-label-m text-on-brand hover:bg-inverse"
              >
                Enter project
              </button>
              <button
                onClick={onDone}
                className="serif-on h-11 border-[1.5px] border-brand px-5 type-label-m text-link hover:bg-brand hover:text-on-brand"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={next} className="flex flex-col">
            {/* earlier answers; click one to go back to it */}
            <div className="flex min-h-8 flex-wrap gap-2">
              {QUESTIONS.slice(0, step).map((x, i) => (
                <button
                  type="button"
                  key={x.field}
                  onClick={() => setStep(i)}
                  className="rounded-full border border-chip-line bg-chip px-3 py-1 type-label-s text-link hover:bg-selected"
                >
                  {x.label}: {v[x.field] || '—'}
                </button>
              ))}
            </div>
            <p className="mt-6 type-label-mono text-link">
              {String(step + 1).padStart(2, '0')} / {String(QUESTIONS.length).padStart(2, '0')}
              {q.optional && ' · optional'}
            </p>
            <label htmlFor="cover-q" className="mt-3 type-display-l text-link">
              {q.ask}
            </label>
            <input
              id="cover-q"
              key={q.field}
              autoFocus
              value={v[q.field]}
              onChange={(e) => change(q.field, e.target.value)}
              className={`${underline} mt-8 type-heading-m`}
            />
            <p role="status" className="mt-3 h-5 type-caption text-danger-fg">
              {error}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {last ? (
                <>
                  <button
                    type="submit"
                    disabled={busy}
                    className="serif-on h-11 border-[1.5px] border-brand px-5 type-label-m text-link hover:bg-brand hover:text-on-brand"
                  >
                    Create project
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      v.concept.trim() ? void create(true) : setError('Concept first.')
                    }
                    className="serif-on h-11 bg-brand px-5 type-label-m text-on-brand hover:bg-inverse"
                  >
                    Create and open
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  className="serif-on h-11 bg-brand px-5 type-label-m text-on-brand hover:bg-inverse"
                >
                  {q.optional && !v[q.field].trim() ? 'Skip' : 'Next'}
                </button>
              )}
              <button
                type="button"
                onClick={onDone}
                className="serif-on h-11 px-5 type-label-m text-link hover:bg-selected"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
