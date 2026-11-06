import { useCallback, useEffect, useState } from 'react'
import type { Project, StudioLayout } from '../../preload'
import { Agents } from './components/Agents'
import { Create } from './components/Create'
import { Research } from './components/Research'
import { Book } from './canvas/Book'
import { coverInfo, type Area } from './canvas/board'
import { Breadcrumb } from './canvas/Chrome'
import { CoverEditor } from './canvas/CoverEditor'
import { Opening } from './canvas/Opening'
import { Studio } from './canvas/Studio'

// Per-viewer UI memory; storage can be unavailable, so every access is guarded.
function rememberedJson<T>(key: string, fallback: T): T {
  try {
    return (JSON.parse(localStorage.getItem(key) ?? '') as T) ?? fallback
  } catch {
    return fallback
  }
}
function remember(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // not worth surfacing: the app works the same without it
  }
}

// Where you are: the Studio, inside a book, a cover being made or edited, or the Ensemble.
type View =
  | { at: 'studio' }
  | { at: 'book'; id: string }
  | { at: 'cover'; id: string | null }
  | { at: 'ensemble' }

/** A window opened on a project (#project=…) starts inside that book; otherwise the Studio. */
function startingView(): View {
  const id = new URLSearchParams(location.hash.slice(1)).get('project')
  return id ? { at: 'book', id } : { at: 'studio' }
}

const shelfRect = (id: string): DOMRect | undefined =>
  document.querySelector(`[data-cover="${CSS.escape(id)}"]`)?.getBoundingClientRect()

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [layout, setLayout] = useState<StudioLayout | null>(null)
  const [view, setView] = useState<View>(startingView)
  // each book's area (null: the whole book) and each project's open chat in Create
  const [areas, setAreas] = useState<Record<string, Area | null>>(() => rememberedJson('areas', {}))
  const [openChats, setOpenChats] = useState<Record<string, string | null>>(() =>
    rememberedJson('chats', {})
  )
  const [opening, setOpening] = useState<{
    id: string
    shelf: DOMRect
    dir: 'open' | 'close'
    then: View
  } | null>(null)

  const refresh = useCallback(
    () =>
      void window.api.listProjects().then((list) => {
        setProjects(list)
        // a project deleted, maybe in another window, can't stay open here
        setView((v) =>
          (v.at === 'book' || v.at === 'cover') && v.id && !list.some((p) => p.id === v.id)
            ? { at: 'studio' }
            : v
        )
      }),
    []
  )

  useEffect(() => {
    refresh()
    void window.api.loadStudio().then(setLayout)
    // another window may have created or deleted a project; catch up when this one comes forward
    addEventListener('focus', refresh)
    const keys = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        void window.api.openWindow()
      }
    }
    addEventListener('keydown', keys)
    return () => {
      removeEventListener('focus', refresh)
      removeEventListener('keydown', keys)
    }
  }, [refresh])

  useEffect(() => {
    remember('areas', areas)
    remember('chats', openChats)
  }, [areas, openChats])

  const current = view.at === 'book' ? projects?.find((p) => p.id === view.id) : undefined
  useEffect(() => {
    document.title = current ? `${current.name} · Orchestra` : 'Orchestra' // names each window
  }, [current])

  const toStudio = useCallback(() => setView({ at: 'studio' }), [])
  // Esc in the Ensemble goes back to the Studio
  useEffect(() => {
    if (view.at !== 'ensemble') return
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[aria-modal=true]'))
        toStudio()
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [view.at, toStudio])

  if (!projects || !layout) return <div className="bg-dots h-full" />

  /** Plays the opening from the cover's place on the shelf into its book. */
  function enter(id: string, from?: DOMRect): void {
    const shelf = from ?? shelfRect(id)
    if (!shelf) return setView({ at: 'book', id })
    setOpening({ id, shelf, dir: 'open', then: { at: 'book', id } })
  }
  /** Closes the book back into its place on the shelf. */
  function close(id: string): void {
    const shelf = shelfRect(id)
    if (!shelf) return toStudio()
    setOpening({ id, shelf, dir: 'close', then: { at: 'studio' } })
  }

  const saveLayout = (l: StudioLayout): void => {
    setLayout(l)
    void window.api.saveStudio(l)
  }
  const movements = Object.fromEntries(
    Object.entries(areas).flatMap(([id, a]) => (a ? [[id, a]] : []))
  ) as Record<string, Area>
  const project = (id: string | null): Project | undefined => projects.find((p) => p.id === id)

  function area(p: Project, a: Area): React.ReactNode {
    if (a === 'research')
      return (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Research key={p.id} project={p.id} />
        </div>
      )
    if (a === 'create')
      return (
        <Create
          key={p.id}
          project={p.id}
          info={p}
          onInfoSaved={refresh}
          chat={openChats[p.id] ?? null}
          onChat={(c) => setOpenChats((all) => ({ ...all, [p.id]: c }))}
          onChatsChanged={() => {}}
        />
      )
    return (
      <section className="px-10 py-8">
        <p className="type-body-m text-dim">III Refine is next on the build plan.</p>
      </section>
    )
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* the Studio stays laid out underneath, so a closing book knows where its cover sits */}
      <div
        className="absolute inset-0"
        style={{ visibility: view.at === 'studio' ? 'visible' : 'hidden' }}
      >
        <Studio
          projects={projects}
          layout={layout}
          onLayout={saveLayout}
          movements={movements}
          onEnter={enter}
          onEdit={(id) => setView({ at: 'cover', id })}
          onNew={() => setView({ at: 'cover', id: null })}
          onEnsemble={() => setView({ at: 'ensemble' })}
          onChanged={refresh}
          hidden={opening?.id}
        />
      </div>

      {current && (
        <div className="absolute inset-0">
          <Book
            key={current.id}
            name={current.name}
            area={areas[current.id] ?? null}
            onArea={(a) => setAreas((all) => ({ ...all, [current.id]: a }))}
            onStudio={() => close(current.id)}
            render={(a) => area(current, a)}
          />
        </div>
      )}

      {view.at === 'cover' && (
        <div className="absolute inset-0">
          <CoverEditor
            key={view.id ?? 'new'}
            project={project(view.id) ?? null}
            no={view.id ? projects.findIndex((p) => p.id === view.id) + 1 : projects.length + 1}
            onDone={toStudio}
            onSaved={refresh}
            onEnter={(id) => {
              toStudio()
              requestAnimationFrame(() => enter(id))
            }}
            onCreated={(p, open) => {
              const list = [...projects, p].sort((a, b) => a.name.localeCompare(b.name))
              setProjects(list)
              toStudio()
              if (open) requestAnimationFrame(() => enter(p.id))
            }}
          />
        </div>
      )}

      {view.at === 'ensemble' && (
        <div className="bg-dots absolute inset-0 overflow-y-auto px-10 pt-[74px] pb-10 animate-[area-in_550ms_var(--ease)_both]">
          <div className="fixed top-3.5 left-3.5 z-10">
            <Breadcrumb steps={[{ label: 'Studio', onClick: toStudio }, { label: 'Ensemble' }]} />
          </div>
          <div className="mx-auto max-w-[1280px] border border-card-line bg-card shadow-card">
            <Agents />
          </div>
        </div>
      )}

      {opening && project(opening.id) && (
        <Opening
          info={coverInfo(project(opening.id)!, projects)}
          shelf={opening.shelf}
          dir={opening.dir}
          onSwap={() => setView(opening.then)}
          onDone={() => setOpening(null)}
        />
      )}
    </div>
  )
}

export default App
