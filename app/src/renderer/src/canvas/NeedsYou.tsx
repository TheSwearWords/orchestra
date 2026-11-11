// Where you're needed in the project you're in, like Figma's comments: a pill beside the session
// dock's Orchestrator dot (SessionDock.tsx places it; filled amber while something unread waits)
// opens the list; picking one takes you to the window on the board that's waiting, and marks it
// read. The Studio doesn't have the pill: each cover there carries a tag, from the same list.
import { useEffect, useState } from 'react'
import type { Ask, Project, Proposal } from '../../../preload'
import { waitingOnUser } from '../decide'
import { GENERAL } from './shared'

export interface Need {
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
          const [asks, proposals, chat, plan] = await Promise.all([
            window.api.listAsks(p.id).catch(() => ({}) as Record<string, Ask>),
            window.api.listProposals(p.id).catch(() => ({}) as Record<string, Proposal>),
            window.api.loadChat(p.id, GENERAL).catch(() => ({ messages: [] })),
            window.api.loadCreate(p.id).catch(() => ({ musicians: [], selected: [] }))
          ])
          const known = new Set(plan.musicians.map((m) => m.id))
          const asked = waitingOnUser(chat.messages, known, plan.selected)
          return [
            ...(asked
              ? [
                  {
                    key: `${p.id}/question/${asked.t}`,
                    project: p.id,
                    card: 'actions',
                    title: 'The Orchestrator asked',
                    what: asked.question,
                    t: asked.t
                  }
                ]
              : []),
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
  needs,
  onOpen
}: {
  needs: Need[]
  onOpen: (project: string, card: string) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(seenSet)

  useEffect(() => {
    const show = (): void => setOpen(true)
    addEventListener('orchestra:needs', show)
    return () => removeEventListener('orchestra:needs', show)
  }, [])

  const unread = needs.filter((n) => !seen.has(n.key)).length
  return (
    <div className="relative">
      {/* nothing waiting, no pill; "/needs" in the bar still opens the list */}
      {needs.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title="What's waiting on you in this project"
          className={`glass flex h-7 items-center gap-2 rounded-full border border-needs-you px-3 type-body-s font-medium whitespace-nowrap ${
            unread ? 'bg-needs-you text-on-needs-you' : 'bg-chip text-signal-fg'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${unread ? 'bg-on-needs-you' : 'bg-needs-you'}`}
          />
          Needs you · {needs.length}
        </button>
      )}
      {open && (
        <div className="glass absolute top-full right-0 mt-2 w-[360px] rounded-lg border border-chip-line bg-card shadow-lift animate-[rise-in_200ms_var(--ease)_both]">
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
