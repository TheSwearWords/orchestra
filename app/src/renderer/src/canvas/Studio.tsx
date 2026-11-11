// C1 · Studio: every project as a cover on the board, arranged however you like.
import { useEffect, useRef, useState } from 'react'
import type { Project, StudioLayout } from '../../../preload'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, snap, type Rect } from './camera'
import {
  AgentFileOpener,
  type AgentFileRef,
  COVER,
  ROW_Y,
  fitBelow,
  coverInfo,
  studioPlace,
  type Area,
  type CoverInfo
} from './shared'
import { Minimap, NewCard, Shell, ZoomChip, barButton } from './Chrome'
import { popMenu } from './shared'
import { CoverFace } from './Cover'
import { BookStatus } from './BookStatus'
import { useNeeds } from './NeedsYou'
import { Card, type CardSpec } from './Board'
import { freeSpot, separate, settle, touches } from './place'
import { GroupLabel } from './GroupLabel'
import { AgentFile, Agents } from '../components/Agents'
import { Knowledge } from './Knowledge'
import { Icon } from '../components/Icon'
import { McpSettings } from './McpSettings'
import { ProviderSettings } from './ProviderSettings'

interface Props {
  projects: Project[]
  layout: StudioLayout
  onLayout: (l: StudioLayout) => void
  movements: Record<string, Area>
  onEnter: (id: string, from: DOMRect) => void
  onEdit: (id: string) => void
  onNew: () => void
  onChanged: () => void // a project was deleted
  hidden?: string // a cover that is out on an animation; leave its spot empty
}

