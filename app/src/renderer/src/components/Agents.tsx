import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { AgentFileOpener, type AgentFileRef } from '../canvas/shared'
import type { EditKey, Library, ProviderStatus, Role } from '../../../preload'
import { PROVIDERS, provider, RUNNABLE } from '../../../main/providers'
import { Icon } from './Icon'

// The Agents screen: the library's hierarchy (Orchestrator → Musicians → Instruments) on the
// left; the chosen agent on the right, with its name, description, provider and model, a
// Musician's Instruments, and its markdown file in a modal.

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'
const outlineButton =
  'flex h-9 shrink-0 items-center gap-2 border border-line-strong bg-canvas px-4 type-label-m transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.97] disabled:text-fg-disabled'
// Tree lines on blue: an elbow from the parent's stem; the last child's stem stops at it.
const branch =
  'relative pl-7 before:absolute before:top-[18px] before:left-2.5 before:w-3.5 before:border-t before:border-line-strong after:absolute after:top-0 after:left-2.5 after:h-full after:border-l after:border-line-strong last:after:h-[18px]'

interface Pick {
  role: Role
  id: string
}
interface AgentLike {
  name: string
  model: string
  provider: string
}

const modelName = (a: AgentLike): string =>
  provider(a.provider)?.models.find((m) => m.id === a.model)?.name ?? a.model

/** Why an agent can't run as set, or '' when it can. */
function problem(a: AgentLike, status: ProviderStatus | null): string {
  const p = provider(a.provider) ?? PROVIDERS[0]
  if (status && !status[p.id].connected) return `${p.name} isn’t connected. ${p.connectHint}`
  if (!RUNNABLE.includes(p.id))
    return `Orchestra can’t run agents on ${p.name} yet, so this one won’t start until it’s back on Anthropic.`
  return ''
}

