import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { ChatMessage, CreateState, Output } from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { Deliverables } from './Deliverables'
import { Icon } from './Icon'
import { Markdown } from './Research'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** The Create phase: pick deliverables first, then work them through with the Orchestrator. */
export function Create({ project }: { project: string }): React.JSX.Element {
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    window.api.loadCreate(project).then(setPlan)
  }, [project])

  if (!plan) return <div className="flex-1" />
  if (picking || plan.selected.length === 0)
    return (
      <div className="flex flex-1 flex-col">
        {plan.selected.length > 0 && (
          <button
            onClick={() => setPicking(false)}
            className="flex items-center gap-2 self-start px-6 pt-5 type-label-m text-link hover:underline"
          >
            <Icon name="arrow-left-line" />
            Back to the conversation
          </button>
        )}
        <Deliverables
          project={project}
          onSaved={(ids) => {
            setPlan({ ...plan, selected: ids })
            if (ids.length) setPicking(false)
          }}
        />
      </div>
    )
  return <Workspace project={project} plan={plan} onChangeDeliverables={() => setPicking(true)} />
}

function Workspace({
  project,
  plan,
  onChangeDeliverables
}: {
  project: string
  plan: CreateState
  onChangeDeliverables: () => void
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
                Orchestrator · {chosen.map((m) => m.name).join(', ')}
              </p>
            </div>
          </div>
          <button onClick={onChangeDeliverables} className="type-label-s text-link hover:underline">
            Change deliverables
          </button>
        </div>

        <Conversation messages={messages} busy={busy} live={live} />

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
        <Agents plan={plan} chosenIds={plan.selected} busy={busy} outputs={outputs} />
        <Files project={project} outputs={outputs} />
      </aside>
    </div>
  )
}

function Conversation({
  messages,
  busy,
  live
}: {
  messages: ChatMessage[]
  busy: boolean
  live: string
}): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, live, busy])

  return (
    <div className="flex flex-col gap-4 py-5" aria-live="polite">
      {messages.length === 0 && !busy && (
        <p className="py-4 type-body-m text-fg-2">
          Tell the Orchestrator what you want made. It reads your concept, your research and the
          deliverables you picked, then plans the work with you.
        </p>
      )}
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="bg-subtle px-4 py-3">
            <Byline who="You" t={m.t} />
            <p className="mt-2 type-body-m whitespace-pre-wrap">{m.text}</p>
          </div>
        ) : (
          <div key={i} className="px-1">
            <Byline who="Orchestrator" t={m.t} accent />
            <Markdown text={m.text} className="mt-1 [&>*:first-child]:mt-1" />
          </div>
        )
      )}
      {busy && (
        <div className="px-1">
          <Byline who="Orchestrator" accent />
          {live ? (
            <Markdown text={live} className="mt-1 [&>*:first-child]:mt-1" />
          ) : (
            <p className="mt-2 type-body-s text-fg-2">Reading the project…</p>
          )}
        </div>
      )}
      <div ref={end} />
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

type Tone = 'ready' | 'working' | 'idle'
function Badge({ tone, children }: { tone: Tone; children: ReactNode }): React.JSX.Element {
  const look = {
    ready: 'bg-success-subtle text-success-fg',
    working: 'bg-brand-subtle text-link',
    idle: 'bg-muted text-fg-2'
  }[tone]
  return <span className={`shrink-0 px-2 py-0.5 type-label-s ${look}`}>{children}</span>
}

function Agents({
  plan,
  chosenIds,
  busy,
  outputs
}: {
  plan: CreateState
  chosenIds: string[]
  busy: boolean
  outputs: Output[]
}): React.JSX.Element {
  const chosen = plan.musicians.filter((m) => chosenIds.includes(m.id))
  const foundations = useMemo(
    () => foundationOrder(plan.musicians, plan.instruments, chosenIds),
    [plan, chosenIds]
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
      <h3 className="type-heading-xs">Agents</h3>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="type-label-m">Orchestrator</span>
        <Badge tone={busy ? 'working' : 'ready'}>{busy ? 'Working' : 'Ready'}</Badge>
      </div>

      {foundations.length > 0 && (
        <>
          <p className="mt-5 type-caption text-fg-2">Foundations, built first</p>
          <ul className="mt-2 flex flex-col divide-y divide-line border-y border-line">
            {foundations.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate type-body-s">{f.name}</span>
                <Badge tone={ready(f.output) ? 'ready' : 'idle'}>
                  {ready(f.output) ? 'Ready' : 'Not started'}
                </Badge>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-5 type-caption text-fg-2">Musicians</p>
      <ul className="mt-2 flex flex-col gap-3">
        {chosen.map((m) => (
          <li key={m.id} className="border-l-2 border-line pl-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 type-label-m">
                <Icon name={m.icon} />
                {m.name}
              </span>
              <Badge tone="idle">Not started</Badge>
            </div>
            <p className="mt-1 type-caption text-fg-2">
              {m.instruments.length
                ? m.instruments.map((i) => names.get(i) ?? i).join(' · ')
                : 'Proposes its own Instruments on its first job'}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-5 border-t border-line pt-3 type-caption text-fg-2">
        Briefing Musicians is the next build step; for now the Orchestrator plans with you and can
        write files into the project.
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
