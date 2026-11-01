import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type Phase = 'research' | 'create' | 'refine'

const PHASES: { id: Phase; label: string; icon: IconName }[] = [
  { id: 'research', label: 'Research', icon: 'phase-research' },
  { id: 'create', label: 'Create', icon: 'phase-create' },
  { id: 'refine', label: 'Refine', icon: 'phase-refine' }
]

interface HeaderProps {
  title: string
  context: string
  status?: ReactNode
}

export function WorkspaceHeader({ title, context, status }: HeaderProps): React.JSX.Element {
  return (
    <header className="flex min-h-[108px] items-start justify-between gap-6 px-6 pt-6 pb-6">
      <div className="min-w-0">
        <h1 className="truncate type-heading-s">{title}</h1>
        <p className="mt-2 truncate type-body-s text-fg-2">{context}</p>
      </div>
      {status && <div className="shrink-0 pt-1.5 text-right">{status}</div>}
    </header>
  )
}

interface TabStripProps {
  open: { id: string; name: string }[]
  panes: string[] // what each pane shows
  focus: number
  live: boolean // false while New project or a page is showing: no tab is "current"
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onSplitWith: (id: string) => void // show this tab beside the current one
  onPopOut: (id: string, at: { x: number; y: number }) => void // dragged out of the window
}

/** Open projects. The focused pane's tab reads as current; the other pane's tab is lit but plain.
 * Right-click a tab to split it beside the current one; drag it out to give it its own window. */
export function TabStrip({
  open,
  panes,
  focus,
  live,
  onSelect,
  onClose,
  onSplitWith,
  onPopOut
}: TabStripProps): React.JSX.Element {
  const currentName = open.find((t) => t.id === panes[focus])?.name

  async function menu(
    t: { id: string; name: string },
    here: boolean,
    other: boolean
  ): Promise<void> {
    const choice = await window.api.menu([
      {
        id: 'split',
        label: other ? 'Already side by side' : `Split with ${currentName ?? 'the current tab'}`,
        enabled: live && !here && !other && !!currentName
      },
      { id: 'window', label: 'Open in new window' },
      { id: '-', label: '', separator: true },
      { id: 'close', label: 'Close tab' }
    ])
    if (choice === 'split') onSplitWith(t.id)
    if (choice === 'close') onClose(t.id)
    if (choice === 'window') {
      await window.api.openWindow(t.id)
      onClose(t.id)
    }
  }

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-line bg-subtle">
      <div
        role="tablist"
        aria-label="Open projects"
        className="flex min-w-0 flex-1 overflow-x-auto"
      >
        {open.map((t) => {
          const here = live && panes[focus] === t.id
          const other = live && !here && panes.includes(t.id)
          return (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => {
                // a private type, so dropping on a text field doesn't paste anything
                e.dataTransfer.setData('application/x-orchestra-tab', t.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={(e) => {
                const { screenX: x, screenY: y } = e
                const outside =
                  x < window.screenX ||
                  x > window.screenX + window.outerWidth ||
                  y < window.screenY ||
                  y > window.screenY + window.outerHeight
                if (outside && (x || y)) onPopOut(t.id, { x, y })
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                void menu(t, here, other)
              }}
              className={`group flex shrink-0 items-center border-r border-line transition-colors duration-150 ${here || other ? 'bg-canvas' : 'hover:bg-muted'}`}
            >
              <button
                role="tab"
                aria-selected={here}
                onClick={() => onSelect(t.id)}
                onAuxClick={(e) => e.button === 1 && onClose(t.id)}
                title={other ? `${t.name} (in the other pane)` : t.name}
                className={`h-full max-w-52 truncate pr-1 pl-4 ${here ? 'type-current-s' : other ? 'type-label-s' : 'type-label-s text-fg-2'}`}
              >
                {t.name}
              </button>
              <button
                aria-label={`Close ${t.name}`}
                title="Close tab"
                onClick={() => onClose(t.id)}
                className={`mr-1.5 flex size-6 items-center justify-center text-fg-2 transition-opacity duration-150 group-hover:opacity-100 hover:bg-muted hover:text-fg focus-visible:opacity-100 ${here ? 'opacity-100' : 'opacity-0'}`}
              >
                <Icon name="close-line" size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface TabsProps {
  active: Phase | null // null: shown but not usable yet (a project that isn't created)
  onChange: (phase: Phase) => void
}

export function PhaseTabs({ active, onChange }: TabsProps): React.JSX.Element {
  const index = PHASES.findIndex((p) => p.id === active)
  // The active look is a second copy of the row, clipped to the active third. Sliding the
  // clip moves the blue and swaps text colors in perfect sync, which per-tab color
  // transitions can't do.
  const clip = `inset(0 ${(2 - index) * (100 / 3)}% 0 ${index * (100 / 3)}%)`
  return (
    <div className="relative border-y border-line bg-subtle">
      <div role="tablist" aria-label="Project phase" className="grid grid-cols-3">
        {PHASES.map((p, i) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === active}
            disabled={active === null}
            onClick={() => onChange(p.id)}
            className={`flex h-16 items-center gap-3 px-6 type-body-l transition-colors duration-150 hover:bg-muted disabled:hover:bg-transparent ${i > 0 ? 'border-l border-line' : ''}`}
          >
            <Icon name={p.icon} width={22} size={36} />
            {p.label}
          </button>
        ))}
      </div>
      {index >= 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid grid-cols-3 bg-brand text-on-brand transition-[clip-path] duration-[260ms] ease-out-strong"
          style={{ clipPath: clip }}
        >
          {PHASES.map((p) => (
            <div
              key={p.id}
              className="relative flex items-center gap-3 overflow-hidden px-6 type-current-l"
            >
              <Icon name={p.icon} width={22} size={36} />
              {p.label}
              {/* the column drawn large, so only its capital shows; left out in a half-width
              pane, where it would run into the label */}
              <span className="absolute top-1.5 right-10 hidden text-brand-hover @4xl:block">
                <Icon name={p.icon} width={98} size={160} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
