import { useEffect, useMemo, useState } from 'react'
import type { CreateState, Musician } from '../../../preload'
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

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

/** The start of Create: pick what this project needs; foundations are worked out live. */
export function Deliverables({ project }: { project: string }): React.JSX.Element {
  const [data, setData] = useState<CreateState | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [query, setQuery] = useState('')
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
    return error ? <p className="px-6 py-8 type-body-s text-signal-fg">{error}</p> : <div className="flex-1" />

  const names = new Map(data.instruments.map((i) => [i.id, i.name]))
  const q = query.trim().toLowerCase()
  const shown = data.musicians.filter(
    (m) =>
      !q ||
      [m.name, m.deliverable, m.category, ...m.keywords].some((s) => s.toLowerCase().includes(q))
  )
  const categories = [...new Set(shown.map((m) => m.category))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  )
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
      <div className="stagger flex-1 px-6 pt-8 pb-12">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h2 className="type-heading-s">Deliverables</h2>
            <p className="mt-1 type-caption text-fg-2">
              Pick everything this project needs. Shared foundations are built once, first.
            </p>
          </div>
          <label className="flex h-9 w-64 items-center gap-2 border border-line bg-canvas px-2 focus-within:border-focus">
            <Icon name="search-line" className="text-fg-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search deliverables"
              aria-label="Search deliverables"
              className="min-w-0 flex-1 bg-transparent type-body-s outline-none placeholder:text-fg-2"
            />
          </label>
        </div>

        {categories.map((c) => (
          <section key={c} className="mt-8">
            <h3 className="type-label-m text-fg-2">{c}</h3>
            <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {shown
                .filter((m) => m.category === c)
                .map((m) => (
                  <li key={m.id}>
                    <Card
                      musician={m}
                      on={chosen.includes(m.id)}
                      needs={m.prerequisites.map((p) => names.get(p) ?? p)}
                      onToggle={() => toggle(m.id)}
                    />
                  </li>
                ))}
            </ul>
          </section>
        ))}

        {shown.length === 0 && (
          <p className="mt-8 type-body-s text-fg-2">Nothing in the library matches “{query}”.</p>
        )}

        <div className="mt-8 max-w-md border border-dashed border-line-strong px-4 py-4">
          <p className="flex items-center gap-2 type-label-l">
            <Icon name="add-line" />
            Add your own
          </p>
          <p className="mt-1 pl-6 type-body-s text-fg-2">
            Describe a deliverable to the Orchestrator and it drafts a new Musician for your
            approval. Arrives with the Create chat.
          </p>
        </div>
      </div>

      {/* the build order, always in view while picking */}
      <div className="sticky bottom-0 flex items-center gap-6 border-t border-line bg-canvas px-6 py-3">
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

function Card({
  musician: m,
  on,
  needs,
  onToggle
}: {
  musician: Musician
  on: boolean
  needs: string[]
  onToggle: () => void
}): React.JSX.Element {
  return (
    <button
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      className={`flex h-full w-full flex-col border p-4 text-left transition-[background-color,border-color,scale] duration-150 active:scale-[0.98] ${on ? 'border-brand bg-brand-subtle' : 'border-line bg-canvas hover:bg-subtle'}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={on ? 'type-current-l' : 'type-label-l'}>{m.name}</span>
        <span
          className={`flex size-5 shrink-0 items-center justify-center border transition-colors duration-150 ${on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-canvas'}`}
        >
          {on && <Icon name="check-line" size={14} />}
        </span>
      </span>
      <span className="mt-2 line-clamp-3 type-body-s text-fg-2">{m.deliverable}</span>
      {needs.length > 0 && (
        <span className="mt-auto pt-4 type-caption text-fg-2">Needs {needs.join(', ')}</span>
      )}
    </button>
  )
}
