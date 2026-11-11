// The Orchestrator bar (brand spec §5.2, canvas spec §0.4): anchored to the window, bottom
// centre on every screen, the same width whether it is open or not.
// Who it talks to follows where you are: in the Studio, the Orchestrator above every project;
// inside a book, that project's. Clicking the field opens it up: the conversation grows out of
// the bar, your conversations line the left of the window, and the agents (their status, and
// what the Orchestrator tells them) the right. A click anywhere else puts it all away.
import { useEffect, useRef, useState } from 'react'
import type { CreateState, Thread, Usage } from '../../../preload'
import { ChatPanel } from '../components/Create'
import { Icon } from '../components/Icon'
import type { Place } from '../goto'
import { matchCommands, type Command } from './commands'
import { GENERAL, STUDIO, TOP_BAR, chip, typing } from './shared'

export interface BarTarget {
  project: string // a project id, or STUDIO
  label: string // "To …"
}

// What each mode lets the Orchestrator change, from your work to Orchestra itself
const MODES = [
  {
    id: 'work',
    name: 'Work',
    what: 'Brief agents, approve their work, get around the app.',
    ready: true
  },
  {
    id: 'customize',
    name: 'Customize',
    what: 'Change agents, boards and the look, as files. No code.',
    ready: false
  },
  {
    id: 'code',
    name: 'Code',
    what: "Change Orchestra's own code, on a safe branch you preview first.",
    ready: false
  }
] as const

const BAR_H = 58
const METER_H = 24 // the usage meter under the field
const STACK = BAR_H + METER_H
const CHAT_H = 'min(76vh, 840px)' // the opened conversation
const METERS = [
  ['five_hour', '5-hour'],
  ['seven_day', 'Weekly']
] as const
const SIDE_W = 288 // the agents panel beside the open bar
// a centred window with room around it, like Spotlight on a laptop
const OPEN_W = 'clamp(560px, 56vw, 1000px)'
const OPEN_INSET = `calc((100% - ${OPEN_W}) / 2)`
const LIST_W = 240 // the conversations inside it
const ROOM_FOR_LIST = '(min-width: 1360px)' // narrower than this, the list hides behind a menu

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const newThread = (): string => `t-${Date.now().toString(36)}`
const THINKING = { text: 'Thinking' }

// the last reading, so the meter isn't empty until the next reply
type Reading = { at: number; windows: Usage }
function savedUsage(): Reading | null {
  try {
    const r = JSON.parse(localStorage.getItem('usage-reading') ?? 'null') as Reading | null
    return r?.windows ? r : null
  } catch {
    return null
  }
}

