// C1 · Studio: every project as a cover on the board, arranged however you like.
import { useEffect, useRef, useState } from 'react'
import type { Project, StudioLayout } from '../../../preload'
import { Canvas } from './Canvas'
import { useCamera } from './useCamera'
import { fit, snap, type Rect } from './camera'
import { COVER, GAP, ROW_Y, chip, coverInfo, studioPlace, type Area, type CoverInfo } from './board'
import { Breadcrumb, Minimap, ZoomChip } from './Chrome'
import { CoverFace } from './Cover'

interface Props {
  projects: Project[]
  layout: StudioLayout
  onLayout: (l: StudioLayout) => void
  movements: Record<string, Area>
  onEnter: (id: string, from: DOMRect) => void
  onEdit: (id: string) => void
  onNew: () => void
  onEnsemble: () => void
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
  onEnsemble,
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
  const blank: Rect = {
    x: Math.max(0, ...rects.map((r) => r.x + r.w)) + GAP,
    y: rects.length ? Math.min(...rects.map((r) => r.y)) : ROW_Y,
    w: COVER.w,
    h: COVER.h
  }
  const everything = [...rects, blank]
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
        <>
          <div className="absolute top-3.5 left-3.5">
            <Breadcrumb steps={[{ label: 'Studio' }]} />
          </div>
          <div className="absolute top-3.5 right-3.5 flex gap-2.5">
            <button onClick={onEnsemble} className={`${chip} serif-on px-4 type-label-s`}>
              Ensemble
            </button>
            {Object.keys(layout.covers).length > 0 && (
              <button onClick={tidy} className={`${chip} serif-on px-4 type-label-s`}>
                Tidy
              </button>
            )}
            <ZoomChip
              camera={cam.camera}
              viewport={cam.viewport}
              onZoom={(c) => void cam.fly(c, 200)}
            />
          </div>
          <div className="pointer-events-none absolute bottom-3.5 left-3.5 text-link">
            <p className="type-label-s">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} · drag to arrange
            </p>
            <p className="type-display-xl">Studio</p>
          </div>
          <div className="absolute right-3.5 bottom-3.5">
            <Minimap
              label="Studio"
              blocks={everything}
              camera={cam.camera}
              viewport={cam.viewport}
              onMove={cam.set}
            />
          </div>
        </>
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
      <button
        onClick={onNew}
        className="group absolute flex flex-col items-center justify-center gap-2 border border-dashed border-wire bg-card/60 text-link [border-dasharray:6]"
        style={{ left: blank.x, top: blank.y, width: blank.w, height: blank.h }}
      >
        <span className="font-mono text-2xl text-link/40">+</span>
        <span className="serif-on type-heading-m">New project</span>
        <span className="type-caption text-dim">A blank cover. Fill it in.</span>
      </button>
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
