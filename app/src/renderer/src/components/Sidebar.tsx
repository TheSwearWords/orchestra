import { useState } from 'react'
import type { ChatInfo, Project } from '../../../preload'
import { Ascii, type AsciiName } from './Ascii'
import { Icon, type IconName } from './Icon'

export type Page = 'files' | 'settings' | 'account' | 'agents'

const UTILITY: { page: Page; label: string; icon: IconName }[] = [
  { page: 'files', label: 'Files', icon: 'folder-line' },
  { page: 'settings', label: 'Settings', icon: 'settings-3-line' },
  { page: 'account', label: 'Account', icon: 'user-line' },
  { page: 'agents', label: 'Agents', icon: 'team-line' }
]

interface Props {
  projects: Project[]
  selected: string | null // project id, 'new', or a utility page
  collapsed: boolean
  art: AsciiName
  onSelect: (target: string) => void
  onSide: (project: string) => void // open beside the current one, in a split
  onToggle: () => void
  onChanged: () => void // a project was renamed or deleted; reload the list
  chats: ChatInfo[] // the selected project's chats, listed under it
  activeChat: string | null | undefined // null: its overview; undefined: not in Create
  onOpenChat: (chat: string | null) => void
}

export function Sidebar({
  projects,
  selected,
  collapsed,
  art,
  onSelect,
  onSide,
  onToggle,
  onChanged,
  chats,
  activeChat,
  onOpenChat
}: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const shown = projects.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

  // One element in both states, so its width can animate. Each layout keeps a fixed width
  // and fades in, so nothing reflows while the rail slides.
  const fadeIn = 'transition-opacity duration-200 ease-out-strong starting:opacity-0'

  // Every project button: click opens its tab, Ctrl/middle-click opens a window, right-click
  // shows Rename / Open to the side / Open in new window / Delete.
  const projectProps = (p: Project): React.ButtonHTMLAttributes<HTMLButtonElement> => ({
    'aria-current': selected === p.id ? ('page' as const) : undefined,
    onClick: (e: React.MouseEvent) =>
      e.ctrlKey || e.metaKey ? void window.api.openWindow(p.id) : onSelect(p.id),
    onAuxClick: (e: React.MouseEvent) => e.button === 1 && void window.api.openWindow(p.id),
    onContextMenu: async (e: React.MouseEvent) => {
      e.preventDefault()
      const choice = await window.api.projectMenu(p.id, p.name)
      if (choice === 'deleted') onChanged()
      if (choice === 'side') onSide(p.id)
      if (choice === 'rename') {
        if (collapsed) onToggle()
        setRenaming(p.id)
      }
    }
  })

  async function rename(p: Project, name: string): Promise<void> {
    setRenaming(null)
    if (name.trim() && name.trim() !== p.name) {
      await window.api.renameProject(p.id, name).catch(() => {}) // an empty or failed rename keeps the old name
      onChanged()
    }
  }
  return (
    <nav
      aria-label="Workspace"
      className={`relative flex shrink-0 overflow-hidden border-r border-line bg-subtle transition-[width] duration-[220ms] ease-out-strong ${collapsed ? 'w-[72px]' : 'w-52'}`}
    >
      {collapsed ? (
        <div
          key="collapsed"
          className={`flex w-[72px] shrink-0 flex-col items-center pt-7 pb-4 ${fadeIn}`}
        >
          {/* mark and toggle line up with the open rail's, so the toggle never moves */}
          <div className="flex flex-col self-start pl-4">
            <Icon name="logo-mark" size={30} className="text-logo" />
            <button
              onClick={onToggle}
              aria-label="Expand navigation"
              title="Expand navigation"
              className="mt-2 flex size-[30px] items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg active:scale-[0.94]"
            >
              <Icon name="arrow-right-double-line" />
            </button>
          </div>
          <button
            onClick={() => onSelect('new')}
            className="mt-4 flex size-14 flex-col items-center justify-center gap-0.5 bg-brand type-label-s text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97]"
          >
            <Icon name="add-line" />
            New
          </button>
          <button
            onClick={onToggle}
            className="mt-3 flex w-14 flex-col items-center gap-1 py-2 type-caption text-fg-2 hover:text-fg"
          >
            <Icon name="search-line" size={20} />
            Search
          </button>
          <ul className="mt-4 flex flex-col gap-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  title={p.name}
                  {...projectProps(p)}
                  className={`flex w-14 flex-col items-center py-2 transition-colors duration-150 hover:bg-muted ${selected === p.id ? 'bg-muted' : ''}`}
                >
                  <span className={selected === p.id ? 'type-current-m' : 'type-label-l'}>
                    {initials(p.name)}
                  </span>
                  <span className="w-full truncate px-1 text-center type-caption text-fg-2">
                    {p.name.split(' ')[0]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col items-center gap-1 border-t border-line pt-2">
            {UTILITY.map((u) => (
              <button
                key={u.page}
                aria-current={selected === u.page ? 'page' : undefined}
                onClick={() => onSelect(u.page)}
                className={`flex w-14 flex-col items-center gap-1 py-2 ${selected === u.page ? 'bg-brand type-current-s text-on-brand' : 'type-caption transition-colors duration-150 hover:bg-muted'}`}
              >
                <Icon name={u.icon} size={20} />
                {u.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div key="expanded" className={`relative flex w-52 shrink-0 flex-col ${fadeIn}`}>
          <div className="flex flex-col border-b border-line bg-subtle px-4 pt-7 pb-4">
            <div className="flex items-center gap-2">
              <Icon name="logo-mark" size={30} className="text-logo" />
              {/* outlined type mark from Figma (Brand page); 715 x 138 */}
              <Icon name="wordmark" size={20} width={104} className="text-logo" />
              <span className="sr-only">Orchestra</span>
            </div>
            <button
              onClick={onToggle}
              aria-label="Collapse navigation"
              title="Collapse navigation"
              className="mt-2 flex size-[30px] items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg active:scale-[0.94]"
            >
              <Icon name="arrow-left-double-line" />
            </button>

            <button
              onClick={() => onSelect('new')}
              className="mt-4 flex h-10 items-center justify-center gap-2 bg-brand type-label-m text-on-brand transition-[background-color,scale] duration-150 hover:bg-brand-hover active:scale-[0.97] active:bg-brand-pressed"
            >
              <Icon name="add-line" />
              New project
            </button>

            <label className="mt-4 flex h-[38px] items-center gap-2 border border-line bg-canvas px-2 focus-within:border-focus">
              <Icon name="search-line" className="text-fg-2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search projects"
                className="min-w-0 flex-1 bg-transparent type-body-s outline-none placeholder:text-fg-2"
              />
            </label>

            <div className="mt-7 flex items-center justify-between type-caption text-fg-2">
              <span>Projects</span>
              <span>{projects.length}</span>
            </div>
            <ul className="-mx-4 mt-2 flex flex-col gap-2">
              {shown.map((p) => (
                <li key={p.id}>
                  {renaming === p.id ? (
                    <div className="flex h-10 items-center gap-2 bg-muted px-6">
                      <Icon name="folder-line" />
                      <input
                        autoFocus
                        defaultValue={p.name}
                        aria-label={`Rename ${p.name}`}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => void rename(p, e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') setRenaming(null)
                        }}
                        className="min-w-0 flex-1 border border-focus bg-canvas px-1.5 py-0.5 type-label-m outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      {...projectProps(p)}
                      className={`flex h-10 w-full items-center gap-2 px-6 text-left transition-colors duration-150 hover:bg-muted ${selected === p.id ? 'bg-muted type-current-m' : 'type-label-m'}`}
                    >
                      <Icon name="folder-line" />
                      <span className="truncate">{p.name}</span>
                    </button>
                  )}
                  {selected === p.id && chats.length > 0 && (
                    <ul
                      aria-label={`${p.name} chats`}
                      className="mt-1 mb-1 ml-8 flex flex-col border-l border-line"
                    >
                      {[
                        { id: null, title: 'All chats', icon: 'layout-grid-line', busy: false },
                        ...chats
                      ].map((c) => (
                        <li key={c.id ?? 'all'}>
                          <button
                            onClick={() => onOpenChat(c.id)}
                            aria-current={activeChat === c.id ? 'page' : undefined}
                            className={`flex h-8 w-full items-center gap-2 pr-4 pl-3 text-left transition-colors duration-150 hover:bg-muted ${activeChat === c.id ? 'bg-muted type-current-s' : 'type-body-s text-fg-2 hover:text-fg'}`}
                          >
                            <Icon name={c.icon} size={14} />
                            <span className="truncate">{c.title}</span>
                            {c.busy && (
                              <span
                                title="Working"
                                className="ml-auto size-1.5 shrink-0 rounded-full bg-brand"
                              />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
              {shown.length === 0 && (
                <li className="px-6 py-2 type-body-s text-fg-2">
                  {projects.length ? 'No matching projects.' : 'No projects yet.'}
                </li>
              )}
            </ul>
          </div>

          {/* the open space between the two solid sections: the figure stands on the line above
          Files, fills the height, and wider figures crop at the sides */}
          <div className="relative min-h-0 flex-1">
            <Ascii
              key={art}
              name={art}
              fit="stand"
              className="absolute inset-x-0 top-4 bottom-0 text-line-strong/40 transition-opacity duration-700 ease-out-strong starting:opacity-0"
            />
          </div>

          <div className="flex flex-col gap-1.5 border-t border-line bg-subtle pt-2 pb-4">
            {UTILITY.map((u) => (
              <button
                key={u.page}
                aria-current={selected === u.page ? 'page' : undefined}
                onClick={() => onSelect(u.page)}
                className={`flex h-10 items-center gap-2.5 px-6 text-left ${selected === u.page ? 'bg-brand type-current-m text-on-brand' : 'type-label-m transition-colors duration-150 hover:bg-muted'}`}
              >
                <Icon name={u.icon} />
                {u.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}