export function Studio({
  projects,
  layout,
  onLayout,
  movements,
  onEnter,
  onEdit,
  onNew,
  onChanged,
  hidden
}: Props): React.JSX.Element {
  // grouped projects first, so the default row keeps each group's covers side by side
  const groups = (layout.groups ?? []).map((g) => ({
    ...g,
    ids: g.ids.filter((id) => projects.some((p) => p.id === id))
  }))
  const grouped = groups.flatMap((g) => g.ids)
  const ids = [...grouped, ...projects.map((p) => p.id).filter((id) => !grouped.includes(id))]
  const needs = useNeeds(projects)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [tidying, setTidying] = useState(false)
  const place = studioPlace(layout, ids)
  const [hovered, setHovered] = useState<string | null>(null) // the book the pointer is on
  const [selected, setSelected] = useState<string[]>([])
  const [opened, setOpened] = useState<string | null>(null) // the one cover swung open
  const [moving, setMoving] = useState<{ name: string; dx: number; dy: number } | null>(null)
  const with_ = (id: string): boolean => selected.length > 1 && selected.includes(id)
  // one group's frame never lands on another's, or on a cover that isn't in it
  const inGroup = new Set(groups.flatMap((g) => g.ids))
  const shifts = separate([
    ...groups
      .filter((g) => g.ids.length > 0)
      .map((g) => {
        const xs = g.ids.map((id) => place[id][0])
        const ys = g.ids.map((id) => place[id][1])
        const x = Math.min(...xs) - 28
        const y = Math.min(...ys) - 28
        return {
          ids: g.ids,
          rect: {
            x,
            y,
            w: Math.max(...xs) + COVER.w + 28 - x,
            h: Math.max(...ys) + COVER.h + 28 - y
          }
        }
      }),
    ...ids
      .filter((id) => !inGroup.has(id))
      .map((id) => ({
        ids: [id],
        rect: { x: place[id][0], y: place[id][1], ...COVER },
        fixed: true
      }))
  ])
  const at = (id: string): [number, number, number] => {
    if (drag?.id === id) return [drag.x, drag.y, place[id][2]]
    if (shifts[id] && !moving)
      return [place[id][0] + shifts[id].dx, place[id][1] + shifts[id].dy, place[id][2]]
    if (moving && groups.find((g) => g.name === moving.name)?.ids.includes(id))
      return [place[id][0] + moving.dx, place[id][1] + moving.dy, place[id][2]]
    if (drag && with_(id) && with_(drag.id))
      return [
        place[id][0] + drag.x - place[drag.id][0],
        place[id][1] + drag.y - place[drag.id][1],
        place[id][2]
      ]
    return place[id]
  }

  const rects: Rect[] = ids.map((id) => ({ x: at(id)[0], y: at(id)[1], w: COVER.w, h: COVER.h }))
  // the desk, under the shelf: what every project shares
  const deskY = ROW_Y + COVER.h + 120
  // each button sits over the window it opens, with room for that window. Agents is too wide for
  // that to stay a tight row, so its window opens leftward from under its button instead.
  const slot: Record<Desk, number> = {
    agents: DESK_W,
    mcps: WINDOW.mcps.w,
    graph: GRAPH_W,
    settings: WINDOW.settings.w
  }
  const desk = DESK.map((d, i) => ({
    ...d,
    x: 96 + DESK.slice(0, i).reduce((sum, o) => sum + slot[o.id] + 72, 0),
    y: deskY
  }))
  // the knowledge graph, always open, under its button
  const [graphWindow, setGraphWindow] = useState({
    x: desk.find((d) => d.id === 'graph')!.x,
    y: snap(deskY + DESK_H + 48),
    w: GRAPH_W,
    collapsed: false
  })
  const [graphExpanded, setGraphExpanded] = useState(false)
  const [graphH, setGraphH] = useState(528)
  const graphRect = {
    x: graphWindow.x,
    y: graphWindow.y,
    w: graphExpanded ? GRAPH_WIDE : graphWindow.w,
    h: graphWindow.collapsed ? 44 : graphH
  }
  // the desk's windows, and agent files opened from the Agents window (id "file-<role>-<id>")
  const [windows, setWindows] = useState<
    { id: string; x: number; y: number; w?: number; file?: AgentFileRef }[]
  >([])
  const [flyTo, setFlyTo] = useState<string>()
  const look = (w: { id: string; file?: AgentFileRef }): (typeof WINDOW)[Desk] =>
    w.file ? { title: `${w.file.name} · file`, w: 760, guess: 900 } : WINDOW[w.id as Desk]
  function openFile(f: AgentFileRef): void {
    const id = `file-${f.role}-${f.id}`
    const agents = windows.find((o) => o.id === 'agents')
    const spot = windows.find((o) => o.id === id) ?? {
      id,
      file: f,
      x: agents ? agents.x + (agents.w ?? WINDOW.agents.w) + 48 : 96,
      y: agents ? agents.y : deskY + DESK_H + 48
    }
    if (!windows.some((o) => o.id === id)) setWindows([...windows, spot])
    setFlyTo(id)
  }
  // with no projects yet, the board still has the desk to look at
  const everything: Rect[] = [
    ...rects,
    ...desk.map((d) => ({ x: d.x, y: d.y, w: DESK_W, h: DESK_H })),
    ...windows.map((w) => ({ x: w.x, y: w.y, w: w.w ?? look(w).w, h: look(w).guess })),
    graphRect
  ]
  const bounds = (): Rect => {
    const x = Math.min(...everything.map((r) => r.x))
    const y = Math.min(...everything.map((r) => r.y))
    return {
      x,
      y,
      w: Math.max(...everything.map((r) => r.x + r.w)) - x,
      h: Math.max(...everything.map((r) => r.y + r.h)) - y
    }
  }
  const cam = useCamera(fit(bounds(), innerWidth, innerHeight, 120, 1))

  function expandGraph(on: boolean): void {
    setGraphExpanded(on)
    setGraphWindow((g) => ({ ...g, collapsed: false }))
    if (on) void cam.fly(fitBelow({ ...graphRect, w: GRAPH_WIDE, h: 1100 }, 1), 450)
  }
  function openWindow(id: Desk): void {
    // the graph already has its window on the board: this opens it up
    if (id === 'graph') return expandGraph(true)
    const d = desk.find((x) => x.id === id)!
    const spot = windows.find((w) => w.id === id) ?? {
      id,
      x: id === 'agents' ? d.x + DESK_W - WINDOW.agents.w : d.x,
      y: d.y + DESK_H + 48
    }
    if (!windows.some((w) => w.id === id)) setWindows([...windows, spot])
    setFlyTo(id)
  }
  // where windows really land, clear of everything else; the camera goes to that spot
  const settled = settle(
    windows.map((w) => ({ ...w, w: w.w ?? look(w).w, h: look(w).guess })),
    [...rects, ...desk.map((d) => ({ x: d.x, y: d.y, w: DESK_W, h: DESK_H })), graphRect]
  )
  useEffect(() => {
    const w = settled.find((o) => o.id === flyTo)
    if (!w) return
    void cam.fly(fitBelow({ x: w.x, y: w.y, w: w.w, h: w.h + 44 }), 450)
    setFlyTo(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly once per opened window
  }, [flyTo])
  // "/agents", "/mcps" and "/settings" in the bar open these from anywhere
  const opener = useRef<(id: Desk) => void>(() => {})
  useEffect(() => {
    opener.current = openWindow
  })
  useEffect(() => {
    const open = (e: Event): void => opener.current((e as CustomEvent<Desk>).detail)
    addEventListener('orchestra:desk', open)
    return () => removeEventListener('orchestra:desk', open)
  }, [])

  function tidy(): void {
    setTidying(true)
    onLayout({ ...layout, covers: {} })
    setTimeout(() => setTidying(false), 460)
  }

  /** Files projects under a group (none takes them out), covers moved in beside the others. */
  function fileUnder(moving: string[], name: string | null, made: boolean): void {
    const rest = groups.map((g) => ({ ...g, ids: g.ids.filter((x) => !moving.includes(x)) }))
    const next = made ? [...rest, { name: name!, ids: [] as string[] }] : rest
    const into = next.find((g) => g.name === name)
    const covers = { ...place, ...layout.covers }
    for (const id of moving) {
      const peers = into?.ids ?? []
      if (peers.length) {
        const last = Math.max(...peers.map((x) => covers[x][0]))
        const y = covers[peers[0]][1]
        const taken = ids
          .filter((x) => x !== id)
          .map((x) => ({ x: covers[x][0], y: covers[x][1], ...COVER }))
        const spot = freeSpot({ x: last + COVER.w + 72, y, ...COVER }, taken)
        covers[id] = [snap(spot.x), snap(spot.y), covers[id][2]]
      }
      into?.ids.push(id)
    }
    setSelected([])
    onLayout({ ...layout, covers, groups: next.filter((g) => g.ids.length > 0) })
  }
  function renameGroup(from: string, to: string): void {
    if (groups.some((g) => g.name === to)) return
    onLayout({ ...layout, groups: groups.map((g) => (g.name === from ? { ...g, name: to } : g)) })
  }

  async function menu(p: Project, el: HTMLElement): Promise<void> {
    const moving = with_(p.id) ? selected : [p.id]
    const mine = groups.find((g) => g.ids.includes(p.id))
    const choice = await window.api.projectMenu(p.id, p.name, [
      {
        id: 'new',
        label: moving.length > 1 ? `New group with ${moving.length} projects` : 'New group'
      },
      ...groups
        .filter((g) => g !== mine)
        .map((g) => ({ id: `to:${g.name}`, label: `Add to ${g.name}` })),
      ...(mine ? [{ id: 'out', label: `Remove from ${mine.name}` }] : [])
    ])
    if (choice === 'group:new') {
      let name = 'New group'
      for (let n = 2; groups.some((g) => g.name === name); n++) name = `New group ${n}`
      fileUnder(moving, name, true)
    }
    if (choice === 'group:out') fileUnder(moving, null, false)
    if (choice?.startsWith('group:to:')) fileUnder(moving, choice.slice(9), false)
    if (choice === 'enter') onEnter(p.id, el.getBoundingClientRect())
    if (choice === 'edit') onEdit(p.id)
    if (choice === 'deleted') onChanged()
  }

  return (
    <Canvas
      cam={cam}
      content={() => ({ all: bounds() })}
      onPress={() => {
        setSelected([])
        setOpened(null)
      }}
      onMarquee={(r) =>
        setSelected(ids.filter((id) => touches({ x: place[id][0], y: place[id][1], ...COVER }, r)))
      }
      onContextMenu={async () => {
        const c = await window.api.menu([
          { id: 'new', label: 'New project' },
          { id: 'tidy', label: 'Tidy', enabled: Object.keys(layout.covers).length > 0 }
        ])
        if (c === 'new') onNew()
        if (c === 'tidy') tidy()
      }}
      chrome={
        <Shell
          right={
            <>
              {Object.keys(layout.covers).length > 0 && (
                <button onClick={tidy} className={barButton}>
                  Tidy
                </button>
              )}
              <ZoomChip
                camera={cam.camera}
                viewport={cam.viewport}
                onZoom={(c) => void cam.fly(c, 200)}
              />
            </>
          }
          corner={
            <div className="pointer-events-none text-link max-[1200px]:hidden">
              <p className="type-label-s">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'} · drag to arrange
              </p>
              <p className="type-display-xl">Studio</p>
            </div>
          }
          minimap={
            <Minimap
              label="Studio"
              blocks={everything}
              camera={cam.camera}
              viewport={cam.viewport}
              onMove={cam.set}
            />
          }
        >
          {/* the blank cover, pinned bottom right, standing a clear gap above the minimap */}
          <NewCard title="New project" hint="A blank cover. Fill it in." onClick={onNew} />
        </Shell>
      }
    >
      {groups
        .filter((g) => g.ids.length > 0)
        .map((g) => {
          const xs = g.ids.map((id) => at(id)[0])
          const ys = g.ids.map((id) => at(id)[1])
          const pad = 28
          const x = Math.min(...xs) - pad
          const y = Math.min(...ys) - pad
          return (
            <div
              key={g.name}
              className="pointer-events-none absolute border border-brand/40 bg-brand/5"
              style={{
                left: x,
                top: y,
                width: Math.max(...xs) + COVER.w + pad - x,
                height: Math.max(...ys) + COVER.h + pad - y
              }}
            >
              <GroupLabel
                name={g.name}
                z={cam.camera.z}
                onRename={(to) => renameGroup(g.name, to)}
                onDrag={(dx, dy) => setMoving({ name: g.name, dx, dy })}
                onDrop={(dx, dy) => {
                  setMoving(null)
                  const covers = { ...place, ...layout.covers }
                  for (const id of g.ids)
                    covers[id] = [snap(place[id][0] + dx), snap(place[id][1] + dy), place[id][2]]
                  onLayout({ ...layout, covers })
                }}
              />
            </div>
          )
        })}
      {projects.map((p) => (
        <ShelfCover
          key={p.id}
          info={coverInfo(p, projects)}
          at={at(p.id)}
          z={cam.camera.z}
          tidying={tidying}
          hidden={hidden === p.id}
          movement={movements[p.id]}
          needs={needs.filter((n) => n.project === p.id).length}
          open={opened === p.id}
          onHover={(on) => setHovered(on ? p.id : null)}
          onClick={() => {
            setSelected([])
            setOpened((o) => (o === p.id ? null : p.id))
          }}
          onShift={() => {
            // the open one joins the selection and closes, so what you can see is what's picked
            setSelected((s) => {
              const base = opened && !s.includes(opened) ? [...s, opened] : s
              return base.includes(p.id) ? base.filter((x) => x !== p.id) : [...base, p.id]
            })
            setOpened(null)
          }}
          onDrag={(x, y) => setDrag({ id: p.id, x, y })}
          onDrop={(x, y) => {
            setDrag(null)
            const moved = with_(p.id) ? selected : [p.id]
            const dx = x - place[p.id][0]
            const dy = y - place[p.id][1]
            const covers = { ...place, ...layout.covers }
            for (const id of moved)
              covers[id] = [snap(place[id][0] + dx), snap(place[id][1] + dy), place[id][2]]
            onLayout({ ...layout, covers })
          }}
          onEnter={(el) => onEnter(p.id, el.getBoundingClientRect())}
          onEdit={() => onEdit(p.id)}
          onMenu={(el) => void menu(p, el)}
        />
      ))}

      {selected.length > 0 &&
        (() => {
          const xs = selected.map((id) => at(id)[0])
          const ys = selected.map((id) => at(id)[1])
          const pad = 16
          const x = Math.min(...xs) - pad
          const y = Math.min(...ys) - pad
          return (
            <div
              className="pointer-events-none absolute z-10 border-2 border-brand"
              style={{
                left: x,
                top: y,
                width: Math.max(...xs) + COVER.w + pad - x,
                height: Math.max(...ys) + COVER.h + pad - y
              }}
            >
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() =>
                  void popMenu([
                    {
                      label: 'New group',
                      run: () => {
                        let name = 'New group'
                        for (let n = 2; groups.some((g) => g.name === name); n++)
                          name = `New group ${n}`
                        fileUnder(selected, name, true)
                      }
                    },
                    ...groups.map((g) => ({
                      label: `Add to ${g.name}`,
                      run: () => fileUnder(selected, g.name, false)
                    }))
                  ])
                }
                className="serif-on pointer-events-auto absolute top-full left-0 mt-2 h-9 origin-top-left bg-brand px-3 type-label-s whitespace-nowrap text-on-brand hover:bg-inverse"
                style={{ transform: `scale(${1 / cam.camera.z})` }}
              >
                Add to group
              </button>
            </div>
          )
        })()}

      {desk.map((d) => (
        <button
          key={d.id}
          onClick={() => openWindow(d.id)}
          aria-pressed={windows.some((w) => w.id === d.id) || (d.id === 'graph' && graphExpanded)}
          className={`absolute flex flex-col items-start gap-1 rounded-lg border border-card-line bg-card p-4 text-left text-link shadow-card transition-colors duration-200 ease-(--ease) hover:bg-selected ${
            windows.some((w) => w.id === d.id) ? 'outline-2 outline-offset-4 outline-brand' : ''
          }`}
          style={{ left: d.x, top: d.y, width: DESK_W, height: DESK_H }}
        >
          <span
            className={`orb ${DESK_ORB[d.id]} flex size-7 items-center justify-center rounded-full bg-brand text-on-brand`}
          >
            <Icon name={d.icon} size={16} />
          </span>
          <span className="mt-2 type-heading-m">{d.name}</span>
          <span className="type-caption text-dim">{d.note}</span>
        </button>
      ))}
      <Card
        card={{
          id: 'live-graph',
          title: 'Knowledge graph',
          ...graphWindow,
          w: graphRect.w,
          body: (
            <Knowledge
              projects={projects}
              hovered={hovered}
              expanded={graphExpanded}
              onExpand={expandGraph}
            />
          )
        }}
        onHeight={setGraphH}
        z={cam.camera.z}
        tidying={tidying}
        onMove={(x, y) => setGraphWindow((g) => ({ ...g, x, y }))}
        onResize={(w) => !graphExpanded && setGraphWindow((g) => ({ ...g, w }))}
        onCollapse={() => setGraphWindow((g) => ({ ...g, collapsed: !g.collapsed }))}
      />
      {settled.map((w) => (
        <Card
          key={w.id}
          card={{
            ...look(w),
            w: w.w,
            id: w.id,
            x: w.x,
            y: w.y,
            onClose: () => setWindows(windows.filter((o) => o.id !== w.id)),
            body: w.file ? (
              <AgentFile file={w.file} />
            ) : w.id === 'agents' ? (
              <AgentFileOpener.Provider value={openFile}>
                <Agents />
              </AgentFileOpener.Provider>
            ) : w.id === 'mcps' ? (
              <McpSettings />
            ) : (
              <Settings />
            )
          }}
          z={cam.camera.z}
          tidying={false}
          onMove={(x, y) => setWindows(windows.map((o) => (o.id === w.id ? { ...o, x, y } : o)))}
          onResize={(width) =>
            setWindows(windows.map((o) => (o.id === w.id ? { ...o, w: width } : o)))
          }
          onCollapse={() => {}}
        />
      ))}
    </Canvas>
  )
}

