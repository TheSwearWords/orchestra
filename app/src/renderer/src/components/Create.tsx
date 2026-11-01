import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type {
  ChatInfo,
  ChatMessage,
  CreateState,
  LogEntry,
  Musician,
  Output,
  Project
} from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { splitSuggestion } from '../suggest'
import { Deliverables } from './Deliverables'
import { Icon } from './Icon'
import { Markdown } from './Research'

// Electron prefixes IPC errors with the channel name; show only the reason
const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const time = (iso: string): string =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const solidButton =
  'h-9 shrink-0 bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'
const outlineButton =
  'flex h-9 shrink-0 items-center gap-2 border border-line-strong bg-canvas px-4 type-label-m transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.97]'

/** The Create phase. A project has several chats with the Orchestrator: General, plus one per
 * chosen deliverable. With no chat open, it shows them all to choose from. */
export function Create({
  project,
  info,
  onInfoSaved,
  chat,
  onChat,
  onChatsChanged
}: {
  project: string
  info: Project // name, client, concept: shown and edited at the top of the overview
  onInfoSaved: () => void
  chat: string | null // null: the overview of all chats
  onChat: (chat: string | null) => void
  onChatsChanged: () => void // deliverables changed, so the sidebar's chat list did too
}): React.JSX.Element {
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    window.api.loadCreate(project).then(setPlan)
  }, [project])

  if (!plan) return <div className="flex-1" />
  const pickerFirst = picking || (chat === null && plan.selected.length === 0 && !seenOverview)
  if (pickerFirst)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <button
          onClick={() => {
            setPicking(false)
            seenOverview = true
          }}
          className="flex items-center gap-2 self-start px-6 pt-5 type-label-m text-link hover:underline"
        >
          <Icon name="arrow-left-line" />
          {plan.selected.length ? 'Back to the chats' : 'Skip: just talk to the Orchestrator'}
        </button>
        <Deliverables
          project={project}
          continueLabel="Continue"
          onSaved={(ids) => {
            setPlan({ ...plan, selected: ids })
            setPicking(false)
            seenOverview = true
            onChat(null)
            onChatsChanged()
          }}
        />
      </div>
    )
  if (chat === null)
    return (
      <Overview
        project={project}
        info={info}
        onInfoSaved={onInfoSaved}
        plan={plan}
        onOpen={onChat}
        onPick={() => setPicking(true)}
      />
    )
  return (
    <ChatView
      key={chat}
      project={project}
      chat={chat}
      plan={plan}
      onBack={() => onChat(null)}
      onSelected={(ids) => {
        setPlan({ ...plan, selected: ids })
        onChatsChanged()
      }}
    />
  )
}
// Picking deliverables comes first for a new project, once; "skip" goes straight to the chats.
let seenOverview = false

