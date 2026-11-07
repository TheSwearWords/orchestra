// C1 · Studio: every project as a cover on the board, arranged however you like.
import { useEffect, useRef, useState } from 'react'
import type { Project, StudioLayout } from '../../../preload'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, snap, type Rect } from './camera'
import { COVER, ROW_Y, fitBelow, coverInfo, studioPlace, type Area, type CoverInfo } from './shared'
import { Minimap, Shell, ZoomChip, barButton } from './Chrome'
import { CoverFace } from './Cover'
import { Card, type CardSpec } from './Board'
import { settle } from './place'
import { Agents } from '../components/Agents'
import { Icon } from '../components/Icon'
import { PROVIDERS, type ProviderId } from '../../../main/providers'

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
  const ids = projects.map((p) => p.id)
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [tidying, setTidying] = useState(false)
  const place = studioPlace(layout, ids)
  const at = (id: string): [number, number, number] =>
    drag?.id === id ? [drag.x, drag.y, place[id][2]] : place[id]

  const rects: Rect[] = ids.map((id) => ({ x: at(id)[0], y: at(id)[1], w: COVER.w, h: COVER.h }))
  // the desk, under the shelf: what every project shares
  const deskY = ROW_Y + COVER.h + 120
  const desk = DESK.map((d, i) => ({ ...d, x: 96 + i * (DESK_W + 24), y: deskY }))
  const [windows, setWindows] = useState<{ id: Desk; x: number; y: number; w?: number }[]>([])
  // with no projects yet, the board still has the desk to look at
  const everything: Rect[] = [
    ...rects,
    ...desk.map((d) => ({ x: d.x, y: d.y, w: DESK_W, h: DESK_H })),
    ...windows.map((w) => ({ x: w.x, y: w.y, w: w.w ?? WINDOW[w.id].w, h: WINDOW[w.id].guess }))
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

  function openWindow(id: Desk): void {
    const d = desk.find((x) => x.id === id)!
    const spot = windows.find((w) => w.id === id) ?? { id, x: d.x, y: d.y + DESK_H + 48 }
    if (!windows.some((w) => w.id === id)) setWindows([...windows, spot])
    void cam.fly(fitBelow({ ...spot, w: WINDOW[id].w, h: WINDOW[id].guess + 44 }), 450)
  }

  function tidy(): void {
    setTidying(true)
    onLayout({ ...layout, covers: {} })
    setTimeout(() => setTidying(false), 460)
  }

  async function menu(p: Project, el: HTMLElement): Promise<void> {
    const choice = await window.api.projectMenu(p.id, p.name)
    if (choice === 'enter') onEnter(p.id, el.getBoundingClientRect())
    if (choice === 'edit') onEdit(p.id)
    if (choice === 'deleted') onChanged()
  }

  return (
    <Canvas
      cam={cam}
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
          crumbs={[{ label: 'Studio' }]}
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
          pages={
            <div className="pointer-events-none text-link">
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
          <button
            onClick={onNew}
            className="group absolute right-3.5 bottom-[176px] z-10 flex h-[220px] w-[168px] flex-col items-center justify-center gap-2 border border-dashed border-wire bg-card px-3 text-center text-link shadow-book transition-transform duration-200 ease-(--ease) hover:-translate-y-1 [border-dasharray:6]"
          >
            <span className="font-mono text-2xl text-link/40">+</span>
            <span className="serif-on type-heading-m">New project</span>
            <span className="type-caption text-dim">A blank cover. Fill it in.</span>
          </button>
        </Shell>
      }
    >
      {projects.map((p) => (
        <ShelfCover
          key={p.id}
          info={coverInfo(p, projects)}
          at={at(p.id)}
          z={cam.camera.z}
          tidying={tidying}
          hidden={hidden === p.id}
          movement={movements[p.id]}
          onDrag={(x, y) => setDrag({ id: p.id, x, y })}
          onDrop={(x, y) => {
            setDrag(null)
            onLayout({
              ...layout,
              covers: { ...place, ...layout.covers, [p.id]: [snap(x), snap(y), place[p.id][2]] }
            })
          }}
          onEnter={(el) => onEnter(p.id, el.getBoundingClientRect())}
          onEdit={() => onEdit(p.id)}
          onMenu={(el) => void menu(p, el)}
        />
      ))}

      {desk.map((d) => (
        <button
          key={d.id}
          onClick={() => openWindow(d.id)}
          aria-pressed={windows.some((w) => w.id === d.id)}
          className={`absolute flex flex-col items-start gap-1 border border-card-line bg-card p-4 text-left text-link shadow-card transition-colors duration-200 ease-(--ease) hover:bg-selected ${
            windows.some((w) => w.id === d.id) ? 'outline-2 outline-offset-4 outline-brand' : ''
          }`}
          style={{ left: d.x, top: d.y, width: DESK_W, height: DESK_H }}
        >
          <span className="flex size-10 items-center justify-center rounded-full bg-brand text-on-brand">
            <Icon name={d.icon} size={20} />
          </span>
          <span className="mt-2 type-heading-m">{d.name}</span>
          <span className="type-caption text-dim">{d.note}</span>
        </button>
      ))}
      {settle(
        windows.map((w) => ({ ...w, w: w.w ?? WINDOW[w.id].w, h: WINDOW[w.id].guess })),
        [...rects, ...desk.map((d) => ({ x: d.x, y: d.y, w: DESK_W, h: DESK_H }))]
      ).map((w) => (
        <Card
          key={w.id}
          card={{
            ...WINDOW[w.id],
            w: w.w,
            id: w.id,
            x: w.x,
            y: w.y,
            onClose: () => setWindows(windows.filter((o) => o.id !== w.id)),
            body: w.id === 'agents' ? <Agents /> : w.id === 'mcps' ? <Connections /> : <Settings />
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
  onDrag: (x: number, y: number) => void
  onDrop: (x: number, y: number) => void
  onEnter: (el: HTMLElement) => void
  onEdit: () => void
  onMenu: (el: HTMLElement) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const timer = useRef(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  function down(e: React.PointerEvent): void {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return
    e.stopPropagation()
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
        setOpen(false)
        clearTimeout(timer.current)
      }
      onDrag(start.x + dx, start.y + dy)
    }
    const up = (u: PointerEvent): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setDragging(false)
      if (moved) onDrop(start.x + (u.clientX - start.sx) / z, start.y + (u.clientY - start.sy) / z)
      else if (ref.current) onEnter(ref.current) // a click opens the book
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  return (
    <div
      ref={ref}
      data-cover={info.id}
      onPointerDown={down}
      onPointerEnter={() => {
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setOpen(true), 250)
      }}
      onPointerLeave={() => {
        clearTimeout(timer.current)
        setOpen(false)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMenu(e.currentTarget)
      }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
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
      </div>
      <button className="sr-only" onClick={() => ref.current && onEnter(ref.current)}>
        Open {info.name}
      </button>
    </div>
  )
}

type Desk = 'agents' | 'mcps' | 'settings'
const DESK_W = 216
const DESK_H = 156
const DESK: { id: Desk; name: string; note: string; icon: string }[] = [
  { id: 'agents', name: 'Agents', note: 'The Ensemble: who plays what', icon: 'team-line' },
  { id: 'mcps', name: 'MCPs', note: 'Providers and the tools agents use', icon: 'shapes-line' },
  { id: 'settings', name: 'Settings', note: 'You, and this machine', icon: 'settings-3-line' }
]
// the windows the desk opens, on the board below it
// shortcut: their places last for the session only; save them in studio.json if people move them
// (guess: about how tall each grows, for bringing it into view)
const WINDOW: Record<Desk, Omit<CardSpec, 'id' | 'x' | 'y' | 'body'> & { guess: number }> = {
  agents: { title: 'Agents · the Ensemble', w: 1152, guess: 1100 },
  mcps: { title: 'MCPs and providers', w: 528, guess: 360 },
  settings: { title: 'Settings', w: 480, guess: 160 }
}

/** Who agents can run on, and the tool servers they can reach. */
function Connections(): React.JSX.Element {
  const [status, setStatus] = useState<Record<
    ProviderId,
    { connected: boolean; via: string }
  > | null>(null)
  useEffect(() => {
    void window.api.providerStatus().then(setStatus, () => {})
  }, [])
  return (
    <div className="p-5">
      <h3 className="type-label-mono text-link">Providers</h3>
      <ul className="mt-2 divide-y divide-hair">
        {PROVIDERS.map((p) => {
          const s = status?.[p.id]
          return (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3">
              <span>
                <span className="block type-body-m-strong text-link">{p.name}</span>
                <span className="type-caption text-dim">{s?.via ?? '…'}</span>
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 type-label-s ${s?.connected ? 'bg-success-subtle text-success-fg' : 'border border-dashed border-wire text-link'}`}
              >
                {s?.connected ? 'Connected' : 'Not connected'}
              </span>
            </li>
          )
        })}
      </ul>
      <h3 className="mt-5 type-label-mono text-link">MCP servers</h3>
      <p className="mt-2 type-body-s text-dim">
        Figma first, then Blender and Fusion: connecting tool servers for agents is next on the
        build plan. Until then agents work in files.
      </p>
    </div>
  )
}

function Settings(): React.JSX.Element {
  return (
    <div className="p-5">
      <p className="type-body-s text-dim">
        Theme, account and shortcuts come here. For now: / jumps to the Orchestrator, Esc steps out,
        1 2 3 move between the movements, and the mouse&apos;s back and forward buttons retrace your
        steps.
      </p>
    </div>
  )
}