export function OrchestratorBar({
  to,
  projects,
  onGo,
  commands,
  onCommand
}: {
  to: BarTarget
  projects: { id: string; name: string }[]
  onGo: (place: Place) => void
  commands: Command[] // what "/" offers here (App decides, by where you are)
  onCommand: (id: string) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false) // the mode menu
  const [agents, setAgents] = useState(false) // the Agents pop-out
  const [wide, setWide] = useState(() => matchMedia(ROOM_FOR_LIST).matches)
  const [listOpen, setListOpen] = useState(false) // the conversations, when they're behind the menu
  useEffect(() => {
    const room = matchMedia(ROOM_FOR_LIST)
    const change = (): void => setWide(room.matches)
    room.addEventListener('change', change)
    return () => room.removeEventListener('change', change)
  }, [])
  const [hi, setHi] = useState(0) // the highlighted slash command
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<{ agent?: string; text: string }>(THINKING)
  const [reading, setReading] = useState(savedUsage)
  const usage = reading?.windows
  // keeps the newest reading, from an agent here or from Claude Code's status line
  const take = useRef((r: Reading): void => {
    setReading((old) => {
      if (old && old.at >= r.at) return old
      try {
        localStorage.setItem('usage-reading', JSON.stringify(r))
      } catch {
        // only the reading after a restart is lost
      }
      return r
    })
  })
  const [, tick] = useState(0)
  useEffect(() => {
    const poll = (): void => {
      void window.api.readUsage().then((r) => r && take.current(r))
      tick((n) => n + 1) // a window that has reset drops to 0% without a new reading
    }
    poll()
    const timer = setInterval(poll, 30_000)
    return () => clearInterval(timer)
  }, [])
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<CreateState | undefined>(undefined)
  const [threads, setThreads] = useState<Thread[]>([])
  // the conversation shown, per place (General until you start or pick another)
  const [threadOf, setThreadOf] = useState<Record<string, string>>({})
  const chat = threadOf[to.project] ?? GENERAL
  const input = useRef<HTMLInputElement>(null)
  const here = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    const load = (): void => {
      window.api.listThreads(to.project).then(
        (t) => live && setThreads(t),
        () => {}
      )
    }
    load()
    window.api.loadChat(to.project, chat).then(
      (c) => {
        if (!live) return
        setBusy(c.busy)
        setStep(THINKING)
      },
      () => {}
    )
    if (to.project !== STUDIO)
      window.api.loadCreate(to.project).then(
        (p) => live && setPlan(p),
        () => {}
      )
    const off = window.api.onChatEvent((e) => {
      if (e.kind === 'usage') return take.current({ at: Date.now(), windows: e.usage })
      if (e.project !== to.project) return
      if (e.chat === chat && e.kind === 'busy') {
        setBusy(e.busy)
        if (e.busy) setStep(THINKING)
      }
      if (e.chat === chat && e.kind === 'live' && e.text) setStep({ text: 'Writing the reply' })
      if (e.chat === chat && e.kind === 'log' && e.entry.kind === 'tool')
        setStep({
          agent: e.entry.agent === 'orchestrator' ? undefined : e.entry.agent,
          text: e.entry.text
        })
      if (e.kind === 'message' || e.kind === 'busy') load()
    })
    return () => {
      live = false
      off()
    }
  }, [to.project, chat])

  // something on the board starts a message for you to finish
  useEffect(() => {
    const start = (e: Event): void => {
      setText((e as CustomEvent<string>).detail)
      input.current?.focus()
    }
    addEventListener('orchestra:ask', start)
    return () => removeEventListener('orchestra:ask', start)
  }, [])

  // "/" jumps to the bar; Esc closes it before the board hears; a click anywhere else puts it
  // away (the panels count as part of it)
  useEffect(() => {
    const keys = (e: KeyboardEvent): void => {
      // shortcut: fixed to ctrl+space; move it to Settings when hotkeys can be changed
      if (e.code === 'Space' && e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        if (open) {
          setOpen(false)
          input.current?.blur()
        } else {
          input.current?.focus()
          setOpen(true)
        }
        return
      }
      if (e.key === '/' && !typing(e)) {
        e.preventDefault()
        input.current?.focus()
      }
      if (e.key === 'Escape' && (open || picking || document.activeElement === input.current)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setPicking(false)
        setText((t) => (t.startsWith('/') ? '' : t)) // a half-typed command goes away
        input.current?.blur()
      }
    }
    const away = (e: PointerEvent): void => {
      if (!here.current?.contains(e.target as Node)) {
        setOpen(false)
        setPicking(false)
      }
    }
    addEventListener('keydown', keys, true)
    addEventListener('pointerdown', away, true)
    return () => {
      removeEventListener('keydown', keys, true)
      removeEventListener('pointerdown', away, true)
    }
  }, [open, picking])

  // "/" commands: the bar's own, then the ones for where you are
  const all: Command[] = [
    ...commands,
    { id: 'chat', label: 'New conversation', hint: 'Start a fresh one with the Orchestrator' }
  ]
  const matches = matchCommands(text, all)
  const shown = matches[Math.min(hi, matches.length - 1)]
  function run(c: Command): void {
    setText('')
    setHi(0)
    if (c.id === 'chat') {
      // the bar's own: a fresh conversation, open and ready
      pick(newThread())
      setOpen(true)
      return
    }
    setOpen(false)
    input.current?.blur()
    onCommand(c.id)
  }

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (shown) return run(shown)
    const sent = text.trim()
    if (!sent || busy) return
    setError('')
    setText('')
    setOpen(true)
    try {
      await window.api.sendChat(to.project, chat, sent)
    } catch (err) {
      setText(sent) // keep what they wrote if it didn't go
      setError(reason(err))
    }
  }
  const pick = (id: string): void => {
    setThreadOf((all) => ({ ...all, [to.project]: id }))
    input.current?.focus()
  }

  const mode = MODES[0]
  const current = threads.find((t) => t.id === chat)
  const side = `fixed z-30 flex flex-col border border-chip-line bg-card animate-[rise-in_240ms_var(--ease)_both]`
  const stepBy =
    step.agent &&
    [...(plan?.musicians ?? []), ...(plan?.instruments ?? [])].find(
      (a) => a.id === step.agent!.split('--').pop()
    )?.name
  const stepText = step.text.charAt(0).toUpperCase() + step.text.slice(1)
  const working = busy && (
    <p
      role="status"
      className="flex w-fit max-w-full items-center gap-2 bg-brand px-2.5 py-1 type-label-mono text-on-brand"
    >
      <span aria-hidden className="flex shrink-0 gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 bg-on-brand motion-safe:animate-[working_900ms_linear_infinite]"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
      <span className="shrink-0">Working</span>
      <span className="min-w-0 truncate">
        · {stepBy ? `${stepBy}: ` : ''}
        {stepText}
      </span>
    </p>
  )
  return (
    <div ref={here}>
      {open && (
        <>
          {/* the agents, popped out on request: how they stand, and what the Orchestrator says */}
          {agents && (
            <aside
              aria-label="Agents"
              className={side}
              style={{ top: TOP_BAR + 58, bottom: 14, right: 14, width: SIDE_W }}
            >
              <header className="flex h-11 shrink-0 items-center justify-between border-b border-hair px-4 text-link">
                <span className="type-label-serif-l">Agents</span>
                <button
                  onClick={() => setAgents(false)}
                  aria-label="Close the agents"
                  className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
                >
                  ✕
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {to.project === STUDIO ? (
                  <p className="p-4 type-body-s text-dim">
                    Agents work inside projects. Open one to see them here.
                  </p>
                ) : (
                  <ChatPanel
                    key={`agents-${to.project}/${chat}`}
                    project={to.project}
                    chat={chat}
                    plan={plan}
                    composer={false}
                    view="agents"
                  />
                )}
              </div>
            </aside>
          )}
        </>
      )}

      {/* the same width open or closed */}
      <div className="absolute bottom-3.5 z-30" style={{ left: OPEN_INSET, right: OPEN_INSET }}>
        {open && (
          // the bar, opened up: same frame, no shadow of its own
          <section
            aria-label={`Conversation ${to.label}`}
            className="absolute inset-x-0 flex origin-bottom flex-col border border-b-0 border-chip-line bg-card animate-[rise-in_240ms_var(--ease)_both]"
            style={{ bottom: STACK, height: CHAT_H }}
          >
            <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair px-4 text-link">
              {!wide && (
                <button
                  onClick={() => setListOpen(!listOpen)}
                  aria-expanded={listOpen}
                  aria-label="Conversations"
                  title="Conversations"
                  className="flex size-7 items-center justify-center font-mono text-[16px] hover:bg-selected"
                >
                  ≡
                </button>
              )}
              <span className="type-label-serif-l">{current?.title ?? 'New conversation'}</span>
              <span className="type-label-mono text-dim">{to.label}</span>
              <span className="flex-1" />
              <button
                onClick={() => setAgents(!agents)}
                aria-pressed={agents}
                title="What the agents are doing, and what the Orchestrator tells them"
                className={`flex h-7 items-center gap-1.5 border border-chip-line px-2.5 type-label-s ${agents ? 'bg-brand text-on-brand' : 'text-link hover:bg-selected'}`}
              >
                Agents
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close the conversation"
                title="Close (Esc)"
                className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
              >
                ✕
              </button>
            </header>
            <div className="relative flex min-h-0 flex-1">
              {(wide || listOpen) && (
                <aside
                  aria-label="Conversations"
                  className={`flex shrink-0 flex-col border-r border-hair bg-card ${
                    wide ? '' : 'absolute inset-y-0 left-0 z-10 shadow-lift'
                  }`}
                  style={{ width: LIST_W }}
                >
                  <div className="flex h-11 shrink-0 items-center justify-between px-3 text-link">
                    <span className="type-label-s">Conversations</span>
                    <button
                      onClick={() => {
                        pick(newThread())
                        setListOpen(false)
                      }}
                      title="Start a new conversation"
                      className="flex h-7 items-center gap-1 border border-chip-line px-2 type-label-s hover:bg-selected"
                    >
                      <Icon name="add-line" size={12} />
                      New
                    </button>
                  </div>
                  <ul className="min-h-0 flex-1 overflow-y-auto p-1.5 pt-0">
                    {(current
                      ? threads
                      : [
                          {
                            id: chat,
                            title: 'New conversation',
                            count: 0,
                            updated: '',
                            busy: false
                          },
                          ...threads
                        ]
                    ).map((t) => (
                      <li key={t.id}>
                        <button
                          onClick={() => {
                            pick(t.id)
                            setListOpen(false)
                          }}
                          aria-current={t.id === chat ? 'true' : undefined}
                          className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left ${t.id === chat ? 'bg-selected' : 'hover:bg-selected'}`}
                        >
                          <span className="line-clamp-2 type-body-s text-link">{t.title}</span>
                          <span className="type-caption text-dim">
                            {t.busy ? 'Working…' : t.count ? `${t.count} messages` : 'Not started'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col px-5">
                  <ChatPanel
                    key={`${to.project}/${chat}`}
                    project={to.project}
                    chat={chat}
                    plan={plan}
                    composer={false}
                    view="conversation"
                    projects={projects}
                    onGo={(p) => {
                      setOpen(false)
                      onGo(p)
                    }}
                  />
                </div>
                {working && <div className="shrink-0">{working}</div>}
              </div>
            </div>
          </section>
        )}

        {!open && working && (
          <div className="absolute inset-x-0" style={{ bottom: STACK }}>
            {working}
          </div>
        )}

        {matches.length > 0 && (
          <ul
            id="bar-commands"
            role="listbox"
            aria-label="Commands"
            className="absolute inset-x-0 border border-chip-line bg-card p-1.5 shadow-lift animate-[rise-in_160ms_var(--ease)_both]"
            style={{ bottom: STACK + 8 }}
          >
            {matches.map((c) => (
              <li key={c.id} role="option" aria-selected={c === shown}>
                <button
                  type="button"
                  onPointerDown={(e) => e.preventDefault()} // keep the field focused
                  onClick={() => run(c)}
                  onPointerEnter={() => setHi(matches.indexOf(c))}
                  className={`flex w-full items-baseline gap-3 px-3 py-2 text-left text-link ${c === shown ? 'bg-selected' : ''}`}
                >
                  <span className="w-24 shrink-0 font-mono text-[13px]">/{c.id}</span>
                  <span className="type-label-serif-l">{c.label}</span>
                  <span className="min-w-0 flex-1 truncate text-right type-caption text-dim">
                    {c.hint}
                  </span>
                </button>
              </li>
            ))}
            <li className="px-3 pt-1.5 pb-0.5 type-caption text-dim">
              ↑ ↓ to choose · Enter or Tab to go · Esc to close
            </li>
          </ul>
        )}

        {picking && (
          <ul
            role="menu"
            aria-label="Mode"
            className="absolute left-2 w-80 border border-chip-line bg-card p-1.5 shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
            style={{ bottom: STACK + 8 }}
          >
            {MODES.map((m) => (
              <li key={m.id}>
                <button
                  role="menuitemradio"
                  aria-checked={m.id === mode.id}
                  disabled={!m.ready}
                  onClick={() => setPicking(false)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-link ${m.ready ? 'hover:bg-selected' : 'opacity-50'} ${m.id === mode.id ? 'bg-selected' : ''}`}
                >
                  <span className="flex w-full items-center justify-between">
                    <span className="type-label-serif-l">{m.name}</span>
                    {!m.ready && <span className="type-label-mono text-dim">Coming next</span>}
                  </span>
                  <span className="type-caption text-dim">{m.what}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={send}
          className={`${chip} glass relative w-full gap-3 pr-3 pl-2.5 ${open ? 'shadow-none' : ''}`}
          style={{ height: BAR_H }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
            <Icon name="logo-mark" size={20} />
          </span>
          <button
            type="button"
            onClick={() => setPicking(!picking)}
            aria-haspopup="menu"
            aria-expanded={picking}
            title={`${mode.name}: ${mode.what}`}
            className="flex h-8 shrink-0 items-center gap-1.5 border border-chip-line px-2.5 type-label-s text-link hover:bg-selected"
          >
            {mode.name}
            <Icon name="arrow-down-s-line" size={14} />
          </button>
          <input
            ref={input}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setHi(0)
              // a command, not a message: the menu shows instead of the conversation
              if (e.target.value.startsWith('/')) setOpen(false)
            }}
            onKeyDown={(e) => {
              if (!matches.length) return
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                const n = matches.length
                setHi((h) => (Math.min(h, n - 1) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n)
              }
              if (e.key === 'Tab' && shown) {
                e.preventDefault()
                run(shown)
              }
            }}
            onFocus={() => {
              if (!text.startsWith('/')) setOpen(true)
              if (error) setError('')
            }}
            onClick={() => !text.startsWith('/') && setOpen(true)}
            role="combobox"
            aria-expanded={matches.length > 0}
            aria-controls="bar-commands"
            placeholder={
              busy
                ? 'The Orchestrator is working…'
                : 'Ask the Orchestrator anything, or type / to go somewhere'
            }
            aria-label={`Message the Orchestrator, ${to.label}`}
            className="min-w-0 flex-1 border-0 border-b-2 border-brand bg-transparent py-1 type-body-m text-link outline-none placeholder:text-placeholder focus-visible:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void window.api.stopChat(to.project, chat).catch(() => {})}
              className="shrink-0 border border-chip-line px-2.5 py-1 type-label-s text-link hover:bg-selected"
            >
              Stop
            </button>
          ) : null}
        </form>
        <div
          className="relative flex items-center gap-5 border border-t-0 border-chip-line bg-chip px-3 type-caption text-link"
          style={{ height: METER_H }}
        >
          {usage ? (
            METERS.map(([key, name]) => {
              const w = usage[key]
              if (!w) return null
              const when = new Date(w.resetsAt * 1000)
              const pct = when.getTime() < Date.now() ? 0 : Math.round(w.utilization * 100)
              return (
                <div
                  key={key}
                  role="meter"
                  aria-label={`${name} usage`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  title={`Resets ${when.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}. Last read ${new Date(reading!.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <span className="shrink-0">{name}</span>
                  <span className="h-1.5 min-w-0 flex-1 bg-brand/15">
                    <span
                      className={`block h-full ${pct >= 90 ? 'bg-signal' : 'bg-brand'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="shrink-0 tabular-nums">{pct}%</span>
                </div>
              )
            })
          ) : (
            <span className="text-dim">Your Claude plan usage shows after your next message</span>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="absolute left-1/2 -translate-x-1/2 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
            style={{ bottom: STACK + 8 }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