/** One cover on the shelf. Drag to move; hover a moment and it swings open on its spine. */
function ShelfCover({
  info,
  at: [x, y, rot],
  z,
  tidying,
  hidden,
  movement,
  needs,
  open,
  onHover,
  onClick,
  onShift,
  onDrag,
  onDrop,
  onEnter,
  onEdit,
  onMenu
}: {
  info: CoverInfo
  at: [number, number, number]
  z: number
  tidying: boolean
  hidden: boolean
  movement?: Area
  needs: number // what is waiting on you in this project: an orange tag on the cover
  open: boolean
  onHover: (on: boolean) => void
  onClick: () => void
  onShift: () => void
  onDrag: (x: number, y: number) => void
  onDrop: (x: number, y: number) => void
  onEnter: (el: HTMLElement) => void
  onEdit: () => void
  onMenu: (el: HTMLElement) => void
}): React.JSX.Element {
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const lastClick = useRef(0)

  function down(e: React.PointerEvent): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.stopPropagation()
    if (e.shiftKey) return onShift()
    const start = { sx: e.clientX, sy: e.clientY, x, y }
    let moved = false
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const move = (m: PointerEvent): void => {
      const dx = (m.clientX - start.sx) / z
      const dy = (m.clientY - start.sy) / z
      if (!moved && Math.hypot(dx * z, dy * z) < 4) return
      if (!moved) {
        moved = true
        setDragging(true)
      }
      onDrag(start.x + dx, start.y + dy)
    }
    const up = (u: PointerEvent): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setDragging(false)
      if (moved) onDrop(start.x + (u.clientX - start.sx) / z, start.y + (u.clientY - start.sy) / z)
      else if (performance.now() - lastClick.current < 350 && ref.current) onEnter(ref.current)
      else {
        lastClick.current = performance.now()
        onClick() // a click swings the cover open, onto Enter and Edit; a second goes in
      }
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={ref}
      data-cover={info.id}
      onPointerDown={down}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMenu(e.currentTarget)
      }}
      className={`absolute cursor-pointer [perspective:1400px] ${hidden ? 'invisible' : ''} ${dragging ? 'z-10' : ''}`}
      style={{
        width: COVER.w,
        height: COVER.h,
        transform: `translate(${x}px, ${y}px) rotate(${dragging ? rot - 0.6 : rot}deg)`,
        transition: tidying ? 'transform 450ms var(--ease)' : undefined
      }}
    >
      {/* the first page, under the cover */}
      <div className="absolute inset-0 flex flex-col items-end justify-end gap-2 border border-card-line bg-card p-4 shadow-book">
        {open && <BookStatus project={info.id} />}
        <button
          tabIndex={open ? 0 : -1}
          onClick={() => ref.current && onEnter(ref.current)}
          className="serif-on h-10 w-[150px] bg-brand type-label-s text-on-brand hover:bg-inverse"
        >
          Enter project
        </button>
        <button
          tabIndex={open ? 0 : -1}
          onClick={onEdit}
          className="serif-on h-10 w-[150px] border-[1.5px] border-brand type-label-s text-link hover:bg-brand hover:text-on-brand"
        >
          Edit project
        </button>
      </div>
      <div
        className={`absolute inset-0 origin-left transition-transform duration-300 ease-(--ease) ${dragging ? 'shadow-lift' : 'shadow-book'}`}
        // the spec's 35° hides the page's buttons behind the cover; it opens further, to 70°
        style={{ transform: open ? 'rotateY(-70deg)' : undefined }}
      >
        <CoverFace info={info} movement={movement} />
        {needs > 0 && (
          <span className="absolute -top-[22px] right-2 bg-needs-you px-2 py-0.5 type-label-s text-on-needs-you">
            Needs you · {needs}
          </span>
        )}
      </div>
      <button className="sr-only" onClick={() => ref.current && onEnter(ref.current)}>
        Open {info.name}
      </button>
    </div>
  )
}

