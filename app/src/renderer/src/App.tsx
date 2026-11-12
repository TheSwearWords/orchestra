import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Project, StudioLayout } from '../../preload'
import { Create } from './components/Create'
import { Icon } from './components/Icon'
import { Research } from './components/Research'
import { Board } from './canvas/Board'
import { Book, type Frame } from './canvas/Book'
import { Landscape } from './canvas/Landscape'
import { AreaSwitch } from './canvas/Chrome'
import { Tabs } from './canvas/Tabs'
import { DRAFT, closeTab, moveTab, openTab } from './canvas/tabList'
import { STUDIO, TOP_BAR, chip, coverInfo, requestFocus, type Area } from './canvas/shared'
import { SessionDock } from './canvas/SessionDock'
import { CoverEditor } from './canvas/CoverEditor'
import { Opening } from './canvas/Opening'
import { OrchestratorBar, type BarTarget } from './canvas/OrchestratorBar'
import { Studio } from './canvas/Studio'
import { Setup } from './canvas/Setup'

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

// Where you are: the Studio, inside a book (on one of its areas, or the whole book), or a cover
// being made or edited. Back and forward step through these.
type View =
  | { at: 'studio' }
  | { at: 'book'; id: string; area: Area | null }
  | { at: 'cover'; id: string | null }

/** A window opened on a project (#project=…) starts inside that book; otherwise the Studio. */
function startingView(): View {
  const id = new URLSearchParams(location.hash.slice(1)).get('project')
  return id ? { at: 'book', id, area: null } : { at: 'studio' }
}

const shelfRect = (id: string): DOMRect | undefined =>
  document.querySelector(`[data-cover="${CSS.escape(id)}"]`)?.getBoundingClientRect()

