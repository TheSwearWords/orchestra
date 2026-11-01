import { useEffect, useState } from 'react'
import type { Project } from '../../preload'
import { Ascii, type AsciiName } from './components/Ascii'
import { Deliverables } from './components/Deliverables'
import { Icon } from './components/Icon'
import { NewProject } from './components/NewProject'
import { Research } from './components/Research'
import { Sidebar, type Page } from './components/Sidebar'
import { PhaseTabs, TabStrip, WorkspaceHeader, type Phase } from './components/Workspace'
import {
  EMPTY,
  closeTab,
  focused,
  openTab,
  openToSide,
  prune,
  split,
  unsplit,
  type Tabs
} from './tabs'

const PAGE_TITLES: Record<Page, string> = {
  files: 'Files',
  settings: 'Settings',
  account: 'Account',
  agents: 'Agents'
}

// Sidebar and workspace always show different figures; the narrow rail gets upright ones.
const PHASE_ART: Record<Phase, { rail: AsciiName; workspace: AsciiName }> = {
  research: { rail: 'hand', workspace: 'apollo' },
  create: { rail: 'violin', workspace: 'concert' },
  refine: { rail: 'apollo', workspace: 'hand' }
}

// Per-viewer UI memory; storage can be unavailable, so every access is guarded.
function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function remember(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // not worth surfacing: the app works the same without it
  }
}
function rememberedJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(remembered(key) ?? '') as T) ?? fallback
  } catch {
    return fallback
  }
}

// What the workspace shows: the open project tabs, New project, or a utility page.
type Mode = 'projects' | 'new' | Page