type Desk = 'agents' | 'mcps' | 'graph' | 'settings'
const DESK_W = 216
// each desk tool's light, from the Nocturne gradient set
const DESK_ORB: Record<Desk, string> = {
  agents: 'orb-pink',
  mcps: 'orb-green',
  graph: 'orb-blue',
  settings: 'orb-peach'
}
const GRAPH_W = 656
const GRAPH_WIDE = 1344 // the Knowledge window, expanded
const DESK_H = 156
const DESK: { id: Desk; name: string; note: string; icon: string }[] = [
  { id: 'agents', name: 'Agents', note: 'The Ensemble: who plays what', icon: 'team-line' },
  { id: 'mcps', name: 'MCPs', note: 'The tools agents use', icon: 'shapes-line' },
  {
    id: 'graph',
    name: 'Knowledge graph',
    note: 'What your work keeps coming back to',
    icon: 'layout-grid-line'
  },
  { id: 'settings', name: 'Settings', note: 'Providers, and this machine', icon: 'settings-3-line' }
]
// the windows the desk opens, on the board below it
// shortcut: their places last for the session only; save them in studio.json if people move them
// (guess: about how tall each grows, for bringing it into view)
const WINDOW: Record<Desk, Omit<CardSpec, 'id' | 'x' | 'y' | 'body'> & { guess: number }> = {
  agents: { title: 'Agents · the Ensemble', w: 1152, guess: 1100 },
  mcps: { title: 'MCPs', w: 528, guess: 860 },
  graph: { title: 'Knowledge graph', w: 704, guess: 1100 },
  settings: { title: 'Settings', w: 480, guess: 480 }
}

function Settings(): React.JSX.Element {
  return (
    <div className="p-5">
      <ProviderSettings />
      <h3 className="mt-5 type-label-mono text-link">Shortcuts</h3>
      <p className="mt-2 type-body-s text-dim">
        Theme, account and shortcuts come here. For now: / jumps to the Orchestrator, Esc steps out,
        1 2 3 move between the movements, and the mouse&apos;s back and forward buttons retrace your
        steps.
      </p>
    </div>
  )
}
