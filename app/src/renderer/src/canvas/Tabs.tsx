// The header's left side: Home, then one tab per open project, then + for a new one. It
// replaces the breadcrumb. App owns which tabs are open (list logic in tabList.ts).
import type { Project } from '../../../preload'
import { Icon } from '../components/Icon'
import { TOP_BAR, type Area } from './shared'
import { DRAFT, MODE_ICON } from './tabList'

interface Props {
  projects: Project[]
  tabs: string[]
  areas: Record<string, Area | null>
  active: string | null // a project id, DRAFT, or null when Home is showing
  draft?: string // the cover editor is open: its tab's name
  bare?: boolean // Home only, for Setup
  onHome: () => void
  onTab: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, onto: string) => void // a tab dragged onto another
  onNew: () => void
}

export function Tabs({
  projects,
  tabs,
  areas,
  active,
  draft,
  bare: homeOnly,
  onHome,
  onTab,
  onClose,
  onMove,
  onNew
}: Props): React.JSX.Element {
  const bare =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-dim transition-colors duration-150 hover:bg-selected hover:text-fg'
  const list = [
    ...tabs.flatMap((id) => {
      const p = projects.find((x) => x.id === id)
      return p ? [{ id, name: p.name, icon: MODE_ICON[areas[id] ?? 'book'] }] : []
    }),
    ...(draft ? [{ id: DRAFT, name: draft, icon: 'add-line' }] : [])
  ]
  return (
    <nav
      aria-label="Open projects"
      className="absolute top-0 left-0 z-30 flex items-center pl-3.5"
      // the zoom control keeps the header's right end
      style={{ height: TOP_BAR, maxWidth: 'calc(100% - 200px)' }}
    >
      <button
        onClick={onHome}
        aria-label="Home: the Studio"
        aria-current={active === null ? 'page' : undefined}
        title="Home"
        className={`${bare} ${active === null ? 'bg-selected text-fg' : ''}`}
      >
        <Icon name="home-5-line" size={16} />
      </button>
      {!homeOnly && <span aria-hidden className="mx-2.5 h-5 w-px shrink-0 bg-line" />}
      {/* with more tabs than fit they shrink to 120px, then the strip scrolls */}
      <div
        role="tablist"
        className="flex h-full min-w-0 items-end gap-1 overflow-x-auto px-3 [scrollbar-width:none]"
      >
        {list.map((t) => {
          const on = t.id === active
          return (
            <div
              key={t.id}
              // drag a tab onto another to reorder them
              draggable={t.id !== DRAFT}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/orchestra-tab', t.id)
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('text/orchestra-tab')) e.preventDefault()
              }}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/orchestra-tab')
                if (id && t.id !== DRAFT) onMove(id, t.id)
              }}
              // middle-click closes, as in a browser
              onAuxClick={(e) => e.button === 1 && onClose(t.id)}
              className={`flex h-10 max-w-56 min-w-[120px] shrink items-center ${
                on ? 'notch-up' : 'text-dim hover:text-fg'
              }`}
            >
              <button
                role="tab"
                aria-selected={on}
                onClick={() => onTab(t.id)}
                title={t.name}
                className="flex h-full min-w-0 flex-1 items-center gap-2 pr-2 pl-3.5 type-body-s font-medium transition-colors duration-150"
              >
                <Icon name={t.icon} size={16} />
                <span className="truncate">{t.name}</span>
              </button>
              {on && (
                <button
                  onClick={() => onClose(t.id)}
                  aria-label={`Close ${t.name}`}
                  className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-sm text-dim transition-colors duration-150 hover:bg-selected hover:text-fg"
                >
                  <Icon name="close-line" size={14} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {!homeOnly && (
        <button onClick={onNew} aria-label="New project" title="New project" className={bare}>
          <Icon name="add-line" size={16} />
        </button>
      )}
    </nav>
  )
}
