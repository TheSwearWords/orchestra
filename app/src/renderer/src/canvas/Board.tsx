// An area's artboard: floating section cards you drag by the header, resize from the corner,
// collapse and (when the board allows) close; anything else on the board, like the Create
// stage, sits under them. Each board keeps its arrangement in projects/<id>/boards/<board>.json;
// Tidy puts every card back (brand spec §5.3 Board/Section card, C4–C6).
import { useEffect, useRef, useState } from 'react'
import type { BoardLayout } from '../../../preload'
import { snap, fit, type Rect } from './camera'
import { Canvas } from './Canvas'
import { Minimap, Shell, ZoomChip, barButton, type Step } from './Chrome'
import { TOP_BAR, fitBelow } from './shared'
import { useCamera } from './useCamera'

export interface CardSpec {
  id: string
  title: string
  count?: string
  x: number
  y: number
  w: number
  h?: number // fixed body height; otherwise it grows to its content, up to MAX_BODY
  tone?: 'white' | 'paper' | 'blue' // paper: a document (2px blue border); blue: the poster
  body: React.ReactNode
  onClose?: () => void // a window opened on the board, rather than one of its sections
}

const MAX_BODY = 640
const HEADER = 44

interface Props {
  project: string
  board: string // file name, e.g. "research" or "create"
  label: string // the minimap's page label
  crumbs: Step[]
  pages?: React.ReactNode // bottom left: the area switch
  cards: CardSpec[]
  // more on the board under the cards (the stage); in world px, with its extent for fitting
  world?: React.ReactNode
  worldRect?: Rect
  top?: React.ReactNode // screen-space note under the top bar, e.g. an error
  focus?: string // a card to bring into view, e.g. one just opened
  preview?: boolean // the book's small live copy: no chrome, nothing saved
}

export function Board({
  project,
  board,
  label,
  crumbs,
  pages,
  cards,
  world,
  worldRect,
  top,
  focus,
  preview
}: Props): React.JSX.Element {
  const [layout, setLayout] = useState<BoardLayout | null>(null)
  const [tidying, setTidying] = useState(false)
  useEffect(() => {
    void window.api.loadBoard(project, board).then(setLayout, () => setLayout({}))
  }, [project, board])

  const placed = cards.map((c) => ({ ...c, ...layout?.[c.id] }))
  // card heights aren't known before they render; the fit uses what a body usually takes
  const rectOf = (c: (typeof placed)[number]): Rect => ({
    x: c.x,
    y: c.y,
    w: c.w,
    h: HEADER + (c.collapsed ? 0 : (c.h ?? Math.min(MAX_BODY, 360)))
  })
  const rects: Rect[] = [...placed.map(rectOf), ...(worldRect ? [worldRect] : [])]
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
  const cam = useCamera(
    preview ? fit(bounds(), innerWidth, innerHeight, 40, 1) : fitBelow(bounds())
  )

  // a card asked for (just opened) flies into view once it is on the board
  const shown = useRef<string | undefined>(undefined)
  const target = placed.find((c) => c.id === focus)
  useEffect(() => {
    if (preview || !target || !layout || shown.current === focus) return
    shown.current = focus
    void cam.fly(fitBelow(rectOf(target), 1), 450)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly once per focused card
  }, [focus, layout, target])

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
      scrollable="[data-card-body], [data-scroll]"
      className={preview ? '' : 'animate-[area-in_550ms_var(--ease)_both]'}
      chrome={
        !preview && (
          <Shell
            crumbs={crumbs}
            right={
              <>
                {layout && Object.keys(layout).length > 0 && (
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
            pages={pages}
            minimap={
              <Minimap
                label={label}
                blocks={rects}
                camera={cam.camera}
                viewport={cam.viewport}
                onMove={cam.set}
              />
            }
          >
            {top && (
              <div
                className="absolute left-1/2 z-20 -translate-x-1/2"
                style={{ top: TOP_BAR + 12 }}
              >
                {top}
              </div>
            )}
          </Shell>
        )
      }
    >
      {world}
      {layout &&
        placed.map((c) => (
          <Card
            key={c.id}
            card={c}
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

export function Card({
  card,
  z,
  tidying,
  onMove,
  onResize,
  onCollapse
}: {
  card: CardSpec & { collapsed?: boolean }
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
    let moved = false
    const move = (m: PointerEvent): void => {
      moved = true
      last = apply((m.clientX - sx) / z, (m.clientY - sy) / z)
      setLive(last)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      setLive(null)
      if (moved) done(last)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const blue = card.tone === 'blue'
  const dragging = live !== null
  const stop = (e: React.PointerEvent): void => e.stopPropagation()
  return (
    <section
      aria-label={card.title}
      className={`absolute flex flex-col ${
        blue
          ? 'bg-poster-dots'
          : card.tone === 'paper'
            ? 'border-2 border-brand bg-card'
            : 'border border-card-line bg-card'
      } ${dragging ? 'z-10 shadow-lift outline-2 outline-brand' : 'shadow-card'}`}
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
        className={`flex shrink-0 cursor-grab items-center gap-3 px-4 active:cursor-grabbing ${
          blue ? 'text-on-brand' : 'border-b border-hair text-link'
        }`}
        style={{ height: HEADER }}
      >
        <span aria-hidden className="font-mono text-[11px] tracking-[-0.2em] opacity-50">
          ⋮⋮
        </span>
        <h2 className="min-w-0 flex-1 truncate type-label-serif-l">{card.title}</h2>
        {card.count && <span className="font-mono text-[12px] opacity-70">{card.count}</span>}
        <button
          onPointerDown={stop}
          onClick={onCollapse}
          aria-expanded={!card.collapsed}
          aria-label={card.collapsed ? `Show ${card.title}` : `Collapse ${card.title}`}
          title={card.collapsed ? 'Show' : 'Collapse'}
          className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
        >
          {card.collapsed ? '+' : '—'}
        </button>
        {card.onClose && (
          <button
            onPointerDown={stop}
            onClick={card.onClose}
            aria-label={`Close ${card.title}`}
            title="Close"
            className="flex size-7 items-center justify-center font-mono text-[13px] hover:bg-selected"
          >
            ✕
          </button>
        )}
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
          <span className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-current opacity-50" />
        </span>
      )}
    </section>
  )
}
