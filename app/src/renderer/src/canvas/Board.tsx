// An area's (or a deliverable's) own artboard: floating section cards you drag by the header,
// resize from the corner and collapse (brand spec §5.3 Board/Section card). Each board keeps
// its arrangement in projects/<id>/boards/<board>.json; Tidy puts every card back.
import { useEffect, useState } from 'react'
import type { BoardLayout } from '../../../preload'
import { snap, fit, type Rect } from './camera'
import { Canvas } from './Canvas'
import { Breadcrumb, Minimap, ZoomChip, type Step } from './Chrome'
import { chip } from './shared'
import { useCamera } from './useCamera'

export interface CardSpec {
  id: string
  title: string
  count?: string
  x: number
  y: number
  w: number
  h?: number // fixed body height; otherwise it grows to its content, up to MAX_BODY
  tone?: 'white' | 'paper' // paper: a document card, with a 2px blue border
  body: React.ReactNode
}

const MAX_BODY = 640
const HEADER = 40

interface Props {
  project: string
  board: string // file name, e.g. "research" or "deliverable-brand-kit"
  label: string // the minimap's page label
  crumbs: Step[]
  aside?: React.ReactNode // beside the breadcrumb (the area switch)
  cards: CardSpec[]
  // more on the board under the cards (the stage); in world px, with its extent for fitting
  world?: React.ReactNode
  worldRect?: Rect
  top?: React.ReactNode // screen-space note under the chrome, e.g. an error
  preview?: boolean // the book's small live copy: no chrome, nothing saved
}

