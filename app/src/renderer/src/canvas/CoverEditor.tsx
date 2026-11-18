// C2 · The cover editor: new project (one question at a time) and edit project (every field
// at once). The cover on the left is the result, updating as you type.
import { useEffect, useRef, useState } from 'react'
import type { Cover, Project } from '../../../preload'
import { PLATES } from './Landscape'
import { LANDSCAPE_NAMES, MAX_CONCEPT } from './shared'
import { Shell } from './Chrome'
import { CoverFace } from './Cover'

type Field = 'name' | 'concept'
const QUESTIONS: { field: Field; ask: string; label: string }[] = [
  { field: 'name', ask: "What's it called?", label: 'Title' },
  { field: 'concept', ask: 'What is this project trying to say?', label: 'Description' }
]

const underline =
  'w-full rounded-none border-0 border-b border-line-strong bg-transparent pb-2 text-link outline-none placeholder:text-placeholder focus:border-focus focus-visible:outline-none'

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
    concept: project?.concept ?? ''
  })
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cover, setCover] = useState<Cover>(project?.cover ?? {})
  async function changeCover(next: Cover): Promise<void> {
    if (!project) return
    setCover(next)
    try {
      await window.api.setCover(project.id, next)
      onSaved()
    } catch (err) {
      setError(reason(err))
    }
  }
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
      onCreated(await window.api.createProject({ ...v, client: '' }), open)
    } catch (err) {
      setError(reason(err))
      setBusy(false)
    }
  }

  const q = QUESTIONS[step]
  const last = step === QUESTIONS.length - 1
  function next(e: React.FormEvent): void {
    e.preventDefault()
    if (!v[q.field].trim()) return setError(`${q.label} first.`)
    if (last) void create(false)
    else setStep(step + 1)
  }

  return (
    <div className="board bg-dots relative flex h-full w-full items-center justify-center gap-[clamp(32px,6vw,120px)] px-10 animate-[area-in_550ms_var(--ease)_both]">
      <Shell />

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
          <CoverFace
            info={{ id: project?.id ?? 'new', name: v.name, concept: v.concept, no, cover }}
          />
        </div>
      </div>

      <div className="flex w-[min(520px,45vw)] flex-col">
        {project ? (
          <>
            <p className="type-label-mono text-link">Edit project</p>
            {QUESTIONS.map((x) => (
              <label key={x.field} className="mt-8 flex flex-col gap-2">
                <span className="flex justify-between type-label-s text-dim">
                  {x.label}
                  {x.field === 'concept' && (
                    <span>
                      {v.concept.length} / {MAX_CONCEPT}
                    </span>
                  )}
                </span>
                {x.field === 'concept' ? (
                  <textarea
                    rows={4}
                    maxLength={MAX_CONCEPT}
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
            <div className="mt-6 flex flex-col gap-2">
              <span className="type-label-s text-dim">Backdrop</span>
              <div className="flex flex-wrap gap-2">
                <button
                  aria-pressed={!cover.landscape}
                  onClick={() => void changeCover({})}
                  className={`flex h-12 w-16 items-center justify-center border type-label-s text-link ${
                    !cover.landscape ? 'border-brand bg-selected' : 'border-chip-line'
                  }`}
                >
                  Auto
                </button>
                {LANDSCAPE_NAMES.map((name) => (
                  <button
                    key={name}
                    aria-pressed={cover.landscape === name}
                    onClick={() => void changeCover({ landscape: name })}
                    title={name}
                    className={`h-12 w-16 overflow-hidden border ${
                      cover.landscape === name ? 'border-brand' : 'border-chip-line'
                    }`}
                  >
                    <img src={PLATES[name]} alt={name} className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => onEnter(project.id)}
                className="serif-on h-11 bg-brand px-5 type-label-m text-on-brand hover:bg-inverse"
              >
                Enter project
              </button>
              <button
                onClick={onDone}
                className="h-11 border border-chip-line px-5 type-label-m text-link"
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
            </p>
            <label htmlFor="cover-q" className="mt-3 type-display-l text-link">
              {q.ask}
            </label>
            {q.field === 'concept' ? (
              <textarea
                id="cover-q"
                key={q.field}
                autoFocus
                rows={4}
                maxLength={MAX_CONCEPT}
                value={v.concept}
                onChange={(e) => change('concept', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) next(e) // Shift+Enter is a new line
                }}
                className={`${underline} mt-8 resize-none type-body-l`}
              />
            ) : (
              <input
                id="cover-q"
                key={q.field}
                autoFocus
                value={v[q.field]}
                onChange={(e) => change(q.field, e.target.value)}
                className={`${underline} mt-8 type-heading-m`}
              />
            )}
            {q.field === 'concept' && (
              <p className="mt-2 type-caption text-dim">
                {v.concept.length} / {MAX_CONCEPT}
              </p>
            )}
            <p role="status" className="mt-3 h-5 type-caption text-danger-fg">
              {error}
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {last ? (
                <>
                  <button
                    type="submit"
                    disabled={busy}
                    className="h-11 border border-chip-line px-5 type-label-m text-link"
                  >
                    Create project
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      v.concept.trim() ? void create(true) : setError('Description first.')
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
                  Next
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