/** "What do you want to work on first?": the project's chats under the Orchestrator. */
function Overview({
  project,
  info,
  onInfoSaved,
  plan,
  onOpen,
  onPick
}: {
  project: string
  info: Project
  onInfoSaved: () => void
  plan: CreateState
  onOpen: (chat: string) => void
  onPick: () => void
}): React.JSX.Element {
  const [chats, setChats] = useState<ChatInfo[] | null>(null)
  useEffect(() => {
    const load = (): void => void window.api.listChats(project).then(setChats)
    load()
    return window.api.onChatEvent((e) => {
      if (e.project === project && (e.kind === 'busy' || e.kind === 'message')) load()
    })
  }, [project, plan.selected])

  return (
    <div className="stagger min-h-0 flex-1 overflow-y-auto px-6 pt-8 pb-12">
      <ProjectInfo project={info} onSaved={onInfoSaved} />
      <div className="mt-8 flex items-end justify-between gap-6 border-t border-line pt-6">
        <div>
          <h2 className="type-heading-xs">What do you want to work on first?</h2>
          <p className="mt-1 type-caption text-fg-2">
            Each deliverable has its own chat with the Orchestrator. General is for the whole
            project.
          </p>
        </div>
        <button onClick={onPick} className={outlineButton}>
          <Icon name="add-line" />
          {plan.selected.length ? 'Change deliverables' : 'Pick deliverables'}
        </button>
      </div>

      <div className="mt-8 flex items-center gap-2.5">
        <Avatar />
        <span className="type-label-m">Orchestrator</span>
      </div>
      <ul className="mt-2 ml-3 grid gap-3 border-l border-line-strong py-2 pl-6 @3xl:grid-cols-2">
        {(chats ?? []).map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onOpen(c.id)}
              className="flex h-full w-full flex-col border border-line bg-canvas p-4 text-left transition-[background-color,scale] duration-150 hover:bg-subtle active:scale-[0.99]"
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="flex items-center gap-2 type-label-l">
                  <Icon name={c.icon} size={18} className={c.deliverable ? 'text-link' : ''} />
                  {c.title}
                </span>
                {c.busy ? (
                  <Badge tone="working">Working</Badge>
                ) : (
                  <span className="type-caption text-fg-2">
                    {c.count ? `${c.count} message${c.count === 1 ? '' : 's'}` : 'Not started'}
                  </span>
                )}
              </span>
              <span className="mt-2 line-clamp-2 type-body-s text-fg-2">
                {c.last
                  ? `${c.last.role === 'user' ? 'You: ' : ''}${c.last.text.replace(/\s+/g, ' ')}`
                  : c.deliverable
                    ? (plan.musicians.find((m) => m.id === c.id)?.deliverable ?? '')
                    : 'The whole project: the plan, and adding deliverables.'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The project's name and description, with a settings button that edits them in place. */
function ProjectInfo({
  project,
  onSaved
}: {
  project: Project
  onSaved: () => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field =
    'w-full border border-line bg-canvas px-3 type-body-s outline-none placeholder:text-fg-2 focus:border-focus'

  async function save(): Promise<void> {
    setSaving(true)
    setError('')
    try {
      await window.api.editProject(project.id, {
        name: draft.name,
        client: draft.client,
        concept: draft.concept
      })
      onSaved()
      setEditing(false)
    } catch (e) {
      setError(reason(e))
    }
    setSaving(false)
  }

  const description = [project.client, project.concept.split('\n')[0]].filter(Boolean).join(' · ')
  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="truncate type-heading-m">{project.name}</h1>
          <p className="mt-1 type-body-s text-fg-2">{description || 'No client or concept yet.'}</p>
        </div>
        <button
          onClick={() => {
            setDraft(project)
            setEditing(!editing)
          }}
          aria-expanded={editing}
          aria-label="Project settings"
          title="Edit the name, client and concept"
          className={`flex size-9 shrink-0 items-center justify-center border transition-[background-color,color,scale] duration-150 active:scale-[0.95] ${editing ? 'border-line-strong bg-muted text-fg' : 'border-line text-fg-2 hover:bg-muted hover:text-fg'}`}
        >
          <Icon name="settings-3-line" />
        </button>
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="stagger mt-4 grid max-w-2xl gap-3 border border-line bg-subtle p-4"
        >
          <label className="grid gap-1.5 type-label-s">
            Name
            <input
              autoFocus
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={`h-9 ${field}`}
            />
          </label>
          <label className="grid gap-1.5 type-label-s">
            Client
            <input
              value={draft.client}
              onChange={(e) => setDraft({ ...draft, client: e.target.value })}
              placeholder="Optional"
              className={`h-9 ${field}`}
            />
          </label>
          <label className="grid gap-1.5 type-label-s">
            Concept
            <textarea
              value={draft.concept}
              onChange={(e) => setDraft({ ...draft, concept: e.target.value })}
              rows={3}
              placeholder="What is this project trying to say?"
              className={`resize-y py-2 ${field}`}
            />
          </label>
          {error && <p className="type-caption text-signal-fg">{error}</p>}
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving || !draft.name.trim()} className={solidButton}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="type-label-m text-fg-2 hover:text-fg"
            >
              Cancel
            </button>
            <span className="type-caption text-fg-2">
              Saved to concept.md. The folder name stays.
            </span>
          </div>
        </form>
      )}
    </div>
  )
}