export function Board({
  project,
  board,
  label,
  crumbs,
  aside,
  cards,
  world,
  worldRect,
  top,
  preview
}: Props): React.JSX.Element {
  const [layout, setLayout] = useState<BoardLayout | null>(null)
  const [tidying, setTidying] = useState(false)
  useEffect(() => {
    void window.api.loadBoard(project, board).then(setLayout, () => setLayout({}))
  }, [project, board])

  const placed = cards.map((c) => ({ ...c, ...layout?.[c.id] }))
  // card heights aren't known before they render; the fit uses the most a body can take
  const rects: Rect[] = [
    ...placed.map((c) => ({
      x: c.x,
      y: c.y,
      w: c.w,
      h: HEADER + (c.collapsed ? 0 : (c.h ?? Math.min(MAX_BODY, 420)))
    })),
    ...(worldRect ? [worldRect] : [])
  ]
  const bounds = (): Rect => {
    const x = Math.min(...rects.map((r) => r.x))
    const y = Math.min(...rects.map((r) => r.y))
    return {
      x,
      y,
      w: Math.max(...rects.map((r) => r.x + r.w)) - x,
      h: Math.max(...rects.map((r) => r.y + r.h)) - y
    }
  }
  // leaves room for the chrome above and the minimap below
  const cam = useCamera(fit(bounds(), innerWidth, innerHeight - 80, 80, 1))

  function save(next: BoardLayout): void {
    if (preview) return
    setLayout(next)
    void window.api.saveBoard(project, board, next)
  }
  const change = (id: string, patch: Partial<BoardLayout[string]>): void => {
    const c = placed.find((p) => p.id === id)!
    save({ ...layout, [id]: { x: c.x, y: c.y, w: c.w, h: c.h, collapsed: c.collapsed, ...patch } })
  }
  function tidy(): void {
    setTidying(true)
    save({})
    setTimeout(() => setTidying(false), 460)
  }

  return (
    <Canvas
      cam={cam}
      scrollable="[data-card-body]"
      className={preview ? '' : 'animate-[area-in_550ms_var(--ease)_both]'}
      chrome={
        !preview && (
          <>
            <div className="absolute top-3.5 left-3.5 flex gap-2.5">
              <Breadcrumb steps={crumbs} />
              {aside}
            </div>
            <div className="absolute top-3.5 right-3.5 flex gap-2.5">
              {layout && Object.keys(layout).length > 0 && (
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
            {top && <div className="absolute top-[74px] left-1/2 -translate-x-1/2">{top}</div>}
            <div className="absolute right-3.5 bottom-3.5">
              <Minimap
                label={label}
                blocks={rects}
                camera={cam.camera}
                viewport={cam.viewport}
                onMove={cam.set}
              />
            </div>
          </>
        )
      }
    >
      {world}
      {layout &&
        placed.map((c, i) => (
          <Card
            key={c.id}
            card={c}
            index={i}
            total={placed.length}
            z={cam.camera.z}
            tidying={tidying}
            onMove={(x, y) => change(c.id, { x, y })}
            onResize={(w, h) => change(c.id, { w, h })}
            onCollapse={() => change(c.id, { collapsed: !c.collapsed })}
          />
        ))}
    </Canvas>
  )
}

function Card({
  card,
  index,
  total,
  z,
  tidying,
  onMove,
  onResize,
  onCollapse
}: {
  card: CardSpec & { collapsed?: boolean }
  index: number
  total: number
  z: number
  tidying: boolean
  onMove: (x: number, y: number) => void
  onResize: (w: number, h: number) => void
  onCollapse: () => void
}): React.JSX.Element {
  // while dragging, the card follows the pointer locally; it is saved once, on release
  const [live, setLive] = useState<{ x: number; y: number; w: number; h?: number } | null>(null)
  const x = live?.x ?? card.x
  const y = live?.y ?? card.y
  const w = live?.w ?? card.w
  const h = live?.h ?? card.h

  function track(
    e: React.PointerEvent,
    apply: (dx: number, dy: number) => { x: number; y: number; w: number; h?: number },
    done: (r: { x: number; y: number; w: number; h?: number }) => void
  ): void {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const sx = e.clientX
    const sy = e.clientY
    let last = apply(0, 0)
    const move = (m: PointerEvent): void => {
      last = apply((m.clientX - sx) / z, (m.clientY - sy) / z)
      setLive(last)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setLive(null)
      done(last)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const paper = card.tone === 'paper'
  const dragging = live !== null
  return (
    <section
      aria-label={card.title}
      className={`absolute flex flex-col bg-card ${paper ? 'border-2 border-brand' : 'border border-card-line'} ${
        dragging ? 'z-10 shadow-lift outline-2 outline-brand' : 'shadow-card'
      }`}
      style={{
        left: 0,
        top: 0,
        width: w,
        transform: `translate(${x}px, ${y}px)${dragging ? ' rotate(-0.6deg)' : ''}`,
        transition: tidying ? 'transform 450ms var(--ease), width 450ms var(--ease)' : undefined
      }}
    >
      <header
        onPointerDown={(e) =>
          track(
            e,
            (dx, dy) => ({ x: card.x + dx, y: card.y + dy, w, h }),
            (r) => onMove(snap(r.x), snap(r.y))
          )
        }
        className="flex h-10 shrink-0 cursor-grab items-center gap-3 border-b border-hair px-3 text-link active:cursor-grabbing"
      >
        <span aria-hidden className="font-mono text-[11px] tracking-[-0.2em] text-link/50">
          ⋮⋮
        </span>
        <h2 className="min-w-0 flex-1 truncate type-label-mono">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')} · {card.title}
        </h2>
        {card.count && <span className="type-caption text-dim">{card.count}</span>}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onCollapse}
          aria-expanded={!card.collapsed}
          aria-label={card.collapsed ? `Show ${card.title}` : `Collapse ${card.title}`}
          className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
        >
          {card.collapsed ? '+' : '−'}
        </button>
      </header>
      {!card.collapsed && (
        <div
          data-card-body
          className="min-h-0 overflow-auto select-text"
          style={h ? { height: h } : { maxHeight: MAX_BODY }}
        >
          {card.body}
        </div>
      )}
      {!card.collapsed && (
        <span
          aria-hidden
          onPointerDown={(e) => {
            const startH =
              h ?? e.currentTarget.parentElement!.getBoundingClientRect().height / z - HEADER
            track(
              e,
              (dx, dy) => ({ x, y, w: Math.max(280, w + dx), h: Math.max(120, startH + dy) }),
              (r) => onResize(snap(r.w), snap(r.h ?? startH))
            )
          }}
          className="absolute -right-1 -bottom-1 size-4 cursor-nwse-resize"
        >
          <span className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-brand/60" />
        </span>
      )}
    </section>
  )
}
