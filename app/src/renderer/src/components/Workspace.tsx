import { useRef, useState, type ReactNode } from 'react'
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
  pairs: [string, string][] // split groups, drawn together in a blue frame
  focus: number
  live: boolean // false while New project or a page is showing: no tab is "current"
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onSplitWith: (id: string) => void // show this tab beside the current one
  onUnsplit: (keep: string) => void // end the split, keeping this tab on screen
  onReorder: (id: string, onto: string) => void // dragged along the strip onto another tab
  receiving: 'ready' | 'over' | null // a tab is being dragged in another window
}

type Tab = { id: string; name: string }

/** Open projects. The focused pane's tab reads as current; the other pane's tab is lit but plain,
 * and the two sit together inside one border while split. Right-click a tab to split it beside
 * the current one. Drag a tab past the window's edge and it tears off into its own window that
 * follows the cursor; drop it on another window's tabs to move it there. */
export function TabStrip({
  open,
  panes,
  pairs,
  focus,
  live,
  onSelect,
  onClose,
  onSplitWith,
  onUnsplit,
  onReorder,
  receiving
}: TabStripProps): React.JSX.Element {
  const currentName = open.find((t) => t.id === panes[focus])?.name
  // a press on a tab that may turn into a drag, and then into a tear-off past the window's edge
  const press = useRef<{
    id: string
    x: number
    y: number
    moved: boolean
    out: boolean
    alone: boolean // the window's only tab: the window itself follows the cursor
  } | null>(null)
  const swallowClick = useRef(false)
  const [tearing, setTearing] = useState<string | null>(null)
  const [held, setHeld] = useState<string | null>(null) // pressed or being dragged: drawn smaller

  async function menu(t: Tab, here: boolean): Promise<void> {
    const paired = pairs.some((p) => p.includes(t.id))
    const choice = await window.api.menu([
      paired
        ? { id: 'unsplit', label: 'Unsplit' }
        : {
            id: 'split',
            label: `Split with ${currentName ?? 'the current tab'}`,
            enabled: live && !here && !!currentName
          },
      { id: 'window', label: 'Open in new window' },
      { id: '-', label: '', separator: true },
      { id: 'close', label: 'Close tab' }
    ])
    if (choice === 'split') onSplitWith(t.id)
    if (choice === 'unsplit') onUnsplit(t.id)
    if (choice === 'close') onClose(t.id)
    if (choice === 'window') {
      await window.api.openWindow(t.id)
      onClose(t.id)
    }
  }

  const outsideWindow = (e: React.PointerEvent): boolean =>
    e.screenX < window.screenX ||
    e.screenX >= window.screenX + window.outerWidth ||
    e.screenY < window.screenY ||
    e.screenY >= window.screenY + window.outerHeight

  function finish(cancelled: boolean): void {
    const p = press.current
    press.current = null
    setHeld(null)
    if (!p?.moved) return
    if (!p.out) void window.api.dragDisarm() // never left the window: the others stand down
    swallowClick.current = true // the release after a drag isn't a click
    setTimeout(() => (swallowClick.current = false))
    if (!p.out) return
    setTearing(null)
    if (cancelled) {
      void window.api.dragCancel()
      return
    }
    void window.api.dragEnd().then((how) => {
      // Torn off into its own window, or moved into another one: it leaves this window. When it
      // was the only tab, this window was the one being dragged, and stays unless it merged.
      if (!p.alone || how === 'merged') onClose(p.id)
    })
  }

  function tab(t: Tab): React.JSX.Element {
    const here = live && panes[focus] === t.id
    const other = live && !here && panes.includes(t.id)
    return (
      <div
        key={t.id}
        data-tab={t.id}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          setHeld(t.id)
          press.current = {
            id: t.id,
            x: e.screenX,
            y: e.screenY,
            moved: false,
            out: false,
            alone: open.length === 1
          }
        }}
        onPointerMove={(e) => {
          const p = press.current
          if (!p || p.id !== t.id || !(e.buttons & 1)) return
          if (!p.moved) {
            if (Math.hypot(e.screenX - p.x, e.screenY - p.y) < 6) return
            p.moved = true
            e.currentTarget.setPointerCapture(e.pointerId) // keep the moves coming outside the window
            void window.api.dragArm() // other windows show they can take it
          }
          if (p.alone && p.out) return // this window now moves with the cursor
          const out = outsideWindow(e)
          if (!out) {
            // along the strip: swap with a neighbour once past its middle (so it can't flicker back)
            const over = document
              .elementFromPoint(e.clientX, e.clientY)
              ?.closest<HTMLElement>('[data-tab]')
            const onto = over?.dataset.tab
            if (over && onto && onto !== t.id) {
              const r = over.getBoundingClientRect()
              const right =
                open.findIndex((o) => o.id === onto) > open.findIndex((o) => o.id === t.id)
              if (right ? e.clientX > r.left + r.width / 2 : e.clientX < r.left + r.width / 2)
                onReorder(t.id, onto)
            }
          }
          if (out === p.out) return
          p.out = out
          setTearing(out ? t.id : null)
          if (out)
            void window.api.dragStart(
              t.id,
              { x: e.screenX, y: e.screenY, width: window.outerWidth, height: window.outerHeight },
              p.alone
            )
          else void window.api.dragCancel() // pushed back in before letting go
        }}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onClickCapture={(e) => {
          if (swallowClick.current) {
            e.stopPropagation()
            e.preventDefault()
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          void menu(t, here)
        }}
        className={`group flex shrink-0 touch-none items-center transition-[background-color,opacity,scale] duration-150 ease-out-strong ${here || other ? 'bg-canvas' : 'hover:bg-muted'} ${held === t.id ? 'scale-[0.92] cursor-grabbing' : ''} ${tearing === t.id ? 'opacity-40' : ''}`}
      >
        <button
          role="tab"
          aria-selected={here}
          onClick={() => onSelect(t.id)}
          onAuxClick={(e) => e.button === 1 && onClose(t.id)}
          title={other ? `${t.name} (in the other pane)` : t.name}
          className={`h-full max-w-52 truncate pr-1 pl-4 ${here ? 'type-current-s text-brand' : other ? 'type-label-s' : 'type-label-s text-fg-2'}`}
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
  }

  // Each split group sits together (left tab first) where its first tab would be.
  const byId = new Map(open.map((t) => [t.id, t]))
  const items: ({ kind: 'tab'; tab: Tab } | { kind: 'group'; tabs: Tab[] })[] = []
  const placed = new Set<string>()
  for (const t of open) {
    if (placed.has(t.id)) continue
    const group = pairs.find((p) => p.includes(t.id))
    const members = group?.map((id) => byId.get(id)).filter((m): m is Tab => !!m) ?? []
    if (members.length === 2) {
      members.forEach((m) => placed.add(m.id))
      items.push({ kind: 'group', tabs: members })
    } else items.push({ kind: 'tab', tab: t })
  }

  return (
    <div className="flex h-10 shrink-0 items-stretch border-b border-line bg-subtle">
      <div
        role="tablist"
        aria-label="Open projects"
        className="flex min-w-0 flex-1 overflow-x-auto"
      >
        {items.map((it) =>
          it.kind === 'group' ? (
            <div
              key={it.tabs.map((m) => m.id).join('+')}
              aria-label="Split group"
              title="A split group: these two open side by side"
              className="flex shrink-0 divide-x divide-line border-2 border-brand"
            >
              {it.tabs.map(tab)}
            </div>
          ) : (
            <div key={it.tab.id} className="flex border-r border-line">
              {tab(it.tab)}
            </div>
          )
        )}
        {receiving && (
          <div
            aria-live="polite"
            className={`m-1 flex shrink-0 items-center gap-1.5 border border-dashed border-brand px-3 transition-[background-color,color,opacity] duration-150 ease-out-strong starting:opacity-0 ${receiving === 'over' ? 'bg-brand type-current-s text-on-brand' : 'bg-brand-subtle type-label-s text-brand'}`}
          >
            <Icon name="add-line" size={14} />
            {receiving === 'over' ? 'Drop to move here' : 'Drop a tab here'}
          </div>
        )}
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
