// Where you're needed in the project you're in, like Figma's comments: a button anchored to the
// window (bright orange while something unread waits) opens the list; picking one takes you to
// the window on the board that's waiting, and marks it read. The Studio doesn't have the button:
// each cover there carries an orange tag, from the same list.
import { useEffect, useMemo, useState } from 'react'
import type { Ask, Project, Proposal } from '../../../preload'
import { GENERAL, TOP_BAR, chip } from './shared'

interface Need {
  key: string // unique across projects, for read/unread
  project: string
  card: string // the window on the Create board that is waiting
  title: string
  what: string
  t: string
}

const SEEN = 'needs-seen'
function seenSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markSeen(keys: string[]): void {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...new Set([...seenSet(), ...keys])].slice(-500)))
  } catch {
    // read marks are a convenience; the list still works without them
  }
}

const cardOf = (chat: string): string => (chat === GENERAL ? 'orchestrator' : `chat-${chat}`)
const ago = (iso: string): string => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000)
  return mins < 1
    ? 'now'
    : mins < 60
      ? `${mins}m`
      : mins < 1440
        ? `${Math.round(mins / 60)}h`
        : `${Math.round(mins / 1440)}d`
}

/** Everything waiting on you in these projects, newest first, kept up to date. */
export function useNeeds(projects: Project[]): Need[] {
  const [needs, setNeeds] = useState<Need[]>([])
  useEffect(() => {
    let live = true
    const load = (): void =>
      void Promise.all(
        projects.map(async (p) => {
          const [asks, proposals] = await Promise.all([
            window.api.listAsks(p.id).catch(() => ({}) as Record<string, Ask>),
            window.api.listProposals(p.id).catch(() => ({}) as Record<string, Proposal>)
          ])
          return [
            ...Object.values(asks)
              .filter((a) => a.status === 'open')
              .map((a) => ({
                key: `${p.id}/ask/${a.id}/${a.t}`,
                project: p.id,
                card: `ask-${a.id}`,
                title: a.title,
                what: a.question,
                t: a.t
              })),
            ...Object.values(proposals)
              .filter((x) => x.status === 'pending')
              .map((x) => ({
                key: `${p.id}/proposal/${x.id}`,
                project: p.id,
                card: cardOf(x.chat),
                title: `Approve a new ${x.kind}`,
                what: x.draft.name,
                t: x.t
              }))
          ]
        })
      ).then((all) => live && setNeeds(all.flat().sort((a, b) => b.t.localeCompare(a.t))))
    load()
    const off = window.api.onChatEvent((e) => {
      if (e.kind === 'asks' || e.kind === 'message') load()
    })
    addEventListener('focus', load)
    return () => {
      live = false
      off()
      removeEventListener('focus', load)
    }
  }, [projects])
  return needs
}

export function NeedsYou({
  project,
  side,
  onOpen
}: {
  project: Project
  side: number // how far in to sit, clearing the page-turn strip
  onOpen: (project: string, card: string) => void
}): React.JSX.Element {
  const here = useMemo(() => [project], [project])
  const needs = useNeeds(here)
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(seenSet)

  useEffect(() => {
    const show = (): void => setOpen(true)
    addEventListener('orchestra:needs', show)
    return () => removeEventListener('orchestra:needs', show)
  }, [])

  const unread = needs.filter((n) => !seen.has(n.key)).length
  return (
    <div className="absolute z-30" style={{ top: TOP_BAR + 10, right: 14 + side }}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        title="What's waiting on you in this project"
        className={`${chip} h-9 gap-2 px-3 type-label-s ${
          unread
            ? 'border-needs-you bg-needs-you text-on-needs-you'
            : needs.length
              ? 'border-needs-you text-link'
              : ''
        }`}
      >
        <span
          className={`size-2 rounded-full ${unread ? 'bg-on-needs-you' : needs.length ? 'bg-needs-you' : 'border border-wire'}`}
        />
        Needs you{needs.length ? ` · ${needs.length}` : ''}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] border border-chip-line bg-card shadow-lift animate-[rise-in_200ms_var(--ease)_both]">
          <header className="flex h-11 items-center justify-between border-b border-hair px-4 text-link">
            <span className="type-label-serif-l">Where you&apos;re needed</span>
            {unread > 0 && (
              <button
                onClick={() => {
                  markSeen(needs.map((n) => n.key))
                  setSeen(seenSet())
                }}
                className="type-caption text-dim hover:text-link"
              >
                Mark all read
              </button>
            )}
          </header>
          {needs.length === 0 ? (
            <p className="p-4 type-body-s text-dim">Nothing is waiting on you.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto p-1.5">
              {needs.map((n) => {
                const fresh = !seen.has(n.key)
                return (
                  <li key={n.key}>
                    <button
                      onClick={() => {
                        markSeen([n.key])
                        setSeen(seenSet())
                        setOpen(false)
                        onOpen(n.project, n.card)
                      }}
                      className="flex w-full gap-3 px-3 py-2.5 text-left hover:bg-selected"
                    >
                      <span
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${fresh ? 'bg-needs-you' : 'border border-needs-you'}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-3">
                          <span className="truncate type-label-s text-link">{n.title}</span>
                          <span className="shrink-0 type-caption text-dim">{ago(n.t)}</span>
                        </span>
                        <span className="mt-0.5 line-clamp-2 block type-body-s text-fg">
                          {n.what}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