/** Setup has no projects yet: Home alone in the header, lit. */
function SetupHome(): React.JSX.Element {
  const none = (): void => {}
  return (
    <Tabs
      projects={[]}
      tabs={[]}
      areas={{}}
      active={null}
      bare
      onHome={none}
      onTab={none}
      onClose={none}
      onMove={none}
      onNew={none}
    />
  )
}

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [layout, setLayout] = useState<StudioLayout | null>(null)
  const [setUp, setSetUp] = useState<boolean | null>(null) // first-time setup finished
  const [view, setView] = useState<View>(startingView)
  const [history, setHistory] = useState<{ back: View[]; forward: View[] }>({
    back: [],
    forward: []
  })
  // the area each book was last left on: its cover's ribbon, and where it opens next time
  const [areas, setAreas] = useState<Record<string, Area | null>>(() => rememberedJson('areas', {}))
  // the header's tabs: the books open in this window, in the order they were opened
  // shortcut: one remembered list shared by every window; upgrade when windows need their own
  const [tabs, setTabs] = useState<string[]>(() => {
    const v = startingView()
    if (v.at === 'book') return [v.id]
    // the old tab strip kept a differently shaped value under 'tabs', so this list has its own key
    const saved = rememberedJson<unknown>('open-tabs', [])
    return Array.isArray(saved) ? saved.filter((t): t is string => typeof t === 'string') : []
  })
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
          v.at !== 'studio' && v.id && !list.some((p) => p.id === v.id) ? { at: 'studio' } : v
        )
      }),
    []
  )

  useEffect(() => {
    refresh()
    void window.api.loadStudio().then(setLayout)
    void window.api.loadSetup().then((s) => setSetUp(s.setup.done))
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

  useEffect(() => remember('areas', areas), [areas])

  useEffect(() => remember('open-tabs', tabs), [tabs])

  const current = view.at === 'book' ? projects?.find((p) => p.id === view.id) : undefined
  useEffect(() => {
    document.title = current ? `${current.name} · Orchestra` : 'Orchestra' // names each window
  }, [current])

  /** Shows a view. Between the Studio and a book it plays the opening (or the closing). */
  const show = useCallback((from: View, to: View): void => {
    if (to.at === 'book') setAreas((all) => ({ ...all, [to.id]: to.area }))
    if (to.at === 'book') setTabs((t) => openTab(t, to.id))
    const enteringBook = from.at !== 'book' && to.at === 'book'
    const leavingBook = from.at === 'book' && to.at === 'studio'
    const id = enteringBook ? (to as { id: string }).id : leavingBook ? from.id : null
    const shelf = id ? shelfRect(id) : undefined
    if (id && shelf && from.at !== 'cover')
      return setOpening({ id, shelf, dir: enteringBook ? 'open' : 'close', then: to })
    setView(to)
  }, [])
  // the latest view and history, for the listeners below
  const now = useRef({ view, history })
  useLayoutEffect(() => {
    now.current = { view, history }
  })

  /** Goes somewhere new: the place you were becomes the one Back returns to. */
  const go = useCallback(
    (to: View): void => {
      const { view: from, history: h } = now.current
      if (JSON.stringify(from) === JSON.stringify(to)) return
      setHistory({ back: [...h.back, from].slice(-50), forward: [] })
      show(from, to)
    },
    [show]
  )
  const step = useCallback(
    (dir: 'back' | 'forward'): void => {
      const { view: from, history: h } = now.current
      const list = h[dir]
      if (!list.length) return
      const to = list[list.length - 1]
      setHistory(
        dir === 'back'
          ? { back: h.back.slice(0, -1), forward: [...h.forward, from] }
          : { forward: h.forward.slice(0, -1), back: [...h.back, from] }
      )
      show(from, to)
    },
    [show]
  )

  // Ctrl+Tab and Ctrl+Shift+Tab walk the open tabs; Ctrl+1 to 9 jump straight to one
  useEffect(() => {
    const keys = (e: KeyboardEvent): void => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return
      const open = tabs.filter((id) => projects?.some((p) => p.id === id))
      const v = now.current.view
      const i = v.at === 'book' ? open.indexOf(v.id) : -1
      let n = -1
      if (e.key === 'Tab' && open.length)
        n =
          i < 0
            ? e.shiftKey
              ? open.length - 1
              : 0
            : (i + (e.shiftKey ? -1 : 1) + open.length) % open.length
      else if (/^[1-9]$/.test(e.key) && !e.shiftKey) n = Number(e.key) - 1
      if (n < 0 || n >= open.length || n === i) return
      e.preventDefault()
      go({ at: 'book', id: open[n], area: areas[open[n]] ?? null })
    }
    addEventListener('keydown', keys)
    return () => removeEventListener('keydown', keys)
  }, [tabs, projects, areas, go])

  // the mouse's back and forward buttons, and Alt+← / Alt+→
  useEffect(() => {
    const mouse = (e: MouseEvent): void => {
      if (e.button === 3 || e.button === 4) {
        e.preventDefault()
        step(e.button === 3 ? 'back' : 'forward')
      }
    }
    const keys = (e: KeyboardEvent): void => {
      if (!e.altKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
      e.preventDefault()
      step(e.key === 'ArrowLeft' ? 'back' : 'forward')
    }
    addEventListener('mouseup', mouse)
    addEventListener('keydown', keys)
    return () => {
      removeEventListener('mouseup', mouse)
      removeEventListener('keydown', keys)
    }
  }, [step])

  if (!projects || !layout || setUp === null) return <div className="bg-dots h-full" />
  if (!setUp)
    return (
      <div className="on-landscape relative h-full">
        <Landscape name="sunset" />
        <Setup onDone={() => setSetUp(true)} />
        <SetupHome />
      </div>
    )

  const saveLayout = (l: StudioLayout): void => {
    setLayout(l)
    void window.api.saveStudio(l)
  }
  const movements = Object.fromEntries(
    Object.entries(areas).flatMap(([id, a]) => (a ? [[id, a]] : []))
  ) as Record<string, Area>
  const project = (id: string | null): Project | undefined => projects.find((p) => p.id === id)
  const enter = (id: string): void => go({ at: 'book', id, area: areas[id] ?? null })

  // the bar talks to the Orchestrator of wherever you are
  const to: BarTarget = current
    ? { project: current.id, label: `To ${current.name}` }
    : { project: STUDIO, label: 'To the Studio' }

  /** A slash command picked in the bar. */
  function command(id: string): void {
    if (id === 'agents' || id === 'mcps' || id === 'graph' || id === 'settings') {
      go({ at: 'studio' })
      dispatchEvent(new CustomEvent('orchestra:desk', { detail: id }))
    } else if (id === 'studio') go({ at: 'studio' })
    else if (id === 'new') go({ at: 'cover', id: null })
    else if (id === 'needs') dispatchEvent(new Event('orchestra:needs'))
    else if (current && (id === 'research' || id === 'create' || id === 'refine'))
      go({ at: 'book', id: current.id, area: id })
  }

  function area(p: Project, a: Area, frame: Frame): React.ReactNode {
    if (a === 'research') return <Research key={p.id} project={p.id} frame={frame} />
    if (a === 'create') return <Create key={p.id} project={p.id} frame={frame} />
    return (
      <Board
        key={p.id}
        project={p.id}
        board="refine"
        label="III · Refine"
        pages={frame.pages}
        preview={frame.preview}
        cards={[
          {
            id: 'next',
            title: 'Audit and sign-off',
            x: 0,
            y: 0,
            w: 480,
            body: (
              <p className="p-5 type-body-m text-dim">
                III Refine is next on the build plan: audit pins, the scorecard, and fixes sent back
                to their seats.
              </p>
            )
          }
        ]}
      />
    )
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* the Studio stays laid out underneath, so a closing book knows where its cover sits */}
      <div
        className="on-landscape absolute inset-0"
        style={{ visibility: view.at === 'studio' ? 'visible' : 'hidden' }}
      >
        <Landscape name="sunset" />
        <Studio
          projects={projects}
          layout={layout}
          onLayout={saveLayout}
          movements={movements}
          onEnter={(id) => enter(id)}
          onEdit={(id) => go({ at: 'cover', id })}
          onNew={() => go({ at: 'cover', id: null })}
          onChanged={refresh}
          hidden={opening?.id}
        />
      </div>

      {current && view.at === 'book' && (
        <div className="absolute inset-0">
          <Book
            key={current.id}
            name={current.name}
            area={view.area}
            onArea={(a) => go({ at: 'book', id: current.id, area: a })}
            onStudio={() => go({ at: 'studio' })}
            render={(a, frame) => area(current, a, frame)}
          />
        </div>
      )}

      {view.at === 'cover' && (
        <div className="on-landscape absolute inset-0">
          <Landscape name="coast" />
          <CoverEditor
            key={view.id ?? 'new'}
            project={project(view.id) ?? null}
            no={view.id ? projects.findIndex((p) => p.id === view.id) + 1 : projects.length + 1}
            onDone={() => go({ at: 'studio' })}
            onSaved={refresh}
            onEnter={(id) => {
              go({ at: 'studio' })
              requestAnimationFrame(() => enter(id))
            }}
            onCreated={(p, open) => {
              const list = [...projects, p].sort((a, b) => a.name.localeCompare(b.name))
              setProjects(list)
              go({ at: 'studio' })
              if (open) requestAnimationFrame(() => enter(p.id))
            }}
          />
        </div>
      )}

      {/* the window's own chrome: tabs in the header, Back under it, the Orchestrator at the foot */}
      <Tabs
        projects={projects}
        tabs={tabs}
        areas={view.at === 'book' ? { ...areas, [view.id]: view.area } : areas}
        active={view.at === 'book' ? view.id : view.at === 'cover' ? DRAFT : null}
        draft={view.at === 'cover' ? (project(view.id)?.name ?? 'Untitled') : undefined}
        onHome={() => go({ at: 'studio' })}
        onTab={(id) => (id === DRAFT ? undefined : enter(id))}
        onClose={(id) => {
          if (id === DRAFT) return go({ at: 'studio' })
          const left = closeTab(tabs, id)
          setTabs(left.tabs)
          if (view.at === 'book' && view.id === id)
            go(
              left.next
                ? { at: 'book', id: left.next, area: areas[left.next] ?? null }
                : { at: 'studio' }
            )
        }}
        onMove={(id, onto) => setTabs((t) => moveTab(t, id, onto))}
        onNew={() => go({ at: 'cover', id: null })}
      />
      {/* the area switch is drawn once for the whole window, so it stays put as you change
          area and its pill can slide between them */}
      {view.at === 'book' && (
        <div className="absolute left-1/2 z-30 -translate-x-1/2" style={{ top: TOP_BAR }}>
          <AreaSwitch current={view.area} onGo={(a) => go({ at: 'book', id: view.id, area: a })} />
        </div>
      )}
      {/* Home and the tabs get you out of the Studio; Back is for inside a book */}
      {view.at !== 'studio' && (
        <button
          onClick={() => step('back')}
          disabled={history.back.length === 0}
          aria-label="Back"
          title="Back (mouse back button, Alt+←)"
          className={`${chip} glass absolute z-30 h-9 gap-2 rounded-full! px-4 type-label-m disabled:opacity-40`}
          style={{ top: TOP_BAR + 10, left: 14 }}
        >
          <Icon name="arrow-left-line" size={14} />
          Back
        </button>
      )}
      <SessionDock
        key={current?.id ?? 'studio'}
        project={current}
        onOpen={(project, card) => {
          // a question from the Orchestrator: its conversation opens, wherever you are in the book
          if (card.startsWith('chat:')) {
            const v = now.current.view
            if (!(v.at === 'book' && v.id === project))
              go({ at: 'book', id: project, area: areas[project] ?? null })
            const detail = { project, chat: card.slice(5) }
            requestAnimationFrame(() =>
              dispatchEvent(new CustomEvent('orchestra:converse', { detail }))
            )
            return
          }
          requestFocus(project, card)
          go({ at: 'book', id: project, area: 'create' })
        }}
      />
      <OrchestratorBar
        to={to}
        projects={projects}
        commands={[
          { id: 'agents', label: 'Agents', hint: 'Opens on the Studio desk' },
          { id: 'mcps', label: 'MCPs', hint: 'Opens on the Studio desk' },
          { id: 'graph', label: 'Knowledge graph', hint: 'Opens on the Studio desk' },
          { id: 'settings', label: 'Settings and providers', hint: 'Opens on the Studio desk' },
          { id: 'studio', label: 'Studio', hint: 'Every project' },
          { id: 'new', label: 'New project', hint: 'A blank cover' },
          ...(current
            ? [
                { id: 'research', label: 'I Research', hint: current.name },
                { id: 'create', label: 'II Create', hint: current.name },
                { id: 'refine', label: 'III Refine', hint: current.name },
                { id: 'needs', label: 'Needs you', hint: 'What is waiting in this project' }
              ]
            : [])
        ]}
        onCommand={command}
        onGo={(p) => go({ at: 'book', id: p.project, area: p.area })}
      />

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
