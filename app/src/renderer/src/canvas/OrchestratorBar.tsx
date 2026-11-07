// The Orchestrator bar (brand spec §5.2, canvas spec §0.4), bottom centre on every screen.
// Who it talks to follows where you are: in the Studio, the Orchestrator above every project;
// inside a book, that project's General chat. Sending opens the conversation above the bar.
import { useEffect, useRef, useState } from 'react'
import type { CreateState } from '../../../preload'
import { ChatPanel } from '../components/Create'
import { Icon } from '../components/Icon'
import { STUDIO, chip, typing } from './shared'

export interface BarTarget {
  project: string // a project id, or STUDIO
  chat: string
  label: string // "To …"
}

const MODES = [
  { id: 'conduct', name: 'Conduct', ready: true },
  { id: 'arrange', name: 'Arrange', ready: false },
  { id: 'terminal', name: 'Terminal', ready: false }
]

const reason = (err: unknown): string => String(err).replace(/^.*Error: /, '')

export function OrchestratorBar({ to }: { to: BarTarget }): React.JSX.Element {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<CreateState | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)
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

  // "/" jumps to the bar; Esc closes the conversation before anything else hears it
  useEffect(() => {
    const keys = (e: KeyboardEvent): void => {
      if (e.key === '/' && !typing(e)) {
        e.preventDefault()
        input.current?.focus()
      }
      if (e.key === 'Escape' && (open || document.activeElement === input.current)) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        input.current?.blur()
      }
    }
    addEventListener('keydown', keys, true)
    return () => removeEventListener('keydown', keys, true)
  }, [open])

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

  // clear of the pages (bottom left) and the minimap (bottom right)
  const width = 'w-[clamp(440px,calc(100vw-540px),780px)]'
  return (
    <>
      {open && (
        <section
          aria-label={`Conversation ${to.label}`}
          className={`absolute bottom-[86px] left-1/2 z-30 flex h-[min(64vh,680px)] -translate-x-1/2 flex-col border border-chip-line bg-card shadow-lift ${width} min-w-[520px] animate-[area-in_240ms_var(--ease)_both]`}
        >
          <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hair px-4 text-link">
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
          <div className="min-h-0 flex-1">
            <ChatPanel key={key} project={to.project} chat={to.chat} plan={plan} composer={false} />
          </div>
        </section>
      )}

      <form
        onSubmit={send}
        className={`${chip} absolute bottom-3.5 left-1/2 z-30 h-[58px] -translate-x-1/2 gap-3 pr-3 pl-2.5 ${width}`}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Hide the conversation' : 'Show the conversation'}
          title={open ? 'Hide the conversation' : 'Show the conversation'}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand"
        >
          <Icon name="logo-mark" size={20} />
        </button>
        <div role="radiogroup" aria-label="Mode" className="flex shrink-0 border border-chip-line">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={m.id === 'conduct'}
              disabled={!m.ready}
              title={
                m.ready
                  ? 'Conduct: work on the project'
                  : `${m.name} comes next: reshaping Orchestra itself from here`
              }
              className={`px-1.5 py-1 font-sans text-[10px] font-semibold tracking-[0.04em] uppercase [font-stretch:115%] ${m.id === 'conduct' ? 'bg-brand text-on-brand' : 'text-link/45'}`}
            >
              {m.name}
            </button>
          ))}
        </div>
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => error && setError('')}
          placeholder={busy ? 'The Orchestrator is working…' : 'Give your agents a direction…'}
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
        <span className="max-w-44 shrink-0 truncate type-label-mono text-link" title={to.label}>
          {to.label}
        </span>
      </form>
      {error && (
        <p
          role="alert"
          className="absolute bottom-[80px] left-1/2 z-30 -translate-x-1/2 border-l-2 border-signal bg-signal-subtle px-3 py-2 type-body-s text-signal-fg shadow-float"
        >
          {error}
        </p>
      )}
    </>
  )
}
