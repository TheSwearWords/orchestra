import { useEffect, useState } from 'react'
import type { Project } from '../../preload'
import { Ascii, type AsciiName } from './components/Ascii'
import { Deliverables } from './components/Deliverables'
import { NewProject } from './components/NewProject'
import { Research } from './components/Research'
import { Sidebar, type Page } from './components/Sidebar'
import { PhaseTabs, WorkspaceHeader, type Phase } from './components/Workspace'

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

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[] | null>(null)
  // a window opened on a project gets it in the URL hash; otherwise reopen the last one
  const [selected, setSelected] = useState<string | null>(
    () => new URLSearchParams(location.hash.slice(1)).get('project') ?? remembered('selected')
  )
  const [phase, setPhase] = useState<Phase>('research')
  const [collapsed, setCollapsed] = useState(() => remembered('collapsed') === '1')

  useEffect(() => {
    const load = (): void => void window.api.listProjects().then(setProjects)
    load()
    // another window may have created a project; catch up when this one comes forward
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

  const projectName = projects?.find((p) => p.id === selected)?.name
  useEffect(() => {
    document.title = projectName ? `${projectName} · Orchestra` : 'Orchestra' // names each window
  }, [projectName])

  function select(target: string): void {
    setSelected(target)
    remember('selected', target)
  }

  function toggle(): void {
    setCollapsed(!collapsed)
    remember('collapsed', collapsed ? '0' : '1')
  }

  if (!projects) return <div className="h-full bg-canvas" />

  const project = projects.find((p) => p.id === selected)
  const page = selected && selected in PAGE_TITLES ? (selected as Page) : null
  // nothing selected (first run, or a remembered project that was deleted): start a new one
  const view = page ?? (project ? 'project' : 'new')

  const workspaceArt: AsciiName =
    view === 'project' ? PHASE_ART[phase].workspace : view === 'new' ? 'hand' : 'concert'

  return (
    <div className="flex h-full">
      <Sidebar
        projects={projects}
        selected={view === 'new' ? 'new' : selected}
        collapsed={collapsed}
        art={view === 'project' ? PHASE_ART[phase].rail : 'violin'}
        onSelect={(t) => {
          if (t !== selected) setPhase('research')
          select(t)
        }}
        onToggle={toggle}
      />
      <main className="relative isolate flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
        {/* a barely-there figure in the open space; content always reads over it */}
        <Ascii
          key={workspaceArt} // remount so a new figure fades in
          name={workspaceArt}
          fit="width"
          className={`absolute right-0 bottom-0 -z-10 w-[45%] text-line/70 transition-opacity duration-700 ease-out-strong starting:opacity-0 ${view === 'project' ? 'top-[174px]' : 'top-28'}`} // below the header, and the tabs when shown
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
                select(p.id)
              }}
            />
          </div>
        )}
        {view === 'project' && project && (
          <div key={project.id} className="stagger flex flex-1 flex-col">
            <WorkspaceHeader
              title={project.name}
              context={[project.client, project.concept.split('\n')[0]].filter(Boolean).join(' · ')}
              status={<span className="type-caption text-fg-2">Private workspace</span>}
            />
            <PhaseTabs active={phase} onChange={setPhase} />
            {phase === 'research' ? (
              <Research key={project.id} project={project.id} />
            ) : phase === 'create' ? (
              <Deliverables key={project.id} project={project.id} />
            ) : (
              <section key={phase} className="stagger px-6 py-8">
                <p className="type-body-m text-fg-2">
                  The {phase} phase is next on the build plan.
                </p>
              </section>
            )}
          </div>
        )}
        {page && (
          <div key={page} className="stagger">
            <WorkspaceHeader title={PAGE_TITLES[page]} context="Next on the build plan." />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