/** Where a window starts: a project from the URL hash (a window opened on it), else last time. */
function startingState(): { tabs: Tabs; mode: Mode } {
  const fromHash = new URLSearchParams(location.hash.slice(1)).get('project')
  if (fromHash) return { tabs: openTab(EMPTY, fromHash), mode: 'projects' }
  // before tabs, only the last project was remembered; reopen it as the first tab
  const legacy = remembered('selected')
  if (remembered('tabs') === null && legacy && legacy !== 'new' && !(legacy in PAGE_TITLES))
    return { tabs: openTab(EMPTY, legacy), mode: 'projects' }
  const mode = (remembered('mode') as Mode | null) ?? 'projects'
  return { tabs: rememberedJson<Tabs>('tabs', EMPTY), mode }
}

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [start] = useState(startingState)
  const [tabs, setTabs] = useState<Tabs>(start.tabs)
  const [mode, setMode] = useState<Mode>(start.mode)
  const [phases, setPhases] = useState<Record<string, Phase>>(() => rememberedJson('phases', {}))
  const [collapsed, setCollapsed] = useState(() => remembered('collapsed') === '1')

  // Reloads the project list; tabs of projects that are gone (deleted, maybe in another window) close.
  const refresh = (): void =>
    void window.api.listProjects().then((list) => {
      setProjects(list)
      setTabs((t) => prune(t, (id) => list.some((p) => p.id === id)))
    })

  useEffect(() => {
    const load = refresh
    load()
    // another window may have created or deleted a project; catch up when this one comes forward
    window.addEventListener('focus', load)
    const keys = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void window.api.openWindow()
      }
    }
    window.addEventListener('keydown', keys)
    return () => {
      window.removeEventListener('focus', load)
      window.removeEventListener('keydown', keys)
    }
  }, [])

  useEffect(() => {
    remember('tabs', JSON.stringify(tabs))
    remember('mode', mode)
    remember('phases', JSON.stringify(phases))
  }, [tabs, mode, phases])

  const view: Mode = mode === 'projects' && tabs.panes.length === 0 ? 'new' : mode
  const current = view === 'projects' ? focused(tabs) : undefined
  const currentName = projects?.find((p) => p.id === current)?.name
  useEffect(() => {
    document.title = currentName ? `${currentName} · Orchestra` : 'Orchestra' // names each window
  }, [currentName])

  if (!projects) return <div className="h-full bg-canvas" />

  const byId = new Map(projects.map((p) => [p.id, p]))
  const phaseOf = (id: string): Phase => phases[id] ?? 'research'
  const show = (id: string): void => {
    setTabs((t) => openTab(t, id))
    setMode('projects')
  }

  function toggle(): void {
    setCollapsed(!collapsed)
    remember('collapsed', collapsed ? '0' : '1')
  }

  const page = view !== 'projects' && view !== 'new' ? view : null

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selected={current ?? view}
        collapsed={collapsed}
        art={current ? PHASE_ART[phaseOf(current)].rail : 'violin'}
        onSelect={(t) => (t === 'new' || t in PAGE_TITLES ? setMode(t as Mode) : show(t))}
        onSide={(id) => {
          setTabs((t) => openToSide(t, id))
          setMode('projects')
        }}
        onToggle={toggle}
        onChanged={refresh}
      />
      <main className="flex min-w-0 flex-1 flex-col bg-canvas">
        {tabs.open.length > 0 && (
          <TabStrip
            open={tabs.open.map((id) => ({ id, name: byId.get(id)?.name ?? id }))}
            panes={tabs.panes}
            focus={tabs.focus}
            live={view === 'projects'}
            onSelect={show}
            onClose={(id) => setTabs((t) => closeTab(t, id))}
            onSplit={() => setTabs(split)}
            onUnsplit={() => setTabs((t) => unsplit(t, t.focus))}
          />
        )}

        {view === 'projects' ? (
          <div className="flex min-h-0 flex-1">
            {tabs.panes.map((id, i) => {
              const project = byId.get(id)
              return (
                project && (
                  <ProjectPane
                    key={i}
                    project={project}
                    phase={phaseOf(id)}
                    onPhase={(ph) => setPhases((all) => ({ ...all, [id]: ph }))}
                    split={tabs.panes.length === 2}
                    side={i}
                    focused={tabs.focus === i}
                    onFocus={() => tabs.focus !== i && setTabs((t) => ({ ...t, focus: i }))}
                    onClose={() => setTabs((t) => unsplit(t, 1 - i))}
                  />
                )
              )
            })}
          </div>
        ) : (
          <div className="relative isolate flex min-h-0 flex-1 flex-col overflow-y-auto">
            {/* a barely-there figure in the open space; content always reads over it */}
            <Ascii
              key={`art-${view}`}
              name={view === 'new' ? 'hand' : 'concert'}
              fit="width"
              className="absolute top-28 right-0 bottom-0 -z-10 w-[45%] text-line/70 transition-opacity duration-700 ease-out-strong starting:opacity-0"
            />
            {view === 'new' && (
              <div key="new" className="stagger flex flex-1 flex-col">
                <WorkspaceHeader
                  title="New project"
                  context="A new space for research, creation and refinement."
                  status={<span className="type-caption text-fg-2">Only you can see this</span>}
                />
                <NewProject
                  onCreated={(p) => {
                    setProjects([...projects, p].sort((a, b) => a.name.localeCompare(b.name)))
                    show(p.id)
                  }}
                />
              </div>
            )}
            {page && (
              <div key={page} className="stagger">
                <WorkspaceHeader title={PAGE_TITLES[page]} context="Next on the build plan." />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/** One project: header, phase tabs and the phase's screen, scrolling on its own. Two sit side by
 * side when the workspace is split; the focused one takes tab clicks. */
function ProjectPane({
  project,
  phase,
  onPhase,
  split,
  side,
  focused,
  onFocus,
  onClose
}: {
  project: Project
  phase: Phase
  onPhase: (p: Phase) => void
  split: boolean
  side: number
  focused: boolean
  onFocus: () => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <section
      aria-label={project.name}
      onMouseDownCapture={onFocus}
      onFocusCapture={onFocus}
      className={`@container relative isolate flex min-w-0 flex-1 flex-col overflow-y-auto ${side === 1 ? 'border-l border-line' : ''}`}
    >
      {/* when split, a brand line marks the pane that tab clicks go to */}
      {split && (
        <div
          aria-hidden
          className={`sticky top-0 z-10 h-0.5 shrink-0 transition-colors duration-150 ${focused ? 'bg-brand' : 'bg-transparent'}`}
        />
      )}
      <Ascii
        key={phase}
        name={PHASE_ART[phase].workspace}
        fit="width"
        className="absolute top-[174px] right-0 bottom-0 -z-10 w-[45%] text-line/70 transition-opacity duration-700 ease-out-strong starting:opacity-0"
      />
      <div key={project.id} className="stagger flex flex-1 flex-col">
        <WorkspaceHeader
          title={project.name}
          context={[project.client, project.concept.split('\n')[0]].filter(Boolean).join(' · ')}
          status={
            split ? (
              <button
                onClick={onClose}
                aria-label="Close this side of the split"
                title="Close this side"
                className="flex size-8 items-center justify-center text-fg-2 transition-colors duration-150 hover:bg-muted hover:text-fg"
              >
                <Icon name="close-line" />
              </button>
            ) : (
              <span className="type-caption text-fg-2">Private workspace</span>
            )
          }
        />
        <PhaseTabs active={phase} onChange={onPhase} />
        {phase === 'research' ? (
          <Research key={project.id} project={project.id} />
        ) : phase === 'create' ? (
          <Deliverables key={project.id} project={project.id} />
        ) : (
          <section key={phase} className="stagger px-6 py-8">
            <p className="type-body-m text-fg-2">The {phase} phase is next on the build plan.</p>
          </section>
        )}
      </div>
    </section>
  )
}

export default App
