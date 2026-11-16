// The start of Create: one modal, split in two. On the left the project's research notes, each
// with a tick and a preview; on the right the deliverables to build. It opens on first entry
// and again whenever deliverables are added. Anything already being worked on stays on.
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Instrument, Musician } from '../../../preload'
import { groupByCategory, neededNames, toggled, type ResearchChoice } from '../canvas/setupPick'
import { Markdown } from './Research'

const solid =
  'h-9 shrink-0 rounded-full bg-brand px-4 type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed disabled:bg-muted disabled:text-fg-disabled'
const outline =
  'h-9 shrink-0 rounded-full border border-line-strong bg-canvas px-4 type-label-m transition-[background-color,scale] duration-150 hover:bg-muted active:scale-[0.97]'

export function CreateSetup({
  project,
  musicians,
  instruments,
  research,
  pickedResearch,
  selected,
  pinned,
  first,
  onConfirm,
  onClose
}: {
  project: string
  musicians: Musician[]
  instruments: Instrument[]
  research: ResearchChoice[] // the notes on offer
  pickedResearch: string[] // ticked to start with
  selected: string[] // deliverables ticked to start with
  pinned: string[] // deliverables with work started: they stay on
  first: boolean // nothing built yet, so this is the first time through
  onConfirm: (deliverables: string[], research: string[]) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [notes, setNotes] = useState(pickedResearch)
  const [picks, setPicks] = useState(selected)
  const [viewing, setViewing] = useState(research[0]?.path ?? '')
  const [texts, setTexts] = useState<Record<string, string | null>>({})
  const [busy, setBusy] = useState(false)
  const needs = neededNames(musicians, instruments, picks)

  // the note being previewed is read once and kept for as long as the modal is open
  useEffect(() => {
    if (!viewing || viewing in texts) return
    let live = true
    window.api.readOutput(project, viewing).then(
      (t) => live && setTexts((all) => ({ ...all, [viewing]: t })),
      () => live && setTexts((all) => ({ ...all, [viewing]: null }))
    )
    return () => {
      live = false
    }
  }, [project, viewing, texts])

  async function confirm(): Promise<void> {
    setBusy(true)
    try {
      await onConfirm(picks, notes)
    } finally {
      setBusy(false)
    }
  }

  // The theme rounds a bordered box only when its border colour is one it knows, so a ticked row
  // (blue border) would go square. Say the radius here instead.
  const row = 'flex items-start gap-3 rounded-lg border p-3 transition-colors duration-200'
  // blue when ticked, the agent tint when work has started, plain otherwise
  const tone = (on: boolean, started = false): string =>
    started
      ? 'border-agent bg-agent-subtle'
      : on
        ? 'border-brand bg-brand-subtle'
        : 'border-card-line hover:bg-selected'
  const pane = 'flex min-h-0 flex-col gap-4 overflow-y-auto p-6'
  const preview = viewing ? texts[viewing] : undefined
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/40 p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Set up Create"
        className="flex h-[min(760px,88vh)] w-full max-w-[1120px] flex-col border border-chip-line bg-card text-link shadow-lift animate-[rise-in_200ms_var(--ease)_both]"
      >
        <div className="flex flex-col gap-1 border-b border-hair px-8 py-5">
          <h2 className="type-heading-m">What are you making, and from what?</h2>
          <p className="type-body-s text-dim">
            Tick the research the Orchestrator should lean on, and the deliverables to build. You
            can come back and add more.
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 divide-x divide-hair">
          <section className={pane} aria-label="Research">
            <h3 className="type-label-mono text-dim">Research</h3>
            {research.length === 0 ? (
              <p className="type-body-s text-dim">
                No research notes yet. Interpret your references in Research and they appear here.
              </p>
            ) : (
              <>
                <ul className="flex shrink-0 flex-col gap-2">
                  {research.map((r) => (
                    <li key={r.path}>
                      <div
                        className={`${row} items-center ${tone(notes.includes(r.path))} ${viewing === r.path ? 'outline-2 outline-offset-2 outline-line-strong' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={notes.includes(r.path)}
                          onChange={() => setNotes(toggled(notes, r.path, []))}
                          aria-label={`Use ${r.label}`}
                          className="size-4 accent-brand"
                        />
                        <button
                          onClick={() => setViewing(r.path)}
                          aria-pressed={viewing === r.path}
                          className="flex min-w-0 flex-1 flex-col text-left"
                        >
                          <span className="type-body-m capitalize">{r.label}</span>
                          <span className="type-log-s text-dim">{r.path}</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="min-h-40 flex-1 overflow-y-auto border border-card-line bg-canvas p-4">
                  {preview === undefined ? (
                    <p className="type-body-s text-dim">Opening…</p>
                  ) : preview === null ? (
                    <p className="type-body-s text-dim">That note could not be opened.</p>
                  ) : (
                    <Markdown text={preview} />
                  )}
                </div>
              </>
            )}
          </section>

          <section className={pane} aria-label="Deliverables">
            <h3 className="type-label-mono text-dim">Deliverables</h3>
            {groupByCategory(musicians).map((g) => (
              <div key={g.category} className="flex flex-col gap-2">
                <h4 className="type-label-s text-dim">{g.category}</h4>
                <ul className="grid grid-cols-2 gap-2">
                  {g.items.map((m) => {
                    const stays = pinned.includes(m.id)
                    return (
                      <li key={m.id}>
                        <label
                          className={`${row} h-full ${tone(picks.includes(m.id), stays)} ${stays ? 'cursor-default' : 'cursor-pointer'}`}
                          title={stays ? `${m.name} stays on: work has started.` : m.deliverable}
                        >
                          <input
                            type="checkbox"
                            checked={picks.includes(m.id)}
                            disabled={stays}
                            onChange={() => setPicks(toggled(picks, m.id, pinned))}
                            className="mt-0.5 size-4 accent-brand"
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="type-body-m">{m.name}</span>
                            <span
                              className={`type-caption ${stays ? 'text-agent-fg' : 'text-dim'}`}
                            >
                              {stays ? 'In progress' : m.deliverable}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            <p className="mt-auto border-t border-hair pt-4 type-caption text-dim">
              {needs.length
                ? `Built first, once each: ${needs.join(', ')}.`
                : 'Pick a deliverable to see what it needs first.'}
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hair p-4">
          <button onClick={onClose} className={outline}>
            {first ? 'Not now' : 'Cancel'}
          </button>
          <button
            onClick={() => void confirm()}
            disabled={busy || picks.length === 0}
            className={solid}
          >
            {first ? 'Build the canvas' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
