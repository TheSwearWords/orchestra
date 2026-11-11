// The session dock: a side notch on the right edge with the Orchestrator on top and a dot for
// each deliverable agent in the project. Click it for names and statuses. Needs you lives here
// too: the Orchestrator's dot turns amber and a pill beside it opens the list.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Project } from '../../../preload'
import { NeedsYou, useNeeds } from './NeedsYou'
import { STATUS_WORDS, dockAgents, type DockAgent, type DockStatus } from './dock'

const DOT: Record<DockStatus, string> = {
  'needs-you': 'bg-needs-you',
  error: 'bg-danger',
  working: 'bg-agent',
  done: 'bg-success',
  idle: 'bg-fg-disabled'
}

/** The project's deliverable agents, kept current as they change status. */
function useAgents(project: string | undefined): DockAgent[] {
  const [agents, setAgents] = useState<DockAgent[]>([])
  useEffect(() => {
    if (!project) return undefined
    let live = true
    const load = (): void =>
      void Promise.all([window.api.loadCreate(project), window.api.agentStates(project)])
        .then(
          ([plan, states]) => live && setAgents(dockAgents(plan.musicians, plan.selected, states))
        )
        .catch(() => live && setAgents([]))
    load()
    const off = window.api.onChatEvent((e) => {
      if (e.project === project && e.kind === 'agents') load()
    })
    // deliverables chosen or dropped on the Create board
    addEventListener('orchestra:agents-changed', load)
    addEventListener('focus', load)
    return () => {
      live = false
      off()
      removeEventListener('orchestra:agents-changed', load)
      removeEventListener('focus', load)
    }
  }, [project])
  return project ? agents : []
}

export function SessionDock({
  project,
  onOpen
}: {
  project?: Project // none on the Studio: the Orchestrator's dot alone
  onOpen: (project: string, card: string) => void
}): React.JSX.Element {
  const agents = useAgents(project?.id)
  const here = useMemo(() => (project ? [project] : []), [project])
  const needs = useNeeds(here)
  const [open, setOpen] = useState(false)
  // the collapsed dock's hover label: which agent, and how far down the dock its dot sits
  const [hover, setHover] = useState<{ agent: DockAgent; y: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return undefined
    const out = (e: MouseEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    addEventListener('mousedown', out)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('mousedown', out)
      removeEventListener('keydown', esc)
    }
  }, [open])

  const playing = agents.filter((a) => a.status === 'working').length
  const conducting = playing ? `Conducting · ${playing} playing` : 'Nothing playing'
  return (
    <div ref={root} className="absolute right-0 z-30" style={{ top: 104 }}>
      <div
        className={`notch-right glass relative transition-[width] duration-300 ease-(--ease) ${
          open ? 'w-[190px] shadow-float' : 'w-9'
        }`}
      >
        <button
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`Agents in this session. ${conducting}`}
          className="flex w-full items-center gap-2.5 px-[7px] pt-2.5 pb-2 text-left"
        >
          <span
            aria-hidden
            className={`size-[22px] shrink-0 rounded-full transition-[background,box-shadow] duration-1000 ease-(--ease-calm) ${
              needs.length
                ? 'bg-[radial-gradient(circle_at_35%_30%,var(--color-status-signal-text),var(--color-needs-you-default))] shadow-[0_0_14px_var(--color-status-signal-subtle)]'
                : 'bg-[radial-gradient(circle_at_35%_30%,var(--color-agent-text),var(--color-brand))]'
            }`}
          />
          {open && (
            <span className="min-w-0">
              <span className="block truncate type-body-s font-medium text-fg">Orchestrator</span>
              <span className="block truncate type-caption text-dim">{conducting}</span>
            </span>
          )}
        </button>
        {agents.length > 0 && (
          // shortcut: a long list scrolls inside the dock so it never reaches the edge tab
          // below it; upgrade to a "+N" row when projects carry more agents than fit
          <ul
            className={`flex max-h-[calc(50vh-230px)] flex-col overflow-y-auto pb-3 [scrollbar-width:none] ${
              open ? 'gap-2.5 border-t border-hair px-3 pt-3' : 'items-center gap-3.5 pt-1'
            }`}
          >
            {agents.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2.5"
                onMouseEnter={(e) => {
                  const top = root.current?.getBoundingClientRect().top ?? 0
                  const r = e.currentTarget.getBoundingClientRect()
                  setHover({ agent: a, y: r.top + r.height / 2 - top })
                }}
                onMouseLeave={() => setHover(null)}
              >
                <span
                  className={`size-3 shrink-0 rounded-full transition-colors duration-1000 ease-(--ease-calm) ${DOT[a.status]}`}
                />
                {open && (
                  <span className="min-w-0">
                    <span className="block truncate type-body-s font-medium text-fg">{a.name}</span>
                    <span className="block truncate type-caption text-dim">
                      {STATUS_WORDS[a.status]}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hover && !open && (
        <span
          role="status"
          className="glass pointer-events-none absolute right-full mr-2 flex -translate-y-1/2 items-center gap-2 rounded-md border border-chip-line bg-chip px-2.5 py-1.5 whitespace-nowrap"
          style={{ top: hover.y }}
        >
          <span className="type-body-s font-medium text-fg">{hover.agent.name}</span>
          <span className="type-caption text-dim">{STATUS_WORDS[hover.agent.status]}</span>
        </span>
      )}
      {project && !open && (
        <div className="absolute top-2 right-full mr-3">
          <NeedsYou needs={needs} onOpen={onOpen} />
        </div>
      )}
    </div>
  )
}
