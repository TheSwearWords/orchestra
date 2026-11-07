// The Orchestrator bar (brand spec §5.2, canvas spec §0.4): anchored to the window, bottom
// centre on every screen, spanning the room between the bottom-left corner and the viewfinder.
// Who it talks to follows where you are: in the Studio, the Orchestrator above every project;
// inside a book, that project's. Clicking the field opens it up: the conversation grows out of
// the bar, your conversations line the left of the window, and the agents (their status, and
// what the Orchestrator tells them) the right. A click anywhere else puts it all away.
import { useEffect, useRef, useState } from 'react'
import type { CreateState, Thread } from '../../../preload'
import { ChatPanel } from '../components/Create'
import { Icon } from '../components/Icon'
import type { Place } from '../goto'
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

// room the bar leaves for the bottom-left corner (pages, the Studio title) and the viewfinder
export const BAR_LEFT = 300
export const BAR_RIGHT = 186
const BAR_H = 58
const SIDE_W = 288 // the conversations and agents panels beside the open bar

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')
const newThread = (): string => `t-${Date.now().toString(36)}`

export function OrchestratorBar({
  to,
  projects,
  onGo
}: {
  to: BarTarget
  projects: { id: string; name: string }[]
  onGo: (place: Place) => void
}): React.JSX.Element {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false) // the mode menu
  const [busy, setBusy] = useState(false)
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
      (c) => live && setBusy(c.busy),
      () => {}
    )
    if (to.project !== STUDIO)
      window.api.loadCreate(to.project).then(
        (p) => live && setPlan(p),
        () => {}
      )
    const off = window.api.onChatEvent((e) => {
      if (e.project !== to.project) return
      if (e.chat === chat && e.kind === 'busy') setBusy(e.busy)
      if (e.kind === 'message' || e.kind === 'busy') load()
    })
    return () => {
      live = false
      off()
    }
  }, [to.project, chat])

  // "/" jumps to the bar; Esc closes it before the board hears; a click anywhere else puts it
  // away (the panels count as part of it)
  useEffect(() => {
    const keys = (e: KeyboardEvent): void => {
      if (e.key === '/' && !typing(e)) {
        e.preventDefault()
        input.current?.focus()
      }
      if (e.key === 'Escape' && (open || picking || document.activeElement === input.current)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setPicking(false)
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

  async function send(e: React.FormEvent): Promise<void> {
    e.preventDefault()
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
  const sideBox = { top: TOP_BAR + 58, bottom: 14 }
  return (
    <div ref={here}>
      {open && (
        <>
          {/* your conversations with the Orchestrator */}
          <aside
            aria-label="Conversations"
            className={side}
            style={{ ...sideBox, left: 14, width: SIDE_W }}
          >
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-hair px-4 text-link">
              <span className="type-label-serif-l">Conversations</span>
              <button
                onClick={() => pick(newThread())}
                title="Start a new conversation"
                className="flex h-7 items-center gap-1 border border-chip-line px-2 type-label-s hover:bg-selected"
              >
                <Icon name="add-line" size={12} />
                New
              </button>
            </header>
            <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {(current
                ? threads
                : [
                    { id: chat, title: 'New conversation', count: 0, updated: '', busy: false },
                    ...threads
                  ]
              ).map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => pick(t.id)}
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

          {/* the agents: how they stand, and what the Orchestrator says to them */}
          <aside
            aria-label="Agents"
            className={side}
            style={{ ...sideBox, right: 14, width: SIDE_W }}
          >
            <header className="flex h-11 shrink-0 items-center border-b border-hair px-4 text-link">
              <span className="type-label-serif-l">Agents</span>
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
        </>
      )}

      {/* open, the bar sits between the two panels; closed, between the corners */}
      <div
        className="absolute bottom-3.5 z-30"
        style={
          open ? { left: SIDE_W + 26, right: SIDE_W + 26 } : { left: BAR_LEFT, right: BAR_RIGHT }
        }
      >
        {open && (
          // the bar, opened up: same frame, no shadow of its own
          <section
            aria-label={`Conversation ${to.label}`}
            className="absolute inset-x-0 flex h-[min(76vh,840px)] origin-bottom flex-col border border-b-0 border-chip-line bg-card animate-[rise-in_240ms_var(--ease)_both]"
            style={{ bottom: BAR_H }}
          >
            <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair px-4 text-link">
              <span className="type-label-serif-l">{current?.title ?? 'New conversation'}</span>
              <span className="type-label-mono text-dim">{to.label}</span>
              <span className="flex-1" />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close the conversation"
                title="Close (Esc)"
                className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
              >
                ✕
              </button>
            </header>
            <div className="mx-auto flex min-h-0 w-full max-w-[880px] flex-1 flex-col">
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
          </section>
        )}

        {picking && (
          <ul
            role="menu"
            aria-label="Mode"
            className="absolute left-2 w-80 border border-chip-line bg-card p-1.5 shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
            style={{ bottom: BAR_H + 8 }}
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
          className={`${chip} relative w-full gap-3 pr-3 pl-2.5 ${open ? 'shadow-none' : ''}`}
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
            onChange={(e) => setText(e.target.value)}
            onFocus={() => {
              setOpen(true)
              if (error) setError('')
            }}
            onClick={() => setOpen(true)}
            placeholder={busy ? 'The Orchestrator is working…' : 'Ask the Orchestrator anything…'}
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
          ) : (
            <kbd className="flex size-6 shrink-0 items-center justify-center border border-chip-line font-mono text-[12px] text-link/70">
              /
            </kbd>
          )}
          <span className="max-w-52 shrink-0 truncate type-label-mono text-link" title={to.label}>
            {to.label}
          </span>
        </form>
        {error && (
          <p
            role="alert"
            className="absolute left-1/2 -translate-x-1/2 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
            style={{ bottom: BAR_H + 8 }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
