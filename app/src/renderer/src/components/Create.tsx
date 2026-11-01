import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ChatMessage, CreateState, Musician, Output } from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { Deliverables } from './Deliverables'
import { Icon } from './Icon'
import { Markdown } from './Research'
import { splitSuggestion } from '../suggest'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'

/** The Create phase: an open-ended conversation with the Orchestrator, with the deliverable
 * picker a click away. Deliverables can be picked first, later, or added from the chat. */
export function Create({ project }: { project: string }): React.JSX.Element {
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    window.api.loadCreate(project).then(setPlan)
  }, [project])

  if (!plan) return <div className="flex-1" />
  if (picking)
    return (
      <div className="flex flex-1 flex-col">
        <button
          onClick={() => setPicking(false)}
          className="flex items-center gap-2 self-start px-6 pt-5 type-label-m text-link hover:underline"
        >
          <Icon name="arrow-left-line" />
          Back to the conversation
        </button>
        <Deliverables
          project={project}
          onSaved={(ids) => {
            setPlan({ ...plan, selected: ids })
            setPicking(false)
          }}
        />
      </div>
    )
  return (
    <Workspace
      project={project}
      plan={plan}
      onPick={() => setPicking(true)}
      onSelected={(ids) => setPlan({ ...plan, selected: ids })}
    />
  )
}

function Workspace({
  project,
  plan,
  onPick,
  onSelected
}: {
  project: string
  plan: CreateState
  onPick: () => void
  onSelected: (ids: string[]) => void
}): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])

  useEffect(() => {
    window.api.loadChat(project).then((c) => {
      setMessages(c.messages)
      setBusy(c.busy)
    })
    const loadOutputs = (): void => void window.api.listOutputs(project).then(setOutputs)
    loadOutputs()
    return window.api.onChatEvent((e) => {
      if (e.project !== project) return
      if (e.kind === 'live') setLive(e.text)
      if (e.kind === 'message') {
        setMessages((m) => [...m, e.message])
        if (e.message.role === 'orchestrator') setLive('')
      }
      if (e.kind === 'busy') {
        setBusy(e.busy)
        if (!e.busy) {
          setLive('')
          loadOutputs() // a turn may have written files
        }
      }
      if (e.kind === 'error') setError(e.text)
    })
  }, [project])

  async function send(text: string): Promise<boolean> {
    setError('')
    try {
      await window.api.sendChat(project, text)
      return true
    } catch (e) {
      setError(reason(e))
      return false
    }
  }

  async function add(ids: string[]): Promise<void> {
    setError('')
    try {
      onSelected(await window.api.saveDeliverables(project, [...plan.selected, ...ids]))
    } catch (e) {
      setError(reason(e))
    }
  }

  const chosen = plan.musicians.filter((m) => plan.selected.includes(m.id))

  return (
    <div className="grid flex-1 gap-6 px-6 pt-8 pb-8 @5xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-6 border-b border-line pb-5">
          <div className="flex gap-3">
            <Icon name="chat-3-line" size={20} className="mt-1.5" />
            <div>
              <h2 className="type-heading-s">A direction, together</h2>
              <p className="mt-1 type-caption text-fg-2">
                Orchestrator ·{' '}
                {chosen.length ? chosen.map((m) => m.name).join(', ') : 'no deliverables yet'}
              </p>
            </div>
          </div>
          <button onClick={onPick} className="type-label-s text-link hover:underline">
            {chosen.length ? 'Change deliverables' : 'Pick deliverables'}
          </button>
        </div>

        <Conversation
          messages={messages}
          busy={busy}
          live={live}
          musicians={plan.musicians}
          selected={plan.selected}
          onAdd={add}
        />

        {error && (
          <p
            role="alert"
            className="mt-4 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
          >
            {error}
          </p>
        )}

        <Composer busy={busy} onSend={send} />
      </section>

      <aside className="flex min-w-0 flex-col gap-6">
        <Score plan={plan} busy={busy} outputs={outputs} onPick={onPick} />
        <Files project={project} outputs={outputs} />
      </aside>
    </div>
  )
}