export function Agents(): React.JSX.Element {
  const [data, setData] = useState<{ library: Library; problems: string[] } | null>(null)
  const [status, setStatus] = useState<ProviderStatus | null>(null)
  const [pick, setPick] = useState<Pick>({ role: 'orchestrator', id: 'orchestrator' })
  const [error, setError] = useState('')
  const reload = (): Promise<void> =>
    window.api.loadAgents().then(setData, (e) => setError(reason(e)))
  useEffect(() => {
    void reload()
    void window.api.providerStatus().then(setStatus)
    // a file edited in its own window on the board changes the library too
    const changed = (): void => void reload()
    addEventListener('orchestra:agents-changed', changed)
    return () => removeEventListener('orchestra:agents-changed', changed)
  }, [])

  if (!data) return <p className="px-6 type-body-s text-fg-2">{error || 'Loading the library…'}</p>
  const { library: lib, problems } = data
  const byId = new Map(lib.instruments.map((i) => [i.id, i]))
  const crewed = new Set(lib.musicians.flatMap((m) => m.instruments))
  const loose = lib.instruments.filter((i) => !crewed.has(i.id)) // foundations and spares
  const is = (role: Role, id: string): boolean => pick.role === role && pick.id === id

  const row = (role: Role, id: string, a: AgentLike, marker: ReactNode): ReactNode => {
    const on = is(role, id)
    const bad = problem(a, status)
    return (
      <button
        onClick={() => setPick({ role, id })}
        aria-current={on || undefined}
        className={`flex min-h-9 w-full items-center gap-3 px-2 text-left transition-colors duration-150 ${on ? 'bg-brand-subtle text-link' : 'hover:bg-muted'}`}
      >
        {marker}
        <span
          className={`min-w-0 flex-1 truncate ${on ? 'type-current-m' : role === 'instrument' ? 'type-body-s' : 'type-label-l'}`}
        >
          {a.name}
        </span>
        {bad && (
          <span
            title={bad}
            className="flex size-4 shrink-0 items-center justify-center border border-signal type-log-s text-signal-fg"
          >
            !
          </span>
        )}
        <span className="shrink-0 type-caption text-fg-2">{a.model}</span>
      </button>
    )
  }
  const instrumentMark = <span className="mx-1.5 size-3 shrink-0 border-[1.5px] border-fg-2" />

  return (
    <div className="stagger grid gap-6 px-6 pb-10 lg:grid-cols-[minmax(400px,520px)_1fr]">
      {problems.length > 0 && (
        <ul className="border border-signal bg-signal-subtle p-4 type-body-s text-signal-fg lg:col-span-2">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <section className="self-start border border-line bg-canvas" aria-label="Hierarchy">
        <div className="flex items-baseline justify-between gap-4 border-b border-line px-6 py-4">
          <h2 className="type-heading-xs">Hierarchy</h2>
          <span className="type-caption text-fg-2">
            {lib.musicians.length} Musicians · {lib.instruments.length} Instruments
          </span>
        </div>
        <div className="px-4 pt-4 pb-6">
          <p className="px-2 pb-4 type-caption text-fg-2">
            Only the Orchestrator talks to you. Musicians run a deliverable; Instruments do one job.
          </p>
          {row(
            'orchestrator',
            'orchestrator',
            lib.orchestrator ?? { name: 'Orchestrator', model: 'opus', provider: 'anthropic' },
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
            >
              <Icon name="logo-mark" size={16} />
            </span>
          )}
          <ul className="mt-3 ml-2 flex flex-col gap-5">
            {lib.musicians.map((m) => (
              <li key={m.id} className={branch}>
                {row(
                  'musician',
                  m.id,
                  m,
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand text-link">
                    <Icon name={m.icon || 'shapes-line'} size={14} />
                  </span>
                )}
                {m.instruments.length > 0 && (
                  <ul className="mt-1 ml-2 flex flex-col gap-0.5">
                    {m.instruments.map((i) => {
                      const inst = byId.get(i)
                      return (
                        <li key={i} className={branch}>
                          {row(
                            'instrument',
                            i,
                            inst ?? { name: i, model: 'haiku', provider: 'anthropic' },
                            instrumentMark
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
            {loose.length > 0 && (
              <li className={branch}>
                <p className="flex min-h-9 items-center px-2 type-caption text-fg-2">
                  Foundations and spare Instruments
                </p>
                <ul className="ml-2 flex flex-col gap-0.5">
                  {loose.map((i) => (
                    <li key={i.id} className={branch}>
                      {row('instrument', i.id, i, instrumentMark)}
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
        status={status}
        onPick={setPick}
        onChanged={reload}
      />
    </div>
  )
}

function Detail({
  lib,
  pick,
  status,
  onPick,
  onChanged
}: {
  lib: Library
  pick: Pick
  status: ProviderStatus | null
  onPick: (p: Pick) => void
  onChanged: () => Promise<void>
}): React.JSX.Element {
  const musician =
    pick.role === 'musician' ? lib.musicians.find((m) => m.id === pick.id) : undefined
  const instrument =
    pick.role === 'instrument' ? lib.instruments.find((i) => i.id === pick.id) : undefined
  const agent = pick.role === 'orchestrator' ? lib.orchestrator : (musician ?? instrument)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fileOpen, setFileOpen] = useState(false)
  const openOnBoard = useContext(AgentFileOpener)

  // every change is written straight to the agent's file, then the screen reloads from disk
  async function run(change: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError('')
    try {
      await change()
      await onChanged()
    } catch (e) {
      setError(reason(e))
    }
    setBusy(false)
  }
  const edit = (role: Role, id: string, key: EditKey, value: string): Promise<void> =>
    run(() => window.api.editAgent(role, id, key, value))

  if (!agent)
    return <p className="type-body-s text-fg-2">This agent is no longer in the library.</p>
  const usedBy = lib.musicians.filter(
    (m) => m.instruments.includes(pick.id) || m.prerequisites.includes(pick.id)
  )
  const label = 'type-label-s text-fg-2'
  const description = musician?.deliverable ?? instrument?.job ?? agent.description
  const roleName =
    pick.role === 'orchestrator'
      ? 'Orchestrator'
      : pick.role === 'musician'
        ? 'Musician'
        : 'Instrument'

  return (
    <section className="stagger flex min-w-0 flex-col gap-7" aria-label={agent.name}>
      <div className="flex flex-col gap-1">
        <p className="type-caption text-fg-2">{roleName}</p>
        <Editable
          key={`name:${agent.name}`}
          label={`${roleName} name`}
          value={agent.name}
          disabled={busy}
          onSave={(v) => edit(pick.role, pick.id, 'name', v)}
          className="type-heading-m"
        />
        <Editable
          key={`description:${description}`}
          label="Description"
          value={description}
          placeholder={
            pick.role === 'orchestrator'
              ? 'Talks to you, plans the work and briefs the Musicians.'
              : 'What it does, in one line'
          }
          multiline
          disabled={busy}
          onSave={(v) => edit(pick.role, pick.id, 'description', v)}
          className="type-body-m text-fg-2"
        />
        {instrument?.output && (
          <p className="type-caption text-fg-2">
            Writes <span className="type-log-s">{instrument.output}</span>
          </p>
        )}
      </div>

      <div>
        <p className={label}>Runs on</p>
        <RunsOn
          agent={agent}
          status={status}
          disabled={busy}
          onPick={(v) => edit(pick.role, pick.id, 'runsOn', v)}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() =>
            openOnBoard && agent ? openOnBoard({ ...pick, name: agent.name }) : setFileOpen(true)
          }
          className={outlineButton}
        >
          <Icon name="file-text-line" size={16} />
          Open its file
        </button>
        <span className="type-caption text-fg-2">
          The full prompt, as markdown. Changes take effect the next time the agent starts.
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
        >
          {error}
        </p>
      )}

      {musician && (
        <div>
          <p className={label}>Instruments · in run order</p>
          <ul className="mt-2 flex flex-col border border-line">
            {musician.instruments.map((id) => {
              const inst = lib.instruments.find((i) => i.id === id)
              return (
                <li key={id} className="border-b border-line px-3 py-2.5 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="size-2.5 shrink-0 border-[1.5px] border-fg-2" aria-hidden />
                    <button
                      onClick={() => onPick({ role: 'instrument', id })}
                      className="min-w-0 flex-1 truncate text-left type-label-m hover:text-link"
                    >
                      {inst?.name ?? id}
                    </button>
                    {inst && (
                      <CompactRunsOn
                        agent={inst}
                        status={status}
                        disabled={busy}
                        onPick={(v) => edit('instrument', id, 'runsOn', v)}
                      />
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          window.api.setCrew(
                            musician.id,
                            musician.instruments.filter((x) => x !== id)
                          )
                        )
                      }
                      aria-label={`Remove ${inst?.name ?? id} from the crew`}
                      title="Remove from the crew (the Instrument stays in the library)"
                      className="flex size-8 items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg"
                    >
                      <Icon name="close-line" size={14} />
                    </button>
                  </div>
                  {inst && problem(inst, status) && (
                    <p className="mt-1.5 pl-5 type-caption text-signal-fg">
                      {problem(inst, status)}
                    </p>
                  )}
                </li>
              )
            })}
            {musician.instruments.length === 0 && (
              <li className="px-3 py-2.5 type-body-s text-fg-2">
                No Instruments yet. It proposes its own on its first job.
              </li>
            )}
          </ul>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const id = await window.api.newInstrument(musician.id)
                await onChanged()
                onPick({ role: 'instrument', id }) // straight to naming and describing it
              })
            }
            className={`mt-2 ${outlineButton}`}
          >
            <Icon name="add-line" size={16} />
            Add an Instrument
          </button>
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

      {fileOpen && (
        <FileModal
          pick={pick}
          name={agent.name}
          onClose={() => setFileOpen(false)}
          onSaved={onChanged}
        />
      )}
    </section>
  )
}

/** Text that reads as a heading or paragraph and edits in place. Saves on Enter or when focus
 * leaves; Escape puts the old text back. */
function Editable({
  label,
  value,
  placeholder,
  multiline,
  disabled,
  onSave,
  className
}: {
  label: string
  value: string
  placeholder?: string
  multiline?: boolean
  disabled: boolean
  onSave: (v: string) => Promise<void>
  className: string
}): React.JSX.Element {
  const [text, setText] = useState(value) // the parent remounts it (key) when value changes
  const commit = (): void => {
    if (text.trim() !== value.trim()) void onSave(text)
  }
  const shared = {
    'aria-label': label,
    value: text,
    placeholder,
    disabled,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        e.currentTarget.blur()
      }
      if (e.key === 'Escape') setText(value)
    },
    className: `-mx-2 w-[calc(100%+1rem)] border border-transparent bg-transparent px-2 outline-none transition-colors duration-150 hover:border-line focus:border-focus focus:bg-canvas placeholder:text-fg-disabled ${className}`
  }
  return multiline ? (
    <textarea {...shared} rows={2} className={`${shared.className} resize-none py-1`} />
  ) : (
    <input {...shared} />
  )
}

/** The three providers side by side, logo on top, their models as buttons underneath. Picking
 * any model sets provider and model together ("<provider>/<model>"). A provider that isn't
 * connected is dimmed, with how to connect it at the foot of its column. */
function ProviderGrid({
  agent,
  status,
  disabled,
  compact,
  onPick
}: {
  agent: AgentLike
  status: ProviderStatus | null
  disabled: boolean
  compact?: boolean
  onPick: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label={`${agent.name}: model`}>
      {PROVIDERS.map((p) => {
        const off = status ? !status[p.id].connected : false
        return (
          <div key={p.id} className="flex min-w-0 flex-col border border-line">
            <div
              className={`flex items-center justify-between gap-2 border-b border-line px-3 ${compact ? 'h-10' : 'h-12'}`}
              title={
                off
                  ? `${p.name} isn’t connected`
                  : `${p.name}, connected through ${status?.[p.id].via ?? '…'}`
              }
            >
              <Icon
                name={`${p.id}-fill`}
                size={compact ? 18 : 22}
                className={off ? 'text-fg-disabled' : 'text-fg'}
              />
              <span className="sr-only">{p.name}</span>
              <span
                className={`flex items-center gap-1.5 type-caption ${off ? 'text-fg-2' : 'text-success-fg'}`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${off ? 'border border-fg-2' : 'bg-success'}`}
                />
                <span className={compact ? 'sr-only' : ''}>
                  {off ? 'Not connected' : 'Connected'}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-1 p-1.5">
              {p.models.map((m) => {
                const on = agent.provider === p.id && agent.model === m.id
                return (
                  <button
                    key={m.id}
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    title={m.hint}
                    onClick={() => !on && onPick(`${p.id}/${m.id}`)}
                    className={`flex items-center justify-between gap-2 border px-2.5 text-left transition-[background-color,border-color,scale] duration-150 active:scale-[0.98] ${compact ? 'h-8' : 'h-10'} ${on ? 'border-brand bg-brand-subtle text-link' : 'border-transparent hover:bg-muted'} ${off && !on ? 'text-fg-2' : ''}`}
                  >
                    <span className={`truncate ${on ? 'type-current-s' : 'type-label-m'}`}>
                      {m.name}
                    </span>
                    {on && <Icon name="check-line" size={14} />}
                  </button>
                )
              })}
            </div>
            {off && !compact && (
              <p className="mt-auto border-t border-line px-3 py-2 type-caption text-fg-2">
                {p.connectHint}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** The grid for the agent itself, with what stops it running underneath. */
function RunsOn({
  agent,
  status,
  disabled,
  onPick
}: {
  agent: AgentLike
  status: ProviderStatus | null
  disabled: boolean
  onPick: (v: string) => Promise<void>
}): React.JSX.Element {
  const bad = problem(agent, status)
  return (
    <div className="mt-2 flex flex-col gap-3">
      <ProviderGrid
        agent={agent}
        status={status}
        disabled={disabled}
        onPick={(v) => void onPick(v)}
      />
      {bad ? (
        <p
          role="alert"
          className="border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
        >
          {bad}
        </p>
      ) : (
        <p className="type-caption text-fg-2">Takes effect the next time this agent starts.</p>
      )}
    </div>
  )
}

/** One line in an Instrument row: the logo and model, opening the same grid in a popover. */
function CompactRunsOn({
  agent,
  status,
  disabled,
  onPick
}: {
  agent: AgentLike
  status: ProviderStatus | null
  disabled: boolean
  onPick: (v: string) => Promise<void>
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent): void => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  const p = provider(agent.provider) ?? PROVIDERS[0]
  const bad = !!problem(agent, status)
  return (
    <div ref={box} className="relative shrink-0">
      <button
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${agent.name} runs on ${p.name} ${modelName(agent)}. Change`}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-8 items-center gap-2 border px-2.5 type-label-s transition-colors duration-150 hover:bg-muted ${bad ? 'border-signal text-signal-fg' : 'border-line-strong'}`}
      >
        <Icon name={`${p.id}-fill`} size={14} />
        {modelName(agent)}
        <Icon name="arrow-down-s-line" size={14} className="text-fg-2" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${agent.name}: choose a model`}
          className="absolute top-full right-0 z-20 mt-1 w-[480px] border border-line bg-canvas p-3 shadow-[var(--elevation-3)]"
        >
          <ProviderGrid
            agent={agent}
            status={status}
            disabled={disabled}
            compact
            onPick={(v) => {
              setOpen(false)
              void onPick(v)
            }}
          />
        </div>
      )}
    </div>
  )
}

/** The agent's markdown file in a modal: front matter, then the prompt. Escape or Close asks
 * before throwing away unsaved edits. */
function FileModal({
  pick,
  name,
  onClose,
  onSaved
}: {
  pick: Pick
  name: string
  onClose: () => void
  onSaved: () => Promise<void>
}): React.JSX.Element {
  const dialog = useRef<HTMLDialogElement>(null)
  const editor = useRef<HTMLTextAreaElement>(null)
  const [file, setFile] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = file !== null && draft !== file

  useEffect(() => {
    dialog.current?.showModal()
    editor.current?.focus() // showModal focuses the close button first
    void window.api.readAgent(pick.role, pick.id).then(
      (t) => {
        setFile(t)
        setDraft(t)
      },
      (e) => setError(reason(e))
    )
  }, [pick.role, pick.id])

  const close = (): void => {
    if (dirty && !window.confirm('Discard your changes to this file?')) return
    dialog.current?.close()
    onClose()
  }

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await window.api.writeAgent(pick.role, pick.id, draft)
      setFile(draft)
      await onSaved()
    } catch (e) {
      setError(reason(e))
    }
    setSaving(false)
  }

  const path =
    pick.role === 'orchestrator'
      ? 'library/orchestrator.md'
      : `library/${pick.role === 'musician' ? 'musicians' : 'instruments'}/${pick.id}.md`

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault() // Escape: same as Close, so unsaved edits are asked about
        close()
      }}
      aria-label={`${name}: file`}
      className="m-auto h-[min(860px,90vh)] open:flex w-[min(960px,92vw)] flex-col border border-line bg-canvas p-0 text-fg backdrop:bg-overlay/50"
    >
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="type-current-m truncate">{name}</p>
          <p className="type-log-s text-fg-2">{path}</p>
        </div>
        <button
          onClick={close}
          aria-label="Close"
          className="flex size-9 items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg"
        >
          <Icon name="close-line" />
        </button>
      </div>
      <textarea
        aria-label="Markdown file: front matter, then the prompt"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        disabled={file === null}
        ref={editor}
        className="min-h-0 flex-1 resize-none bg-canvas px-5 py-4 font-mono text-[13px] leading-5 outline-none"
      />
      <div className="flex items-center gap-4 border-t border-line px-5 py-3">
        <button onClick={() => void save()} disabled={saving || !dirty} className={solidButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {dirty && (
          <button
            onClick={() => setDraft(file ?? '')}
            className="type-label-m text-fg-2 hover:text-fg"
          >
            Discard changes
          </button>
        )}
        {error ? (
          <p className="type-caption text-signal-fg">{error}</p>
        ) : (
          <p className="ml-auto type-caption text-fg-2">
            Front matter between the --- lines, then the prompt.
          </p>
        )}
      </div>
    </dialog>
  )
}

/** An agent's markdown file as a window on the artboard: the whole file, front matter then
 * prompt, editable in place. It grows to fit the file (artboard windows never scroll). */
export function AgentFile({ file: f }: { file: AgentFileRef }): React.JSX.Element {
  const [file, setFile] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = file !== null && draft !== file

  useEffect(() => {
    void window.api.readAgent(f.role, f.id).then(
      (t) => {
        setFile(t)
        setDraft(t)
      },
      (e) => setError(reason(e))
    )
  }, [f.role, f.id])

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await window.api.writeAgent(f.role, f.id, draft)
      setFile(draft)
      dispatchEvent(new Event('orchestra:agents-changed'))
    } catch (e) {
      setError(reason(e))
    }
    setSaving(false)
  }

  const path =
    f.role === 'orchestrator'
      ? 'library/orchestrator.md'
      : `library/${f.role === 'musician' ? 'musicians' : 'instruments'}/${f.id}.md`
  return (
    <div className="flex flex-col">
      <p className="border-b border-hair px-5 py-2.5 font-mono text-[12px] text-dim">{path}</p>
      <textarea
        aria-label={`${f.name}: markdown file, front matter then the prompt`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        disabled={file === null}
        rows={Math.max(12, draft.split('\n').length + 1)}
        className="resize-none overflow-hidden bg-card px-5 py-4 font-mono text-[13px] leading-5 text-fg outline-none"
      />
      <div className="flex items-center gap-4 border-t border-hair px-5 py-3">
        <button onClick={() => void save()} disabled={saving || !dirty} className={solidButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {dirty && (
          <button
            onClick={() => setDraft(file ?? '')}
            className="type-label-m text-dim hover:text-link"
          >
            Discard changes
          </button>
        )}
        {error ? (
          <p className="type-caption text-signal-fg">{error}</p>
        ) : (
          <p className="ml-auto type-caption text-dim">
            {dirty ? 'Unsaved changes' : 'Takes effect the next time this agent starts.'}
          </p>
        )}
      </div>
    </div>
  )
}
