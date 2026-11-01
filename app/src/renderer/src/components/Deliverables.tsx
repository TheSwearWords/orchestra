import { useEffect, useMemo, useState } from 'react'
import type { CreateState } from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { Icon } from './Icon'

// Categories in the order a project usually needs them; unknown ones follow alphabetically.
const CATEGORY_ORDER = ['Brand', 'Web', 'Product', 'Motion', '3D', 'Code']
const rank = (c: string): number => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i === -1 ? CATEGORY_ORDER.length : i
}

const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'

// Grid cells, like the Research site buttons: four across, hairlines between, none on the right edge
const cell = 'border-r border-b border-line [&:nth-child(4n)]:border-r-0'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

/** The start of Create: pick what this project needs; foundations are worked out live. */
export function Deliverables({ project }: { project: string }): React.JSX.Element {
  const [data, setData] = useState<CreateState | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null) // null = all
  const [explaining, setExplaining] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.loadCreate(project).then(
      (d) => {
        setData(d)
        setChosen(d.selected)
        setSaved(d.selected)
      },
      (e) => setError(reason(e))
    )
  }, [project])

  const foundations = useMemo(
    () => (data ? foundationOrder(data.musicians, data.instruments, chosen) : []),
    [data, chosen]
  )

  if (!data)
    return error ? (
      <p className="px-6 py-8 type-body-s text-signal-fg">{error}</p>
    ) : (
      <div className="flex-1" />
    )

  const names = new Map(data.instruments.map((i) => [i.id, i.name]))
  const categories = [...new Set(data.musicians.map((m) => m.category))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  )
  const q = query.trim().toLowerCase()
  const shown = data.musicians
    .filter((m) => !category || m.category === category)
    .filter(
      (m) =>
        !q ||
        [m.name, m.deliverable, m.category, ...m.keywords].some((s) => s.toLowerCase().includes(q))
    )
    .sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name))
  const dirty = chosen.length !== saved.length || chosen.some((id) => !saved.includes(id))

  function toggle(id: string): void {
    setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])
  }

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      const ids = await window.api.saveDeliverables(project, chosen)
      setChosen(ids)
      setSaved(ids)
    } catch (e) {
      setError(reason(e))
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="stagger flex-1">
        <div role="radiogroup" aria-label="Category" className="flex flex-wrap gap-2 px-6 pt-6 pb-4">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? 'all'}
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={`h-8 border px-3 transition-[background-color,scale] duration-150 active:scale-[0.97] ${category === c ? 'border-line-strong bg-muted type-current-s' : 'border-line type-label-s text-fg-2 hover:bg-subtle hover:text-fg'}`}
            >
              {c ?? 'All'}
            </button>
          ))}
        </div>

        <label className="flex h-12 items-center gap-3 border-y border-line bg-canvas px-6 focus-within:bg-subtle">
          <Icon name="search-line" className="text-fg-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deliverables"
            aria-label="Search deliverables"
            className="min-w-0 flex-1 bg-transparent type-body-m outline-none placeholder:text-fg-2"
          />
        </label>

        <ul className="grid grid-cols-4">
          {shown.map((m) => {
            const on = chosen.includes(m.id)
            const needs = m.prerequisites.map((p) => names.get(p) ?? p).join(', ')
            return (
              <li key={m.id} className={cell}>
                <button
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(m.id)}
                  title={needs ? `Needs ${needs}` : undefined}
                  className={`flex h-full w-full flex-col items-start px-5 py-4 text-left transition-[background-color,scale] duration-150 active:scale-[0.98] ${on ? 'bg-brand text-on-brand' : 'bg-subtle hover:bg-muted'}`}
                >
                  <span
                    className={`flex items-center gap-2 ${on ? 'type-current-m' : 'type-label-m'}`}
                  >
                    <Icon name={on ? 'check-line' : m.icon} size={18} />
                    {m.name}
                  </span>
                  <span
                    className={`mt-1.5 line-clamp-3 type-body-s leading-5 ${on ? 'text-on-brand/85' : 'text-fg-2'}`}
                  >
                    {m.deliverable}
                  </span>
                </button>
              </li>
            )
          })}
          <li className={cell}>
            <button
              onClick={() => setExplaining(!explaining)}
              aria-expanded={explaining}
              className={`flex h-full min-h-24 w-full items-center justify-center gap-2 transition-colors duration-150 hover:bg-muted ${explaining ? 'bg-muted type-current-m' : 'bg-canvas type-label-m text-link'}`}
            >
              <Icon name="add-line" />
              Add your own
            </button>
          </li>
        </ul>

        {shown.length === 0 && (
          <p className="px-6 pt-6 type-body-s text-fg-2">
            Nothing {category ? `in ${category} ` : ''}matches “{query}”.
          </p>
        )}
        {explaining && (
          <p className="mx-6 mt-6 max-w-xl border-l-2 border-agent bg-agent-subtle px-3 py-2 type-body-s text-agent-fg">
            You’ll describe a new deliverable to the Orchestrator, and it drafts a Musician for your
            approval. That arrives with the Create chat, the next build step.
          </p>
        )}
      </div>

      {/* the build order, always in view while picking */}
      <div className="sticky bottom-0 mt-12 flex items-center gap-6 border-t border-line bg-canvas px-6 py-3">
        <div className="min-w-0 flex-1">
          <p className="type-caption text-fg-2">
            {chosen.length} deliverable{chosen.length === 1 ? '' : 's'}
            {foundations.length > 0 &&
              ` · ${foundations.length} foundation${foundations.length === 1 ? '' : 's'} built first`}
          </p>
          <ol className="mt-0.5 flex gap-x-5 overflow-hidden type-body-s whitespace-nowrap">
            {foundations.map((f, i) => (
              <li key={f.id}>
                <span className="text-fg-2">{i + 1}</span> {f.name}
              </li>
            ))}
            {foundations.length === 0 && (
              <li>{chosen.length ? 'No foundations needed.' : 'Nothing picked yet.'}</li>
            )}
          </ol>
          {error && (
            <p role="alert" className="mt-1 type-caption text-signal-fg">
              {error}
            </p>
          )}
        </div>
        {!dirty && saved.length > 0 && <span className="type-caption text-fg-2">Saved</span>}
        <button onClick={save} disabled={!dirty || saving} className={solidButton}>
          {saving ? 'Saving…' : 'Save deliverables'}
        </button>
      </div>
    </div>
  )
}