function ChatView({
  project,
  chat,
  plan,
  onBack,
  onSelected
}: {
  project: string
  chat: string
  plan: CreateState
  onBack: () => void
  onSelected: (ids: string[]) => void
}): React.JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [channel, setChannel] = useState(false) // the agent channel instead of the conversation

  useEffect(() => {
    window.api.loadChat(project, chat).then((c) => {
      setMessages(c.messages)
      setLog(c.log)
      setBusy(c.busy)
    })
    const loadOutputs = (): void => void window.api.listOutputs(project).then(setOutputs)
    loadOutputs()
    return window.api.onChatEvent((e) => {
      if (e.project !== project || e.chat !== chat) return
      if (e.kind === 'live') setLive(e.text)
      if (e.kind === 'log') setLog((l) => [...l, e.entry])
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
  }, [project, chat])

  async function send(text: string): Promise<boolean> {
    setError('')
    try {
      await window.api.sendChat(project, chat, text)
      return true
    } catch (e) {
      setError(reason(e))
      return false
    }
  }
  const stop = (): void => void window.api.stopChat(project, chat).catch((e) => setError(reason(e)))

  async function add(ids: string[]): Promise<void> {
    setError('')
    try {
      onSelected(await window.api.saveDeliverables(project, [...plan.selected, ...ids]))
    } catch (e) {
      setError(reason(e))
    }
  }

  const focus = plan.musicians.find((m) => m.id === chat)
  const title = focus?.name ?? 'General'

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-6 px-6 pt-6 @5xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-0 min-w-0 flex-col">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 self-start type-label-s text-link hover:underline"
        >
          <Icon name="arrow-left-line" size={14} />
          All chats
        </button>
        <div className="mt-3 flex items-start justify-between gap-6 border-b border-line pb-5">
          <div className="flex gap-3">
            <Icon
              name={focus?.icon ?? 'chat-3-line'}
              size={20}
              className={`mt-1.5 ${focus ? 'text-link' : ''}`}
            />
            <div>
              <h2 className="type-heading-s">{title}</h2>
              <p className="mt-1 type-caption text-fg-2">
                {focus ? focus.deliverable : 'The whole project, with the Orchestrator'}
              </p>
            </div>
          </div>
          <div role="radiogroup" aria-label="View" className="flex shrink-0 border border-line">
            {(
              [
                [false, 'Conversation', 'chat-3-line'],
                [true, 'Agent channel', 'terminal-box-line']
              ] as const
            ).map(([on, label, icon]) => (
              <button
                key={label}
                role="radio"
                aria-checked={channel === on}
                onClick={() => setChannel(on)}
                className={`flex h-8 items-center gap-1.5 px-3 transition-colors duration-150 ${channel === on ? 'bg-muted type-current-s' : 'type-label-s text-fg-2 hover:text-fg'}`}
              >
                <Icon name={icon} size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {channel ? (
          <AgentChannel log={log} busy={busy} onStop={stop} />
        ) : (
          <>
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
            <Composer busy={busy} onSend={send} onStop={stop} />
          </>
        )}
      </section>

      {/* left out in half a split pane, where the conversation needs the room */}
      <aside className="hidden min-h-0 min-w-0 flex-col gap-6 overflow-y-auto pb-6 @5xl:flex">
        <Score plan={plan} focus={focus?.id} busy={busy} outputs={outputs} />
        <Files project={project} outputs={outputs} />
      </aside>
    </div>
  )
}

/** The Orchestrator's mark, so its messages read as a person in the chat. */
function Avatar({ size = 'md' }: { size?: 'sm' | 'md' }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand text-on-brand ${size === 'sm' ? 'size-5' : 'size-7'}`}
    >
      <Icon name="logo-mark" size={size === 'sm' ? 12 : 16} />
    </span>
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
    <div
      className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-6 pr-2"
      aria-live="polite"
    >
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
            <div key={i} className="flex flex-col items-end">
              <p className="max-w-[80%] bg-subtle px-4 py-3 type-body-m whitespace-pre-wrap">
                {m.text}
              </p>
              <span className="mt-1 type-caption text-fg-2">{time(m.t)}</span>
            </div>
          )
        const { body, ids } = splitSuggestion(m.text, known)
        return (
          <OrchestratorSays key={i} t={m.t}>
            <Markdown text={body} className="[&>*:first-child]:mt-1" />
            {ids.length > 0 && (
              <Suggestion
                items={musicians.filter((x) => ids.includes(x.id))}
                added={ids.every((id) => selected.includes(id))}
                onAdd={() => onAdd(ids)}
              />
            )}
          </OrchestratorSays>
        )
      })}
      {busy && (
        <OrchestratorSays>
          {live ? (
            <Markdown text={splitSuggestion(live, known).body} className="[&>*:first-child]:mt-1" />
          ) : (
            <p className="mt-1 type-body-s text-fg-2">Reading the project…</p>
          )}
        </OrchestratorSays>
      )}
      <div ref={end} />
    </div>
  )
}

/** The Orchestrator's turn: its mark on the left, the text flowing beside it, no bubble. */
function OrchestratorSays({ t, children }: { t?: string; children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex gap-3 pr-[10%]">
      <Avatar />
      <div className="min-w-0 flex-1">
        <div className="flex h-7 items-center gap-2">
          <span className="type-label-m">Orchestrator</span>
          {t && <span className="type-caption text-fg-2">{time(t)}</span>}
        </div>
        {children}
      </div>
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
          Added, each with its own chat
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

function Composer({
  busy,
  onSend,
  onStop
}: {
  busy: boolean
  onSend: (text: string) => Promise<boolean>
  onStop: () => void
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
    <div className="shrink-0 bg-canvas pt-3 pb-6">
      <div className="border border-fg-2/45 bg-canvas transition-colors duration-150 focus-within:border-fg-2">
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
            {busy ? 'Working… stop it at any time' : 'Enter to send · Shift+Enter for a new line'}
          </span>
          {busy ? (
            <button
              onClick={onStop}
              aria-label="Stop"
              title="Stop what the agents are doing"
              className="flex size-9 items-center justify-center bg-fg text-canvas transition-[background-color,scale] duration-150 hover:bg-fg-2 active:scale-[0.95]"
            >
              <Icon name="stop-fill" />
            </button>
          ) : (
            <button
              onClick={() => void submit()}
              disabled={!text.trim()}
              aria-label="Send"
              className="flex size-9 items-center justify-center bg-brand text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.95] disabled:bg-muted disabled:text-fg-disabled"
            >
              <Icon name="send-plane-2-fill" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Read-only oversight: every agent's actions and words in this chat, terminal-style. */
function AgentChannel({
  log,
  busy,
  onStop
}: {
  log: LogEntry[]
  busy: boolean
  onStop: () => void
}): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' })
  }, [log.length])

  return (
    <div className="mt-6 mb-6 flex min-h-0 flex-1 flex-col bg-brand text-on-brand">
      <div className="flex items-center justify-between gap-4 border-b border-on-brand/15 px-4 py-2.5">
        <span className="type-log-s text-on-brand/60">agent channel · read-only</span>
        {busy ? (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 border border-on-brand px-2.5 py-1 type-log-s text-on-brand transition-colors duration-150 hover:bg-on-brand hover:text-brand"
          >
            <Icon name="stop-fill" size={12} />
            Stop all agents
          </button>
        ) : (
          <span className="type-log-s text-on-brand/60">idle</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3" role="log" aria-label="Agent channel">
        {log.length === 0 && (
          <p className="type-log-s text-on-brand/60">
            Nothing yet. Every agent action in this chat shows up here: what the Orchestrator reads
            and writes now, and the Musicians&rsquo; messages to each other once they run.
          </p>
        )}
        {log.map((e, i) =>
          e.kind === 'turn' ? (
            <p key={i} className="my-1.5 type-log-s text-on-brand/45">
              ── {e.text} · {time(e.t)}
            </p>
          ) : (
            <p key={i} className="flex gap-2.5 type-log-s">
              <span className="w-16 shrink-0 whitespace-nowrap text-on-brand/45">{time(e.t)}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="flex size-4 items-center justify-center rounded-full bg-on-brand text-brand">
                  <Icon name="logo-mark" size={10} />
                </span>
                <span className="text-on-brand/80">
                  {e.agent === 'orchestrator' ? 'orchestrator' : e.agent}
                </span>
              </span>
              <span
                className={`min-w-0 ${e.kind === 'say' ? 'line-clamp-3 text-on-brand/70' : 'text-on-brand'}`}
              >
                {e.kind === 'say' ? `“${e.text}”` : e.text}
              </span>
            </p>
          )
        )}
        <div ref={end} />
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
      <Avatar size="sm" />
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
  focus,
  busy,
  outputs
}: {
  plan: CreateState
  focus?: string // a deliverable's chat shows only that deliverable's part of the tree
  busy: boolean
  outputs: Output[]
}): React.JSX.Element {
  const ids = focus ? [focus] : plan.selected
  const chosen = plan.musicians.filter((m) => ids.includes(m.id))
  const foundations = foundationOrder(plan.musicians, plan.instruments, ids) // a few dozen items
  const names = new Map(plan.instruments.map((i) => [i.id, i.name]))
  // a foundation is ready once the first file its output names exists in the project
  const exists = new Set(outputs.map((o) => o.path))
  const ready = (output: string): boolean => {
    const file = /prereqs\/[\w./-]+/.exec(output)?.[0]
    return !!file && (exists.has(file) || outputs.some((o) => o.path.startsWith(file + '/')))
  }

  return (
    <section className="border border-line bg-canvas p-5">
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
              <p className="flex min-h-7 items-center type-body-s text-fg-2">
                No deliverables yet.
              </p>
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
    <section className="border border-line bg-canvas p-5">
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