function Conversation({
  messages,
  busy,
  live,
  musicians,
  selected,
  onAdd
}: {
  messages: ChatMessage[]
  busy: boolean
  live: string
  musicians: Musician[]
  selected: string[]
  onAdd: (ids: string[]) => Promise<void>
}): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, live, busy])
  const known = new Set(musicians.map((m) => m.id))

  return (
    <div className="flex flex-col gap-4 py-5" aria-live="polite">
      {messages.length === 0 && !busy && (
        <p className="py-4 type-body-m text-fg-2">
          Tell the Orchestrator what you want made, or just think out loud. It reads your concept
          and research, and it can suggest deliverables as the conversation goes.
        </p>
      )}
      {messages.map((m, i) => {
        if (m.role === 'note')
          return (
            <p
              key={i}
              className="flex items-center gap-3 type-caption text-fg-2 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line"
            >
              {m.text}
            </p>
          )
        if (m.role === 'user')
          return (
            <div key={i} className="bg-subtle px-4 py-3">
              <Byline who="You" t={m.t} />
              <p className="mt-2 type-body-m whitespace-pre-wrap">{m.text}</p>
            </div>
          )
        const { body, ids } = splitSuggestion(m.text, known)
        return (
          <div key={i} className="px-1">
            <Byline who="Orchestrator" t={m.t} accent />
            <Markdown text={body} className="mt-1 [&>*:first-child]:mt-1" />
            {ids.length > 0 && (
              <Suggestion
                items={musicians.filter((x) => ids.includes(x.id))}
                added={ids.every((id) => selected.includes(id))}
                onAdd={() => onAdd(ids)}
              />
            )}
          </div>
        )
      })}
      {busy && (
        <div className="px-1">
          <Byline who="Orchestrator" accent />
          {live ? (
            <Markdown
              text={splitSuggestion(live, known).body}
              className="mt-1 [&>*:first-child]:mt-1"
            />
          ) : (
            <p className="mt-2 type-body-s text-fg-2">Reading the project…</p>
          )}
        </div>
      )}
      <div ref={end} />
    </div>
  )
}

/** The Orchestrator's suggestion to add deliverables, as a card with one button. */
function Suggestion({
  items,
  added,
  onAdd
}: {
  items: Musician[]
  added: boolean
  onAdd: () => Promise<void>
}): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4 border border-brand bg-brand-subtle px-4 py-3">
      <div className="min-w-0">
        <p className="type-label-m">
          {added ? 'In your deliverables' : 'Add to your deliverables'}
        </p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 type-body-s">
          {items.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5">
              <Icon name={m.icon} className="text-link" />
              {m.name}
            </span>
          ))}
        </p>
      </div>
      {added ? (
        <span className="flex items-center gap-1.5 type-label-s text-fg-2">
          <Icon name="check-line" />
          Added
        </span>
      ) : (
        <button
          disabled={adding}
          onClick={async () => {
            setAdding(true)
            await onAdd()
            setAdding(false)
          }}
          className={solidButton}
        >
          {adding ? 'Adding…' : 'Add to deliverables'}
        </button>
      )}
    </div>
  )
}

function Byline({
  who,
  t,
  accent
}: {
  who: string
  t?: string
  accent?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`type-label-m ${accent ? 'text-link' : ''}`}>{who}</span>
      {t && <span className="type-caption text-fg-2">{time(t)}</span>}
    </div>
  )
}

