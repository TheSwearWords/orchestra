import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type {
  AgentState,
  ChatInfo,
  ChatMessage,
  CreateState,
  LogEntry,
  Musician,
  Ask,
  Output,
  Proposal
} from '../../../preload'
import { foundationOrder } from '../../../main/plan'
import { Board, type CardSpec } from '../canvas/Board'
import { Wire } from '../canvas/Wire'
import type { Frame } from '../canvas/Book'
import { GENERAL, STUDIO, pendingFocus } from '../canvas/shared'
import {
  PODIUM,
  PREREQS,
  SEAT,
  WINDOWS_Y,
  WINDOW_W,
  filesFor,
  outputPaths,
  ring,
  seatRow,
  windowX
} from '../canvas/stage'
import { splitDecision, type Decision } from '../decide'
import { splitSuggestion } from '../suggest'
import { splitGoTo, type Place } from '../goto'
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

/** II · Create, one artboard. First you choose: every deliverable sits in one row, chosen ones
 * turn blue and wire down to the Deliverables circle and up to the foundations they need on
 * the Prerequisites ring. Hovering the circle with something chosen makes it Confirm. Once
 * confirmed, each chosen deliverable opens its own window in a row under the circle: its
 * chat, agents and files. Before that, nothing opens. */
export function Create({ project, frame }: { project: string; frame: Frame }): React.JSX.Element {
  const [plan, setPlan] = useState<CreateState | null>(null)
  const [chats, setChats] = useState<ChatInfo[]>([])
  const [outputs, setOutputs] = useState<Output[]>([])
  const [agents, setAgents] = useState<Record<string, AgentState>>({})
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})
  const [asks, setAsks] = useState<Record<string, Ask>>({})
  const [general, setGeneral] = useState<ChatMessage[]>([]) // the Orchestrator's chat
  const [error, setError] = useState('')
  const [hover, setHover] = useState<string | null>(null) // a foundation pointed at
  // shortcut: confirmed is per viewer (localStorage); move it into deliverables.md if it
  // should follow the project to other machines
  const [confirmed, setConfirmed] = useState(() => remembered(`confirmed:${project}`).length > 0)
  // a card to bring into view: one just opened, or one the Needs you list points at
  const [focus, setFocus] = useState<string | undefined>(() => takeFocus(project))
  useEffect(() => {
    const look = (): void => {
      const card = takeFocus(project)
      if (card) setFocus(card)
    }
    addEventListener('orchestra:focus', look)
    return () => removeEventListener('orchestra:focus', look)
  }, [project])

  useEffect(() => {
    window.api.loadCreate(project).then(setPlan)
  }, [project])
  useEffect(() => {
    const load = (): void => {
      void window.api.listChats(project).then(setChats, () => {})
      void window.api.listOutputs(project).then(setOutputs, () => {})
      void window.api.agentStates(project).then(setAgents, () => {})
      void window.api.listProposals(project).then(setProposals, () => {})
      void window.api.listAsks(project).then(setAsks, () => {})
    }
    load()
    void window.api.loadChat(project, GENERAL).then(
      (c) => setGeneral(c.messages),
      () => {}
    )
    return window.api.onChatEvent((e) => {
      if (e.project !== project) return
      if (e.chat === GENERAL && e.kind === 'message') setGeneral((m) => [...m, e.message])
      if (e.kind !== 'live' && e.kind !== 'log') load()
    })
  }, [project, plan?.selected])

  if (!plan) return <div className="bg-dots h-full" />

  function confirm(on: boolean): void {
    setConfirmed(on)
    remember(`confirmed:${project}`, on ? ['1'] : [])
    if (!on) return
    setFocus('orchestrator')
    // the Orchestrator takes it from here: it asks which deliverable to start with
    const names = plan!.selected.map((id) => musician(id)?.name ?? id).join(', ')
    void window.api
      .sendChat(
        project,
        GENERAL,
        `I have confirmed my deliverables: ${names}. Walk me through making them.`
      )
      .catch((e) => setError(reason(e)))
  }
  async function choose(ids: string[]): Promise<void> {
    setError('')
    try {
      const saved = await window.api.saveDeliverables(project, ids)
      setPlan({ ...plan!, selected: saved })
      if (!saved.length) confirm(false) // nothing left to have confirmed
    } catch (e) {
      setError(reason(e))
    }
  }
  async function seatMenu(id: string): Promise<void> {
    const chosen = plan!.selected.includes(id)
    const c = await window.api.menu([
      { id: 'toggle', label: chosen ? 'Take off the stage' : 'Choose' }
    ])
    if (c !== 'toggle') return
    if (!chosen) return void choose([...plan!.selected, id])
    const started = chats.find((x) => x.id === id)?.count
    if (
      started &&
      !window.confirm('Its chat and files stay in the project. Take it off the stage?')
    )
      return
    void choose(plan!.selected.filter((s) => s !== id))
  }
  /** A seat click: before confirming it chooses or unchooses; after, it shows the window. */
  function seat(id: string): void {
    const chosen = plan!.selected.includes(id)
    if (confirmed && chosen) return setFocus(`chat-${id}`)
    void choose(chosen ? plan!.selected.filter((s) => s !== id) : [...plan!.selected, id])
  }

  const seats = seatRow(plan.musicians)
  const at = new Map(seats.map((s) => [s.id, s]))
  const musician = (id: string): Musician | undefined => plan.musicians.find((m) => m.id === id)
  const chosen = plan.selected.filter((id) => at.has(id))
  const foundations = plan.instruments.filter((i) =>
    plan.musicians.some((m) => m.prerequisites.includes(i.id))
  )
  const lit = new Set(foundationOrder(plan.musicians, plan.instruments, chosen).map((i) => i.id))
  const spots = ring(foundations.length, PREREQS.x, PREREQS.y, PREREQS.ring)
  const spot = new Map(foundations.map((f, i) => [f.id, spots[i]]))
  const exists = (output: string): boolean =>
    outputPaths(output).some((p) => outputs.some((o) => o.path === p || o.path.startsWith(p)))
  const making = (id: string): boolean =>
    Object.entries(agents).some(([k, a]) => k.endsWith(`--${id}`) && a.status === 'working')

  // every chosen seat wires down to the circle and up to each foundation it needs
  const wires = chosen.flatMap((id) => {
    const s = at.get(id)!
    const down = {
      key: `${id}-down`,
      x1: s.x,
      y1: s.y + SEAT.h / 2,
      x2: PODIUM.x,
      y2: PODIUM.y - PODIUM.r,
      on: true
    }
    const up = musician(id)!
      .prerequisites.filter((f) => spot.has(f))
      .map((f) => ({
        key: `${id}-${f}`,
        x1: s.x,
        y1: s.y - SEAT.h / 2,
        x2: spot.get(f)!.x,
        y2: spot.get(f)!.y,
        on: !hover || hover === f
      }))
    return [down, ...up]
  })

  const extent = {
    x: seats[0].x - SEAT.w,
    y: PREREQS.y - PREREQS.ring - 80,
    w: -seats[0].x * 2 + SEAT.w * 2,
    h: PODIUM.y + PODIUM.r - (PREREQS.y - PREREQS.ring) + 160
  }
  // what the windows must keep clear of
  const obstacles = [
    { x: seats[0].x - SEAT.w / 2, y: -SEAT.h / 2, w: -seats[0].x * 2 + SEAT.w, h: SEAT.h },
    { x: PODIUM.x - PODIUM.r, y: PODIUM.y - PODIUM.r, w: PODIUM.r * 2, h: PODIUM.r * 2 }
  ]
  const ready = chosen.length > 0

  const world = (
    <>
      <svg
        aria-hidden
        className="pointer-events-none absolute overflow-visible"
        style={{ left: 0, top: 0, width: 1, height: 1 }}
      >
        {wires.map((w) => (
          <Wire key={w.key} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} dim={!w.on} />
        ))}
      </svg>

      {/* the Prerequisites circle, ringed by every foundation; lit when a chosen seat needs it */}
      <div
        className="absolute flex flex-col items-center justify-center rounded-full border border-card-line bg-card text-center shadow-card"
        style={{
          left: PREREQS.x - PREREQS.r,
          top: PREREQS.y - PREREQS.r,
          width: PREREQS.r * 2,
          height: PREREQS.r * 2
        }}
      >
        <span className="type-label-serif-l text-link">Prerequisites</span>
        <span className="mt-1 px-4 type-caption text-dim">
          {lit.size ? `${lit.size} of ${foundations.length} needed` : 'Built once, shared'}
        </span>
      </div>
      {foundations.map((f, i) => {
        const on = lit.has(f.id)
        const state = !on ? '' : exists(f.output) ? 'Ready' : making(f.id) ? 'Making' : 'To make'
        return (
          <span
            key={f.id}
            onPointerEnter={() => on && setHover(f.id)}
            onPointerLeave={() => setHover(null)}
            title={`${f.job}\n→ ${f.output}`}
            className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full px-3 py-1.5 type-label-s whitespace-nowrap transition-colors duration-200 ${
              !on
                ? 'border border-dashed border-wire/40 bg-card text-placeholder'
                : state === 'Ready'
                  ? 'bg-success-subtle text-success-fg'
                  : 'border border-brand bg-card text-link shadow-float'
            }`}
            style={{ left: spots[i].x, top: spots[i].y }}
          >
            {f.name}
            {on && <span className="type-caption normal-case">{state}</span>}
          </span>
        )
      })}

      {seats.map((s) => {
        const style = {
          left: s.x - SEAT.w / 2,
          top: s.y - SEAT.h / 2,
          width: SEAT.w,
          height: SEAT.h
        }
        if (s.id === 'add')
          return (
            <button
              key="add"
              onClick={() =>
                document
                  .querySelector<HTMLInputElement>('input[aria-label^="Message the Orchestrator"]')
                  ?.focus()
              }
              title="Ask the Orchestrator for a deliverable the library doesn't have"
              className="absolute flex flex-col items-center justify-center gap-1 border border-dashed border-wire bg-card/70 px-4 text-center text-link"
              style={style}
            >
              <span className="font-mono text-xl text-link/40">+</span>
              <span className="serif-on type-heading-m">Add a seat</span>
              <span className="type-caption text-dim">Ask the Orchestrator for one</span>
            </button>
          )
        const m = musician(s.id)!
        const on = chosen.includes(m.id)
        const c = chats.find((x) => x.id === m.id)
        // an approval waiting in its chat
        const needsYou = Object.values(proposals).some(
          (p) => p.chat === m.id && p.status === 'pending'
        )
        const status = !on
          ? 'Choose'
          : !confirmed
            ? 'Chosen'
            : needsYou
              ? 'Needs you'
              : c?.busy
                ? 'Playing'
                : c?.count
                  ? 'Started'
                  : 'Not started'
        return (
          <button
            key={m.id}
            onClick={() => seat(m.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              void seatMenu(m.id)
            }}
            aria-pressed={on}
            title={
              on
                ? confirmed
                  ? `Show ${m.name}`
                  : `Unchoose ${m.name}`
                : `Choose ${m.name}: ${m.deliverable}`
            }
            className={`absolute flex flex-col items-center px-4 pt-5 pb-4 text-center transition-[background-color,color] duration-200 ease-(--ease) ${
              on
                ? 'bg-poster-dots shadow-card'
                : 'border border-card-line bg-card text-link shadow-card hover:bg-selected'
            }`}
            style={style}
          >
            {needsYou && confirmed && (
              <span className="absolute -top-3 right-4 bg-needs-you px-2 py-0.5 type-label-s text-on-needs-you">
                Needs you
              </span>
            )}
            <span
              className={`flex size-14 shrink-0 items-center justify-center rounded-full ${on ? 'bg-white text-link' : 'bg-brand text-on-brand'}`}
            >
              <Icon name={m.icon} size={26} />
            </span>
            <span className="mt-3 type-heading-m leading-none">{m.name}</span>
            <span className={`mt-1.5 type-label-s ${on ? 'text-poster-dim' : 'text-dim'}`}>
              {m.category}
            </span>
            <span
              className={`mt-2 rounded-full px-2.5 py-0.5 type-label-s ${
                !on ? 'border border-dashed border-wire' : 'bg-white text-link'
              }`}
            >
              {status}
            </span>
            <span
              className={`mt-2 line-clamp-2 type-caption ${on ? 'text-poster-dim' : 'text-dim'}`}
            >
              {on && confirmed && c?.last ? c.last.text.replace(/\s+/g, ' ') : m.deliverable}
            </span>
          </button>
        )
      })}

      {/* the Deliverables circle: the prompt, then Confirm once something is chosen */}
      <button
        onClick={() => ready && confirm(!confirmed)}
        disabled={!ready}
        title={
          !ready
            ? 'Choose the deliverables this project needs'
            : confirmed
              ? 'Change what is chosen'
              : 'Confirm these deliverables'
        }
        className={`group absolute flex flex-col items-center justify-center gap-1 rounded-full px-6 text-center shadow-card transition-colors duration-200 ease-(--ease) ${
          ready ? 'bg-poster-dots hover:bg-inverse' : 'border border-card-line bg-card text-link'
        }`}
        style={{
          left: PODIUM.x - PODIUM.r,
          top: PODIUM.y - PODIUM.r,
          width: PODIUM.r * 2,
          height: PODIUM.r * 2
        }}
      >
        <span className="type-heading-m">Deliverables</span>
        {/* at rest: what to do; on hover, the action */}
        <span
          className={`type-label-s ${ready ? 'text-poster-dim group-hover:hidden' : 'text-dim'}`}
        >
          {!ready
            ? 'Select your deliverables'
            : `${chosen.length} chosen${confirmed ? ' · confirmed' : ''}`}
        </span>
        {ready && (
          <span className="hidden type-label-serif-l group-hover:block">
            {confirmed ? 'Change selection' : 'Confirm'}
          </span>
        )}
      </button>
    </>
  )

  // once confirmed: the Orchestrator's window under the circle, every deliverable's window
  // below it, and beside it the Action box, where its choices appear when it needs one; all
  // wired to the Orchestrator, because it is the only one you talk to
  const pending = (chat: string): boolean =>
    Object.values(proposals).some((p) => p.chat === chat && p.status === 'pending')
  // what the Orchestrator is waiting on, all in the Action box: approvals, its latest
  // unanswered question, deliverables it suggests, and the choices it put there
  const approvals = Object.values(proposals).filter((p) => p.status === 'pending')
  const lastSaid = general
    .map((m, i) => ({ m, i }))
    .filter((x) => x.m.role === 'orchestrator')
    .at(-1)
  const answered = lastSaid && general.slice(lastSaid.i + 1).some((m) => m.role === 'user')
  const generalBusy = !!chats.find((c) => c.id === GENERAL)?.busy
  const parsed =
    lastSaid && !answered
      ? splitSuggestion(lastSaid.m.text, new Set(plan.musicians.map((m) => m.id)))
      : null
  const question = parsed ? splitDecision(parsed.body).decision : null
  const suggested = (parsed?.ids ?? []).filter((id) => !plan.selected.includes(id))
  // only open choices: once picked, a choice leaves the box
  const asked = Object.values(asks)
    .filter((a) => a.status === 'open')
    .sort((a, b) => a.t.localeCompare(b.t))
  const waiting = approvals.length + (question ? 1 : 0) + (suggested.length ? 1 : 0) + asked.length
  const cards: CardSpec[] = !confirmed
    ? []
    : [
        {
          id: 'orchestrator',
          title: 'Orchestrator',
          count: chats.find((c) => c.id === GENERAL)?.busy ? 'thinking' : undefined,
          x: -ORCH_W / 2,
          y: WINDOWS_Y,
          w: ORCH_W,
          tone: 'paper' as const,
          height: ORCH_CAP - 44, // under its 44px header
          needsYou: pending(GENERAL),
          body: (
            <ChatPanel
              project={project}
              chat={GENERAL}
              plan={plan}
              fill
              elsewhere
              onSelected={(ids) => {
                // a Musician approved in the chat is new to the library too, so reload it
                if (ids.every((x) => plan.musicians.some((m) => m.id === x)))
                  setPlan({ ...plan, selected: ids })
                else void window.api.loadCreate(project).then(setPlan)
              }}
            />
          )
        },
        {
          id: 'actions',
          title: 'Action',
          count: waiting ? `${waiting} waiting` : undefined,
          x: ORCH_W / 2 + 48,
          y: WINDOWS_Y,
          w: ASK_W,
          link: 'orchestrator',
          needsYou: waiting > 0,
          body: waiting ? (
            <div className="divide-y divide-hair">
              {approvals.map((p) => (
                <div key={p.id} className="p-5">
                  <Approval
                    p={p}
                    musicians={plan.musicians}
                    onDecide={async (yes) => {
                      setError('')
                      try {
                        await window.api.decideProposal(project, p.chat, p.id, yes)
                        if (yes && p.id.startsWith('musician:'))
                          setPlan(await window.api.loadCreate(project))
                      } catch (e) {
                        setError(reason(e))
                      }
                    }}
                  />
                </div>
              ))}
              {question && (
                <div className="p-5">
                  <DecisionCard
                    decision={question}
                    disabled={generalBusy}
                    onPick={(label) =>
                      window.api.sendChat(project, GENERAL, label).then(
                        () => true,
                        (e) => {
                          setError(reason(e))
                          return false
                        }
                      )
                    }
                  />
                </div>
              )}
              {suggested.length > 0 && (
                <div className="p-5">
                  <Suggestion
                    items={plan.musicians.filter((m) => suggested.includes(m.id))}
                    added={false}
                    onAdd={() => choose([...plan.selected, ...suggested])}
                  />
                </div>
              )}
              {asked.map((a) => (
                <AskWindow key={a.id} project={project} ask={a} onError={setError} />
              ))}
            </div>
          ) : (
            <p className="p-5 type-body-s text-dim">
              Nothing waiting on you. When the Orchestrator asks you something, it appears here.
            </p>
          )
        },
        ...chosen.map((id, i) => ({
          id: `chat-${id}`,
          title: musician(id)!.name,
          count: chats.find((c) => c.id === id)?.busy ? 'playing' : undefined,
          x: windowX(i, chosen.length),
          y: WINDOWS_Y + 960,
          w: WINDOW_W,
          link: 'orchestrator',
          needsYou: pending(id),
          body: <ChatPanel project={project} chat={id} plan={plan} view="work" />
        }))
      ]

  return (
    <Board
      project={project}
      board="create"
      label="II · Create"
      crumbs={frame.crumbs}
      pages={frame.pages}
      preview={frame.preview}
      world={world}
      worldRect={extent}
      obstacles={obstacles}
      focus={focus}
      top={
        error && (
          <p
            role="alert"
            className="border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
          >
            {error}
          </p>
        )
      }
      cards={cards}
    />
  )
}

// Per-viewer memory (whether the stage is confirmed); storage can be unavailable, so it is
// guarded.
function remembered(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}
function remember(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // the app works the same without it
  }
}

const NO_PLAN: CreateState = { musicians: [], instruments: [], selected: [] }
const ORCH_W = 640
// the Orchestrator's chat can run forever, so it alone scrolls: capped at 1920×3240's shape
const ORCH_CAP = Math.round((ORCH_W * 3240) / 1920)
const ASK_W = 432

/** One choice in the Action box: the question, its options (with swatches when they are
 * colours), and a line to refine them. Picking answers it and it leaves the box; either way
 * the Orchestrator hears back. */
function AskWindow({
  project,
  ask,
  onError
}: {
  project: string
  ask: Ask
  onError: (e: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  async function answer(value: string, final: boolean): Promise<void> {
    if (!value.trim()) return
    setSending(true)
    try {
      await window.api.answerAsk(project, ask.id, value, final)
      setText('')
    } catch (e) {
      onError(reason(e))
    }
    setSending(false)
  }
  return (
    <div className="p-5">
      <p className="type-label-mono text-link">{ask.title}</p>
      <p className="mt-1.5 type-body-m text-fg">{ask.question}</p>
      <div className="mt-4 flex flex-col gap-2">
        {ask.options.map((o) => (
          <button
            key={o.label}
            disabled={sending}
            onClick={() => void answer(o.label, true)}
            className="flex flex-col gap-2 border border-card-line px-3 py-2.5 text-left text-link transition-colors duration-150 hover:border-brand hover:bg-selected"
          >
            {o.colors && (
              <span className="flex h-10 w-full">
                {o.colors.map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} title={c} />
                ))}
              </span>
            )}
            <span className="type-label-m">{o.label}</span>
            {o.detail && <span className="type-caption text-dim">{o.detail}</span>}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void answer(text, false)
        }}
        className="mt-4"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
          placeholder="Not quite? Say what to change, then Enter"
          aria-label={`Refine ${ask.title}`}
          className="w-full border-0 border-b-2 border-brand bg-transparent py-1.5 type-body-s text-link outline-none placeholder:text-placeholder focus-visible:outline-none"
        />
      </form>
    </div>
  )
}

/** Where a question or approval used to sit in the chat: it's answered in the Action box. */
function ActionNote({ text, done }: { text: string; done: boolean }): React.JSX.Element {
  return (
    <p className="mt-3 flex items-center gap-2 type-caption text-dim">
      <span className={`size-2 rounded-full ${done ? 'border border-wire' : 'bg-needs-you'}`} />
      {done ? 'Answered in the Action box: ' : 'Waiting in the Action box: '}
      <span className="truncate text-link">{text}</span>
    </p>
  )
}

/** A card the Needs you list asked to show in this project, taken once. */
function takeFocus(project: string): string | undefined {
  const want = pendingFocus.current
  if (!want || want.project !== project) return undefined
  pendingFocus.current = null
  return want.card
}

/** One conversation with the Orchestrator, laid out as C7: the chat (or the agent channel),
 * then the agents' status and the files made, then the reply box. It is the card a seat opens
 * on the stage and the panel above the Orchestrator bar (which brings its own input, so
 * `composer` is off there). In the Studio there are no agents or files, only the chat. */
export function ChatPanel({
  project,
  chat,
  plan = NO_PLAN,
  composer = true,
  view = 'full',
  fill = false,
  elsewhere = false,
  projects = [],
  onGo,
  onSelected = () => {}
}: {
  project: string
  chat: string
  plan?: CreateState
  composer?: boolean
  // full: everything (a window on the board) · conversation: just the back-and-forth (the bar's
  // window) · agents: their status and what the Orchestrator says to them (beside the bar) ·
  // work: a deliverable's window, its agents and files, no talking (you talk to the Orchestrator)
  view?: 'full' | 'conversation' | 'agents' | 'work'
  fill?: boolean // fill a fixed-height window; the conversation scrolls inside it
  elsewhere?: boolean // its questions and approvals appear in the Action box instead
  projects?: { id: string; name: string }[] // for the cards a "Go to:" line makes
  onGo?: (place: Place) => void
  onSelected?: (ids: string[]) => void
}): React.JSX.Element {
  const studio = project === STUDIO
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [live, setLive] = useState('')
  const [error, setError] = useState('')
  const [outputs, setOutputs] = useState<Output[]>([])
  const [channel, setChannel] = useState(false) // the agent channel instead of the conversation
  const [agents, setAgents] = useState<Record<string, AgentState>>({})
  const [proposals, setProposals] = useState<Record<string, Proposal>>({})

  useEffect(() => {
    window.api.loadChat(project, chat).then((c) => {
      setMessages(c.messages)
      setLog(c.log)
      setBusy(c.busy)
    })
    const loadProposals = (): void =>
      void (studio || window.api.listProposals(project).then(setProposals))
    loadProposals()
    const loadOutputs = (): void =>
      void (studio || window.api.listOutputs(project).then(setOutputs))
    loadOutputs()
    const loadAgents = (): void => void (studio || window.api.agentStates(project).then(setAgents))
    loadAgents()
    return window.api.onChatEvent((e) => {
      if (e.project === project && e.kind === 'agents') {
        loadAgents()
        loadOutputs() // an agent may have written files
      }
      if (e.project !== project || e.chat !== chat) return
      if (e.kind === 'live') setLive(e.text)
      if (e.kind === 'log') setLog((l) => [...l, e.entry])
      if (e.kind === 'message') {
        setMessages((m) => [...m, e.message])
        if (e.message.role === 'orchestrator') setLive('')
        if (e.message.role !== 'orchestrator') loadProposals() // a new card, or a decision
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
  }, [project, chat, studio])

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

  async function decide(id: string, approve: boolean): Promise<void> {
    setError('')
    try {
      await window.api.decideProposal(project, chat, id, approve)
      // an approved Musician joins the deliverables, with its own chat
      if (approve && id.startsWith('musician:'))
        onSelected((await window.api.loadCreate(project)).selected)
    } catch (e) {
      setError(reason(e))
    }
  }

  const focus = plan.musicians.find((m) => m.id === chat)
  // Musicians and Instruments busy on this chat's behalf
  const working = Object.values(agents).filter(
    (a) => a.chat === chat && a.status === 'working'
  ).length
  const files = focus ? filesFor(focus, plan.instruments, outputs) : outputs

  const status = (
    <section className="px-5 py-3">
      <h3 className="type-label-mono text-link">Agent status</h3>
      <div className="mt-2">
        <Score plan={plan} focus={focus?.id} busy={busy} outputs={outputs} agents={agents} />
      </div>
    </section>
  )
  const made = (
    <section className="border-t border-hair">
      <h3 className="px-5 pt-3 type-label-mono text-link">Created files · {files.length}</h3>
      <Files project={project} outputs={files} />
    </section>
  )

  if (view === 'work')
    return (
      <div className="flex flex-col">
        {focus && (
          <p className="border-b border-hair px-5 py-3 type-caption text-fg-2">
            {focus.deliverable}
          </p>
        )}
        {status}
        {made}
      </div>
    )
  if (view === 'agents')
    return (
      <div className="flex h-full min-h-0 flex-col">
        {!studio && <div className="shrink-0 border-b border-hair">{status}</div>}
        <h3 className="shrink-0 px-5 pt-3 type-label-mono text-link">To its agents</h3>
        <div className="flex min-h-0 flex-1 flex-col px-5">
          <AgentChannel log={log} busy={busy || working > 0} onStop={stop} plan={plan} />
        </div>
      </div>
    )

  const only = view === 'conversation'
  const scrolls = only || fill
  return (
    <div className={`flex flex-col ${scrolls ? 'h-full min-h-0' : ''}`}>
      {!only && (
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-hair px-5 py-3">
          <p className="line-clamp-2 type-caption text-fg-2">
            {studio
              ? 'Every project, with the Orchestrator'
              : focus
                ? focus.deliverable
                : 'The whole project, with the Orchestrator'}
          </p>
          <div role="radiogroup" aria-label="View" className="flex shrink-0 border border-line">
            {(
              [
                [false, 'Conversation'],
                [true, 'Agent channel']
              ] as const
            ).map(([on, label]) => (
              <button
                key={label}
                role="radio"
                aria-checked={channel === on}
                onClick={() => setChannel(on)}
                className={`flex h-7 items-center px-2.5 transition-colors duration-150 ${channel === on ? 'bg-selected type-current-s text-link' : 'type-label-s text-fg-2 hover:text-link'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`flex flex-col px-5 ${scrolls ? 'min-h-0 flex-1' : 'min-h-[220px]'}`}>
        {channel && !only ? (
          <AgentChannel log={log} busy={busy || working > 0} onStop={stop} plan={plan} />
        ) : (
          <Conversation
            messages={messages}
            busy={busy}
            live={live}
            musicians={plan.musicians}
            selected={plan.selected}
            proposals={proposals}
            onAdd={add}
            onAnswer={send}
            onDecide={decide}
            scroll={scrolls}
            elsewhere={elsewhere}
            projects={projects}
            here={studio ? undefined : project}
            onGo={onGo}
          />
        )}
        {error && (
          <p
            role="alert"
            className="mb-3 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg"
          >
            {error}
          </p>
        )}
      </div>

      {composer && (
        <div className="shrink-0 border-t border-hair px-5">
          <Composer busy={busy} working={working} onSend={send} onStop={stop} />
        </div>
      )}
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
  proposals,
  onAdd,
  onAnswer,
  onDecide,
  scroll,
  projects,
  here,
  onGo,
  elsewhere = false
}: {
  messages: ChatMessage[]
  busy: boolean
  live: string
  musicians: Musician[]
  selected: string[]
  proposals: Record<string, Proposal>
  onAdd: (ids: string[]) => Promise<void>
  onAnswer: (text: string) => Promise<boolean>
  onDecide: (id: string, approve: boolean) => Promise<void>
  scroll: boolean // in the bar's fixed window; on the artboard the card grows instead
  projects: { id: string; name: string }[]
  here?: string
  onGo?: (place: Place) => void
  elsewhere?: boolean // the questions and approvals show in the Action box, not here
}): React.JSX.Element {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroll) end.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, live, busy, scroll])
  const known = new Set(musicians.map((m) => m.id))
  const projectIds = new Set(projects.map((p) => p.id))
  const nameOf = (id: string): string => projects.find((p) => p.id === id)?.name ?? id

  return (
    <div
      className={`flex flex-col gap-5 py-6 ${scroll ? 'min-h-0 flex-1 overflow-y-auto pr-2' : ''}`}
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
        if (m.role === 'proposal') {
          const p = m.ref ? proposals[m.ref] : undefined
          if (!p) return null
          return elsewhere ? (
            <ActionNote key={i} done={p.status !== 'pending'} text={m.text} />
          ) : (
            <Approval key={i} p={p} musicians={musicians} onDecide={(yes) => onDecide(p.id, yes)} />
          )
        }
        const went = splitGoTo(m.text, projectIds, here)
        const split = splitSuggestion(went.body, known)
        const { body, decision } = splitDecision(split.body)
        const ids = split.ids
        // answered by the next thing the user said, if anything
        const reply = messages.slice(i + 1).find((x) => x.role === 'user')
        return (
          <OrchestratorSays key={i} t={m.t}>
            <Markdown text={body} className="[&>*:first-child]:mt-1" />
            {went.places.map((p, j) => {
              const a =
                p.area &&
                { research: 'I Research', create: 'II Create', refine: 'III Refine' }[p.area]
              return (
                <button
                  key={j}
                  onClick={() => onGo?.(p)}
                  disabled={!onGo}
                  className="group mt-3 flex w-full items-center gap-3 border border-card-line bg-card px-3 py-2.5 text-left text-link shadow-card hover:bg-selected"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center bg-brand text-on-brand">
                    <Icon name="arrow-right-up-line" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-label-serif-l">
                      {p.project === here && a ? a : nameOf(p.project)}
                    </span>
                    <span className="type-caption text-dim">
                      {p.project === here
                        ? 'In this project'
                        : a
                          ? `Open at ${a}`
                          : 'Open the project'}
                    </span>
                  </span>
                </button>
              )
            })}
            {elsewhere && (decision || ids.length > 0) && (
              <ActionNote
                done={!!reply || (ids.length > 0 && ids.every((id) => selected.includes(id)))}
                text={decision ? decision.question : 'Suggested deliverables'}
              />
            )}
            {!elsewhere && decision && (
              <DecisionCard
                decision={decision}
                answer={reply?.text}
                disabled={busy}
                onPick={onAnswer}
              />
            )}
            {!elsewhere && ids.length > 0 && (
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
            <Markdown
              text={splitDecision(splitSuggestion(live, known).body).body}
              className="[&>*:first-child]:mt-1"
            />
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

/** A question the Orchestrator needs answered: one button per option. Picking one sends it as
 * your reply; typing an answer instead works too. Signal marks it while it waits on you. */
function DecisionCard({
  decision,
  answer,
  disabled,
  onPick
}: {
  decision: Decision
  answer?: string // what you replied next, once you have
  disabled: boolean
  onPick: (text: string) => Promise<boolean>
}): React.JSX.Element {
  const [sending, setSending] = useState('')
  const answered = answer !== undefined
  return (
    <div
      className={`mt-3 border-l-2 px-4 py-3 ${answered ? 'border-line-strong bg-subtle' : 'border-signal bg-signal-subtle'}`}
    >
      <p className="flex items-center gap-2 type-label-m">
        {!answered && <span className="type-caption text-signal-fg">Needs you</span>}
        {decision.question}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {decision.options.map((o) => {
          const chosen = answered && answer.trim().toLowerCase() === o.label.toLowerCase()
          if (answered)
            return (
              <span
                key={o.label}
                className={`flex h-9 items-center gap-1.5 border px-4 ${chosen ? 'border-fg type-current-s' : 'border-line type-label-m text-fg-disabled'}`}
              >
                {chosen && <Icon name="check-line" size={14} />}
                {o.label}
              </span>
            )
          return (
            <button
              key={o.label}
              disabled={disabled || !!sending}
              onClick={async () => {
                setSending(o.label)
                if (!(await onPick(o.label))) setSending('')
              }}
              className={o.recommended ? solidButton : outlineButton}
            >
              {sending === o.label ? 'Sending…' : o.label}
              {o.recommended && sending !== o.label && (
                <span className="ml-2 type-caption opacity-80">Recommended</span>
              )}
            </button>
          )
        })}
      </div>
      {answered &&
        !decision.options.some((o) => o.label.toLowerCase() === answer.trim().toLowerCase()) && (
          <p className="mt-2 type-caption text-fg-2">You answered in your own words.</p>
        )}
    </div>
  )
}

/** A new agent waiting for your approval: what it would own, how it runs, and its full
 * instructions behind a disclosure. Nothing is saved to the library until you approve. */
function Approval({
  p,
  musicians,
  onDecide
}: {
  p: Proposal
  musicians: Musician[]
  onDecide: (approve: boolean) => Promise<void>
}): React.JSX.Element {
  const [working, setWorking] = useState<'approve' | 'decline' | ''>('')
  const d = p.draft as Proposal['draft'] & Record<string, unknown>
  const isMusician = p.kind === 'musician'
  const by = isMusician
    ? 'the Orchestrator'
    : `the ${musicians.find((m) => m.id === p.from)?.name ?? p.from} Musician`
  const list = (k: string): string[] => (Array.isArray(d[k]) ? (d[k] as string[]) : [])
  const facts: [string, string][] = isMusician
    ? [
        ['Owns', String(d.deliverable ?? '')],
        ['Category', String(d.category ?? '')],
        ['Foundations', list('prerequisites').join(', ') || 'none'],
        ['Instruments', list('instruments').join(', ') || 'none yet: it proposes its own'],
        ['Model', String(d.model ?? 'sonnet')]
      ]
    : [
        ['Job', String(d.job ?? '')],
        ['Writes', String(d.output ?? '')],
        ['Needs', list('needs').join(', ') || 'nothing'],
        ['Model', String(d.model ?? 'haiku')]
      ]
  const pending = p.status === 'pending'

  async function decide(approve: boolean): Promise<void> {
    setWorking(approve ? 'approve' : 'decline')
    await onDecide(approve)
    setWorking('')
  }

  return (
    <div
      className={`border-l-2 py-3 pr-4 pl-4 ${pending ? 'border-signal bg-signal-subtle' : 'border-line-strong bg-subtle'}`}
    >
      <p className="type-caption text-fg-2">
        {pending && <span className="mr-2 text-signal-fg">Needs you</span>}
        New {isMusician ? 'Musician' : 'Instrument'}, proposed by {by}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <Icon
          name={isMusician ? String(d.icon || 'shapes-line') : 'box-3-line'}
          className="text-link"
        />
        <span className="type-heading-xs">{d.name}</span>
      </p>
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 type-body-s">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-2">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 group">
        <summary className="cursor-pointer type-label-s text-link hover:underline">
          Read its instructions
        </summary>
        <div className="mt-2 max-h-72 overflow-y-auto border border-line bg-canvas px-4 py-2">
          <Markdown text={String(d.prompt ?? '')} />
        </div>
      </details>
      <div className="mt-4 flex items-center gap-2">
        {pending ? (
          <>
            <button disabled={!!working} onClick={() => void decide(true)} className={solidButton}>
              {working === 'approve' ? 'Adding…' : `Approve and add to the library`}
            </button>
            <button
              disabled={!!working}
              onClick={() => void decide(false)}
              className={outlineButton}
            >
              {working === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 type-label-s text-fg-2">
            <Icon name={p.status === 'approved' ? 'check-line' : 'close-line'} />
            {p.status === 'approved' ? 'Approved: in the library' : 'Declined'}
          </span>
        )}
      </div>
    </div>
  )
}

function Composer({
  busy,
  working,
  onSend,
  onStop
}: {
  busy: boolean
  working: number // Musicians and Instruments busy for this chat; you can still type meanwhile
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
          <span className="flex items-center gap-2 type-caption text-fg-2">
            {busy
              ? 'Working… stop it at any time'
              : working
                ? `${working} agent${working === 1 ? '' : 's'} working for this chat`
                : 'Enter to send · Shift+Enter for a new line'}
            {!busy && working > 0 && (
              <button onClick={onStop} className="type-label-s text-link hover:underline">
                Stop all
              </button>
            )}
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
  onStop,
  plan
}: {
  log: LogEntry[]
  busy: boolean
  onStop: () => void
  plan: CreateState // to name and mark each speaker
}): React.JSX.Element {
  const speaker = (agent: string): { name: string; mark: ReactNode } => {
    if (agent === 'orchestrator')
      return {
        name: 'Orchestrator',
        mark: (
          <span className="flex size-4 items-center justify-center rounded-full bg-on-brand text-brand">
            <Icon name="logo-mark" size={10} />
          </span>
        )
      }
    const [m, i] = agent.split('--')
    const musician = plan.musicians.find((x) => x.id === m)
    if (!i)
      return {
        name: musician?.name ?? m,
        mark: (
          <span className="flex size-4 items-center justify-center rounded-full border border-on-brand">
            <Icon name={musician?.icon ?? 'shapes-line'} size={9} />
          </span>
        )
      }
    return {
      name: plan.instruments.find((x) => x.id === i)?.name ?? i,
      mark: <span className="mx-1 size-2 rounded-full border border-on-brand" />
    }
  }
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
            Nothing yet. Every agent action in this chat shows up here: what the Orchestrator, its
            Musicians and their Instruments read, write and say to each other.
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
              <span className="flex w-44 shrink-0 items-center gap-1.5">
                {speaker(e.agent).mark}
                <span className="truncate text-on-brand/80" title={e.agent.replace('--', ' › ')}>
                  {speaker(e.agent).name}
                </span>
              </span>
              <span
                className={`min-w-0 ${e.kind === 'say' ? 'line-clamp-3 text-on-brand/70' : e.kind === 'message' ? 'line-clamp-4 text-on-brand' : 'text-on-brand'}`}
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
  making = false,
  hint
}: {
  name: string
  ready: boolean
  making?: boolean // its Instrument is working on it now
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
      <span
        className={`shrink-0 type-caption ${ready ? 'text-success-fg' : making ? 'text-link' : 'text-fg-2'}`}
      >
        {ready ? 'Ready' : making ? 'Making…' : 'To make'}
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

/** A Musician's or Instrument's status as a badge (Musicians) or a short word (Instruments). */
const STATUS: Record<AgentState['status'], { label: string; tone: Tone }> = {
  working: { label: 'Working', tone: 'working' },
  waiting: { label: 'Waiting', tone: 'idle' },
  done: { label: 'Done', tone: 'ready' },
  stopped: { label: 'Stopped', tone: 'idle' },
  error: { label: 'Error', tone: 'idle' }
}

function Score({
  plan,
  focus,
  busy,
  outputs,
  agents
}: {
  plan: CreateState
  focus?: string // a deliverable's chat shows only that deliverable's part of the tree
  busy: boolean
  outputs: Output[]
  agents: Record<string, AgentState> // keyed "musician" or "musician--instrument"
}): React.JSX.Element {
  // a foundation is being made while any Musician's run of its Instrument is working
  const making = (instrument: string): boolean =>
    Object.entries(agents).some(([k, a]) => k.endsWith(`--${instrument}`) && a.status === 'working')
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
    <section>
      <div className="flex items-baseline justify-end gap-3">
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
                      making={making(f.id)}
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
                status={
                  agents[m.id] ? (
                    <Badge tone={STATUS[agents[m.id].status].tone}>
                      {STATUS[agents[m.id].status].label}
                    </Badge>
                  ) : (
                    <Badge tone="idle">Not started</Badge>
                  )
                }
              >
                {m.instruments.map((i) => (
                  <li key={i} className={branch}>
                    <AgentNode
                      name={names.get(i) ?? i}
                      role="Instrument"
                      status={
                        agents[`${m.id}--${i}`] && (
                          <span
                            className={`shrink-0 type-caption ${agents[`${m.id}--${i}`].status === 'working' ? 'text-link' : 'text-fg-2'}`}
                          >
                            {STATUS[agents[`${m.id}--${i}`].status].label}
                          </span>
                        )
                      }
                    />
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
                  <WorkNode
                    name={m.name}
                    ready={agents[m.id]?.status === 'done'}
                    making={agents[m.id]?.status === 'working'}
                    hint={m.deliverable}
                  />
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
    <section className="px-5 py-3">
      {outputs.length === 0 ? (
        <p className="py-2 type-body-s text-fg-2">
          Nothing yet. Files appear here as they’re written.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-hair">
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
