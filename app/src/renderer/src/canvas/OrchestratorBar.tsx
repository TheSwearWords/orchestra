// The Orchestrator bar (brand spec §5.2, canvas spec §0.4): anchored to the window, bottom
// centre on every screen, spanning the room between the bottom-left corner and the viewfinder.
// Who it talks to follows where you are: in the Studio, the Orchestrator above every project;
// inside a book, that project's. Clicking the field opens the conversation, rising out of the
// bar; the Orchestrator's "Go to:" cards take you wherever they point.
import { useEffect, useRef, useState } from 'react'
import type { CreateState } from '../../../preload'
import { ChatPanel } from '../components/Create'
import { Icon } from '../components/Icon'
import type { Place } from '../goto'
import { STUDIO, chip, typing } from './shared'

export interface BarTarget {
  project: string // a project id, or STUDIO
  chat: string
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

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

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
  const input = useRef<HTMLInputElement>(null)
  const here = useRef<HTMLDivElement>(null)
  const key = `${to.project}/${to.chat}`

  useEffect(() => {
    let live = true
    window.api.loadChat(to.project, to.chat).then(
      (c) => live && setBusy(c.busy),
      () => {}
    )
    if (to.project !== STUDIO)
      window.api.loadCreate(to.project).then(
        (p) => live && setPlan(p),
        () => {}
      )
    const off = window.api.onChatEvent((e) => {
      if (e.project === to.project && e.chat === to.chat && e.kind === 'busy') setBusy(e.busy)
    })
    return () => {
      live = false
      off()
    }
  }, [to.project, to.chat])

  // "/" jumps to the bar; Esc closes the conversation before the board hears it; a click
  // anywhere else on the window puts it away
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
      await window.api.sendChat(to.project, to.chat, sent)
    } catch (err) {
      setText(sent) // keep what they wrote if it didn't go
      setError(reason(err))
    }
  }

  const mode = MODES[0]
  return (
    <div
      ref={here}
      className="absolute bottom-3.5 z-30"
      style={{ left: BAR_LEFT, right: BAR_RIGHT }}
    >
      {open && (
        <section
          aria-label={`Conversation ${to.label}`}
          className="absolute inset-x-0 flex h-[min(66vh,720px)] origin-bottom flex-col border border-b-0 border-chip-line bg-card shadow-lift animate-[rise-in_240ms_var(--ease)_both]"
          style={{ bottom: BAR_H }}
        >
          <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair px-4 text-link">
            <span className="flex size-6 items-center justify-center rounded-full bg-brand text-on-brand">
              <Icon name="logo-mark" size={14} />
            </span>
            <span className="type-label-serif-l">Orchestrator</span>
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
          <div className="mx-auto flex min-h-0 w-full max-w-[860px] flex-1 flex-col">
            <ChatPanel
              key={key}
              project={to.project}
              chat={to.chat}
              plan={plan}
              composer={false}
              chatOnly
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
        className={`${chip} w-full gap-3 pr-3 pl-2.5 ${open ? 'border-t-hair shadow-none' : ''}`}
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
          className="serif-on flex h-8 shrink-0 items-center gap-1.5 border border-chip-line px-2.5 type-label-s text-link hover:bg-selected"
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
            onClick={() => void window.api.stopChat(to.project, to.chat).catch(() => {})}
            className="serif-on shrink-0 border border-chip-line px-2.5 py-1 type-label-s text-link hover:bg-selected"
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
  )
}