function Composer({
  busy,
  onSend
}: {
  busy: boolean
  onSend: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [text, setText] = useState('')

  async function submit(): Promise<void> {
    if (busy || !text.trim()) return
    const sent = text
    setText('')
    if (!(await onSend(sent))) setText(sent) // keep what they wrote if it didn't go
  }

  function keys(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  return (
    <div className="sticky bottom-0 mt-auto bg-canvas pt-3 pb-1">
      <div className="border border-line-strong bg-canvas focus-within:border-focus">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={keys}
          rows={3}
          placeholder="Ask for a change, or give your agents a new direction…"
          aria-label="Message the Orchestrator"
          className="block w-full resize-none bg-transparent px-4 pt-3 type-body-m outline-none placeholder:text-fg-2"
        />
        <div className="flex items-center justify-between gap-4 px-4 pb-3">
          <span className="type-caption text-fg-2">
            {busy ? 'The Orchestrator is answering…' : 'Enter to send · Shift+Enter for a new line'}
          </span>
          <button
            onClick={() => void submit()}
            disabled={busy || !text.trim()}
            aria-label="Send"
            className="flex size-9 items-center justify-center bg-brand text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.95] disabled:bg-muted disabled:text-fg-disabled"
          >
            <Icon name="send-plane-2-fill" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- The score: agents (round nodes) and the work they make (square document nodes) ----

type Tone = 'ready' | 'working' | 'idle'
function Badge({ tone, children }: { tone: Tone; children: ReactNode }): React.JSX.Element {
  const look = {
    ready: 'bg-success-subtle text-success-fg',
    working: 'bg-brand-subtle text-link',
    idle: 'bg-muted text-fg-2'
  }[tone]
  return <span className={`shrink-0 px-2 py-0.5 type-label-s ${look}`}>{children}</span>
}

// Tree lines: each child gets an elbow from its parent's stem; the last child's stem stops at it.
const branch =
  'relative pl-6 before:absolute before:top-3.5 before:left-2 before:w-3 before:border-t before:border-line-strong after:absolute after:top-0 after:left-2 after:h-full after:border-l after:border-line-strong last:after:h-3.5'

/** An agent: a round marker. Orchestrator filled, Musicians ringed with their icon, Instruments small. */
function AgentNode({
  name,
  role,
  icon,
  status,
  children
}: {
  name: string
  role: 'Orchestrator' | 'Musician' | 'Instrument'
  icon?: string
  status?: ReactNode
  children?: ReactNode
}): React.JSX.Element {
  const marker =
    role === 'Orchestrator' ? (
      <span className="flex size-6 items-center justify-center rounded-full bg-brand text-on-brand">
        <Icon name="logo-mark" size={14} />
      </span>
    ) : role === 'Musician' ? (
      <span className="flex size-6 items-center justify-center rounded-full border-2 border-brand bg-canvas text-link">
        <Icon name={icon ?? 'shapes-line'} size={12} />
      </span>
    ) : (
      <span className="mx-1.5 size-3 rounded-full border-2 border-fg-2 bg-canvas" />
    )
  return (
    <>
      <div className="flex min-h-7 items-center gap-2.5">
        {marker}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className={`truncate ${role === 'Instrument' ? 'type-body-s' : 'type-label-m'}`}>
            {name}
          </span>
          {role !== 'Orchestrator' && (
            <span className="shrink-0 type-caption text-fg-2">{role}</span>
          )}
        </span>
        {status}
      </div>
      {children && <ul className="mt-1 ml-3 flex flex-col gap-1">{children}</ul>}
    </>
  )
}

/** A piece of work (a foundation file or a finished deliverable): a square document marker. */
function WorkNode({
  name,
  ready,
  hint
}: {
  name: string
  ready: boolean
  hint: string
}): React.JSX.Element {
  return (
    <div className="flex min-h-7 items-center gap-2.5" title={hint}>
      <span
        className={`flex size-5 items-center justify-center border ${ready ? 'border-success bg-success-subtle text-success-fg' : 'border-dashed border-line-strong bg-canvas text-fg-2'}`}
      >
        <Icon name={ready ? 'check-line' : 'file-text-line'} size={12} />
      </span>
      <span className={`min-w-0 flex-1 truncate type-body-s ${ready ? '' : 'text-fg-2'}`}>
        {name}
      </span>
      <span className={`shrink-0 type-caption ${ready ? 'text-success-fg' : 'text-fg-2'}`}>
        {ready ? 'Ready' : 'To make'}
      </span>
    </div>
  )
}

/** Work is named for what gets made, not who makes it: "prereqs/logo/" reads as "Logo". */
function workName(output: string, fallback: string): string {
  const file = /prereqs\/([\w-]+)/.exec(output)?.[1]
  if (!file) return fallback
  const words = file.replace(/-/g, ' ')
  return words[0].toUpperCase() + words.slice(1)
}

function Score({
  plan,
  busy,
  outputs,
  onPick
}: {
  plan: CreateState
  busy: boolean
  outputs: Output[]
  onPick: () => void
}): React.JSX.Element {
  const chosen = plan.musicians.filter((m) => plan.selected.includes(m.id))
  const foundations = useMemo(
    () => foundationOrder(plan.musicians, plan.instruments, plan.selected),
    [plan]
  )
  const names = new Map(plan.instruments.map((i) => [i.id, i.name]))
  // a foundation is ready once the first file its output names exists in the project
  const exists = new Set(outputs.map((o) => o.path))
  const ready = (output: string): boolean => {
    const file = /prereqs\/[\w./-]+/.exec(output)?.[0]
    return !!file && (exists.has(file) || outputs.some((o) => o.path.startsWith(file + '/')))
  }

  return (
    <section className="border border-line p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-heading-xs">Agents and work</h3>
        <span className="flex items-center gap-3 type-caption text-fg-2">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full border-2 border-brand" /> Agent
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 border border-dashed border-line-strong" /> Work
          </span>
        </span>
      </div>

      <div className="mt-4">
        <AgentNode
          name="Orchestrator"
          role="Orchestrator"
          status={<Badge tone={busy ? 'working' : 'ready'}>{busy ? 'Working' : 'Ready'}</Badge>}
        >
          {foundations.length > 0 && (
            <li className={branch}>
              <p className="flex min-h-7 items-center type-caption text-fg-2">
                Foundations · shared, built first
              </p>
              <ul className="ml-3 flex flex-col">
                {foundations.map((f) => (
                  <li key={f.id} className={branch}>
                    <WorkNode
                      name={workName(f.output, f.name)}
                      ready={ready(f.output)}
                      hint={`Made by the ${f.name} Instrument → ${f.output}`}
                    />
                  </li>
                ))}
              </ul>
            </li>
          )}
          {chosen.map((m) => (
            <li key={m.id} className={branch}>
              <AgentNode
                name={m.name}
                role="Musician"
                icon={m.icon}
                status={<Badge tone="idle">Not started</Badge>}
              >
                {m.instruments.map((i) => (
                  <li key={i} className={branch}>
                    <AgentNode name={names.get(i) ?? i} role="Instrument" />
                  </li>
                ))}
                {m.instruments.length === 0 && (
                  <li className={branch}>
                    <p className="flex min-h-7 items-center type-caption text-fg-2">
                      Proposes its Instruments on its first job
                    </p>
                  </li>
                )}
                <li className={branch}>
                  <WorkNode name={m.name} ready={false} hint={m.deliverable} />
                </li>
              </AgentNode>
            </li>
          ))}
          {chosen.length === 0 && (
            <li className={branch}>
              <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1">
                <span className="type-body-s text-fg-2">No deliverables yet.</span>
                <button onClick={onPick} className="type-label-s text-link hover:underline">
                  Pick deliverables
                </button>
              </div>
            </li>
          )}
        </AgentNode>
      </div>

      <p className="mt-5 border-t border-line pt-3 type-caption text-fg-2">
        Musicians start once briefing is connected, the next build step.
      </p>
    </section>
  )
}

const KIND: Record<string, string> = {
  md: 'Markdown',
  json: 'JSON',
  png: 'PNG',
  jpg: 'JPG',
  svg: 'SVG',
  pdf: 'PDF',
  glb: 'GLB'
}
const kb = (n: number): string =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`

function Files({ project, outputs }: { project: string; outputs: Output[] }): React.JSX.Element {
  const [error, setError] = useState('')
  return (
    <section className="border border-line p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="type-heading-xs">Created files</h3>
        <span className="type-caption text-fg-2">
          {outputs.length} file{outputs.length === 1 ? '' : 's'}
        </span>
      </div>
      {outputs.length === 0 ? (
        <p className="mt-3 type-body-s text-fg-2">
          Nothing yet. Files appear here as they’re written.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {outputs.map((o) => {
            const ext = o.path.split('.').pop()?.toLowerCase() ?? ''
            return (
              <li key={o.path}>
                <button
                  onClick={() =>
                    window.api.openOutput(project, o.path).catch((e) => setError(reason(e)))
                  }
                  title={o.path}
                  className="flex w-full items-start gap-3 py-2.5 text-left transition-colors duration-150 hover:bg-subtle"
                >
                  <Icon
                    name={
                      ['png', 'jpg', 'svg'].includes(ext)
                        ? 'image-line'
                        : ext === 'md'
                          ? 'file-text-line'
                          : 'file-line'
                    }
                    className="mt-0.5 text-fg-2"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-label-m">{o.path.split('/').pop()}</span>
                    <span className="mt-0.5 block type-caption text-fg-2">
                      {KIND[ext] ?? ext.toUpperCase()} · {kb(o.size)} · {time(o.modified)}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {error && <p className="mt-2 type-caption text-signal-fg">{error}</p>}
    </section>
  )
}
