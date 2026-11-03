import { useEffect, useState, type ReactNode } from 'react'
import type { Library, Role } from '../../../preload'
import { Icon } from './Icon'

// The Agents screen: the library's hierarchy (Orchestrator → Musicians → Instruments) on the left,
// the chosen agent on the right with its model, a Musician's crew, and its markdown file.

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'
// Tree lines, as in Create's score: an elbow from the parent's stem; the last child's stem stops at it.
const branch =
  'relative pl-6 before:absolute before:top-3.5 before:left-2 before:w-3 before:border-t before:border-line-strong after:absolute after:top-0 after:left-2 after:h-full after:border-l after:border-line-strong last:after:h-3.5'

const MODELS = [
  { id: 'opus', name: 'Opus', hint: 'Deepest thinking; the most expensive' },
  { id: 'sonnet', name: 'Sonnet', hint: 'Strong craft at a middle price' },
  { id: 'haiku', name: 'Haiku', hint: 'Fast and cheap, for menial work' }
]
const modelName = (m: string): string => MODELS.find((x) => x.id === m)?.name ?? m

interface Pick {
  role: Role
  id: string
}

export function Agents(): React.JSX.Element {
  const [data, setData] = useState<{ library: Library; problems: string[] } | null>(null)
  const [pick, setPick] = useState<Pick>({ role: 'orchestrator', id: 'orchestrator' })
  const [error, setError] = useState('')
  const reload = (): Promise<void> =>
    window.api.loadAgents().then(setData, (e) => setError(reason(e)))
  useEffect(() => void reload(), [])

  if (!data) return <p className="px-6 type-body-s text-fg-2">{error || 'Loading the library…'}</p>
  const { library: lib, problems } = data
  const names = new Map(lib.instruments.map((i) => [i.id, i.name]))
  const crewed = new Set(lib.musicians.flatMap((m) => m.instruments))
  const loose = lib.instruments.filter((i) => !crewed.has(i.id)) // foundations and spares
  const is = (role: Role, id: string): boolean => pick.role === role && pick.id === id

  const row = (
    role: Role,
    id: string,
    name: string,
    model: string,
    marker: ReactNode
  ): ReactNode => (
    <button
      onClick={() => setPick({ role, id })}
      aria-current={is(role, id) || undefined}
      className="flex min-h-7 w-full items-center gap-2.5 text-left transition-colors duration-150 hover:text-link"
    >
      {marker}
      <span
        className={`min-w-0 flex-1 truncate ${is(role, id) ? 'type-current-s text-link' : role === 'instrument' ? 'type-body-s' : 'type-label-m'}`}
      >
        {name}
      </span>
      <span className="shrink-0 type-caption text-fg-2">{modelName(model)}</span>
    </button>
  )
  const instrumentMark = (
    <span className="mx-1.5 size-3 shrink-0 rounded-full border-2 border-fg-2 bg-canvas" />
  )

  return (
    <div className="stagger grid gap-6 px-6 pb-10 lg:grid-cols-[minmax(280px,380px)_1fr]">
      {problems.length > 0 && (
        <ul className="border border-signal bg-signal-subtle p-4 type-body-s text-signal-fg lg:col-span-2">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <section className="self-start border border-line bg-canvas p-5" aria-label="Hierarchy">
        <h2 className="type-heading-xs">Hierarchy</h2>
        <p className="mt-1 type-caption text-fg-2">
          Only the Orchestrator talks to you. Musicians run a deliverable; Instruments do one job.
        </p>
        <div className="mt-4">
          {row(
            'orchestrator',
            'orchestrator',
            lib.orchestrator?.name ?? 'Orchestrator',
            lib.orchestrator?.model ?? 'opus',
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
            >
              <Icon name="logo-mark" size={12} />
            </span>
          )}
          <ul className="mt-1 ml-3 flex flex-col gap-1">
            {lib.musicians.map((m) => (
              <li key={m.id} className={branch}>
                {row(
                  'musician',
                  m.id,
                  m.name,
                  m.model,
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-brand bg-canvas text-link">
                    <Icon name={m.icon || 'shapes-line'} size={12} />
                  </span>
                )}
                {m.instruments.length > 0 && (
                  <ul className="mt-1 ml-3 flex flex-col gap-1">
                    {m.instruments.map((i) => (
                      <li key={i} className={branch}>
                        {row(
                          'instrument',
                          i,
                          names.get(i) ?? i,
                          lib.instruments.find((x) => x.id === i)?.model ?? 'haiku',
                          instrumentMark
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            {loose.length > 0 && (
              <li className={branch}>
                <p className="flex min-h-7 items-center type-caption text-fg-2">
                  Foundations and spare Instruments
                </p>
                <ul className="ml-3 flex flex-col gap-1">
                  {loose.map((i) => (
                    <li key={i.id} className={branch}>
                      {row('instrument', i.id, i.name, i.model, instrumentMark)}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      </section>

      <Detail
        key={`${pick.role}:${pick.id}`}
        lib={lib}
        pick={pick}
        onPick={setPick}
        onChanged={reload}
      />
    </div>
  )
}

function Detail({
  lib,
  pick,
  onPick,
  onChanged
}: {
  lib: Library
  pick: Pick
  onPick: (p: Pick) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const musician =
    pick.role === 'musician' ? lib.musicians.find((m) => m.id === pick.id) : undefined
  const instrument =
    pick.role === 'instrument' ? lib.instruments.find((i) => i.id === pick.id) : undefined
  const agent = pick.role === 'orchestrator' ? lib.orchestrator : (musician ?? instrument)
  const [file, setFile] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [version, setVersion] = useState(0) // bumped to re-read the file after a change
  useEffect(() => {
    void window.api.readAgent(pick.role, pick.id).then(
      (t) => {
        setFile(t)
        setDraft(t)
      },
      (e) => setError(reason(e))
    )
  }, [pick.role, pick.id, version])

  // every change is written straight to the agent's file, then the screen reloads from disk
  async function run(change: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await change()
      await onChanged()
      setVersion((v) => v + 1)
    } catch (e) {
      setError(reason(e))
    }
    setBusy(false)
  }

  if (!agent)
    return <p className="type-body-s text-fg-2">This agent is no longer in the library.</p>
  const usedBy = lib.musicians.filter(
    (m) => m.instruments.includes(pick.id) || m.prerequisites.includes(pick.id)
  )
  const spare = musician ? lib.instruments.filter((i) => !musician.instruments.includes(i.id)) : []
  const label = 'type-label-s text-fg-2'
  // a model or crew change reloads the file, so it waits until file edits are saved or discarded
  const dirty = file !== null && draft !== file

  return (
    <section className="stagger flex min-w-0 flex-col gap-6" aria-label={agent.name}>
      <div>
        <p className="type-caption text-fg-2">
          {pick.role === 'orchestrator'
            ? 'Orchestrator'
            : pick.role === 'musician'
              ? 'Musician'
              : 'Instrument'}
        </p>
        <h2 className="type-heading-m">{agent.name}</h2>
        <p className="mt-1 type-body-s text-fg-2">
          {musician?.deliverable ||
            instrument?.job ||
            'Talks to you, plans the work and briefs the Musicians.'}
          {instrument?.output && ` Writes ${instrument.output}.`}
        </p>
      </div>

      <div>
        <p className={label}>Model</p>
        <div role="radiogroup" aria-label="Model" className="mt-2 flex flex-wrap gap-2">
          {MODELS.map((m) => {
            const on = agent.model === m.id
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={on}
                disabled={busy || dirty}
                title={m.hint}
                onClick={() =>
                  !on && void run(() => window.api.setAgentModel(pick.role, pick.id, m.id))
                }
                className={`flex h-9 items-center border px-4 transition-[background-color,border-color,scale] duration-150 active:scale-[0.97] ${on ? 'border-brand bg-brand-subtle type-current-s text-link' : 'border-line-strong type-label-m hover:bg-muted'}`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
        <p className="mt-2 type-caption text-fg-2">
          {dirty
            ? 'Save or discard your file edits to change the model or crew.'
            : 'Takes effect the next time this agent starts.'}
        </p>
      </div>

      {musician && (
        <div>
          <p className={label}>Crew · in run order</p>
          <ul className="mt-2 flex flex-col border border-line">
            {musician.instruments.map((id) => (
              <li
                key={id}
                className="flex h-10 items-center gap-2 border-b border-line pr-1 pl-3 last:border-b-0"
              >
                <button
                  onClick={() => onPick({ role: 'instrument', id })}
                  className="min-w-0 flex-1 truncate text-left type-body-s hover:text-link"
                >
                  {lib.instruments.find((i) => i.id === id)?.name ?? id}
                </button>
                <button
                  disabled={busy || dirty}
                  onClick={() =>
                    void run(() =>
                      window.api.setCrew(
                        musician.id,
                        musician.instruments.filter((x) => x !== id)
                      )
                    )
                  }
                  aria-label={`Remove ${id} from the crew`}
                  title="Remove from the crew (the Instrument stays in the library)"
                  className="flex size-8 items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg"
                >
                  <Icon name="close-line" size={14} />
                </button>
              </li>
            ))}
            {musician.instruments.length === 0 && (
              <li className="px-3 py-2.5 type-body-s text-fg-2">
                No crew yet. It proposes its Instruments on its first job.
              </li>
            )}
          </ul>
          {spare.length > 0 && (
            <select
              value=""
              disabled={busy || dirty}
              onChange={(e) =>
                e.target.value &&
                void run(() =>
                  window.api.setCrew(musician.id, [...musician.instruments, e.target.value])
                )
              }
              aria-label="Add an Instrument to the crew"
              className="mt-2 h-9 border border-line-strong bg-canvas px-3 type-label-m outline-none focus:border-focus"
            >
              <option value="">Add an Instrument…</option>
              {spare.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          )}
          {musician.prerequisites.length > 0 && (
            <p className="mt-2 type-caption text-fg-2">
              Foundations it needs first:{' '}
              {musician.prerequisites
                .map((p) => lib.instruments.find((i) => i.id === p)?.name ?? p)
                .join(', ')}
            </p>
          )}
        </div>
      )}

      {instrument && (
        <div>
          <p className={label}>Used by</p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 type-body-s">
            {usedBy.length === 0 && <span className="text-fg-2">No Musician yet.</span>}
            {usedBy.map((m) => (
              <button
                key={m.id}
                onClick={() => onPick({ role: 'musician', id: m.id })}
                className="text-link hover:underline"
              >
                {m.name}
              </button>
            ))}
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(() => window.api.writeAgent(pick.role, pick.id, draft))
        }}
        className="flex flex-col"
      >
        <label htmlFor="agent-file" className={label}>
          Markdown file · front matter, then the prompt
        </label>
        <textarea
          id="agent-file"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          rows={22}
          disabled={file === null}
          className="mt-2 w-full resize-y border border-line bg-canvas p-3 font-mono text-[13px] leading-5 outline-none focus:border-focus"
        />
        {error && <p className="mt-2 type-caption text-signal-fg">{error}</p>}
        <div className="mt-3 flex items-center gap-4">
          <button type="submit" disabled={busy || !dirty} className={solidButton}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {dirty && (
            <button
              type="button"
              onClick={() => setDraft(file)}
              className="type-label-m text-fg-2 hover:text-fg"
            >
              Discard changes
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
