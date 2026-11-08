// An area's artboard: floating section cards you drag by the header, resize from the corner,
// collapse and (when the board allows) close; anything else on the board, like the Create
// stage, sits under them. Each board keeps its arrangement in projects/<id>/boards/<board>.json;
// Tidy puts every card back (brand spec §5.3 Board/Section card, C4–C6).
// A window on the artboard never scrolls: the board has room, so a card grows to show all of
// its content, and resizing changes only its width.
import { useEffect, useRef, useState } from 'react'
import type { BoardLayout } from '../../../preload'
import { snap, fit, type Rect } from './camera'
import { Canvas } from './Canvas'
import { Minimap, Shell, ZoomChip, barButton, type Step } from './Chrome'
import { TOP_BAR, barInput, fitBelow, popMenu, type MenuItem } from './shared'
import { freeSpot, settle } from './place'
import { Wire } from './Wire'
import { useCamera } from './useCamera'

export interface CardSpec {
  id: string
  title: string
  count?: string
  x: number
  y: number
  w: number
  tone?: 'white' | 'paper' | 'blue' // paper: a document (2px blue border); blue: the poster
  body: React.ReactNode
  onClose?: () => void // a window opened on the board, rather than one of its sections
  link?: string // another card's id: a wire runs between them (a window and its Orchestrator)
  needsYou?: boolean // waiting on the user: an orange tab on its top edge
  // the one exception to growing with its content: a chat, which could run forever. Its body
  // starts this tall and scrolls inside; dragging the corner makes it taller or shorter too.
  height?: number
  menu?: MenuItem[] // right-click on the card's header
}

const HEADER = 44
const GUESS = 360 // a card's height before it has rendered, for fitting the view

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
  obstacles?: Rect[] // things on the board under the cards that cards must keep clear of
  top?: React.ReactNode // screen-space note under the top bar, e.g. an error
  focus?: string // a card to bring into view, e.g. one just opened
  preview?: boolean // the book's small live copy: no chrome, nothing saved
  right?: React.ReactNode // more controls in the top bar, before Tidy
  // right-click on empty board: what can be added here, at that spot in board px, for the
  // selected card if there is one (click a card to select it: its border goes bold). Every
  // board's menu ends with Ask the Orchestrator… when the screen has the bar.
  addMenu?: (at: { x: number; y: number }, selected?: string) => MenuItem[]
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
  obstacles = [],
  top,
  focus,
  preview,
  right,
  addMenu
}: Props): React.JSX.Element {
  const [layout, setLayout] = useState<BoardLayout | null>(null)
  const [tidying, setTidying] = useState(false)
  useEffect(() => {
    void window.api.loadBoard(project, board).then(setLayout, () => setLayout({}))
  }, [project, board])

  // each card's real height, as rendered (a guess until then)
  const [heights, setHeights] = useState<Record<string, number>>({})
  const tall = (c: CardSpec & { collapsed?: boolean }): number =>
    c.collapsed ? HEADER : (heights[c.id] ?? HEADER + GUESS)
  // where each card wants to be (its saved place, else its default), then settled so nothing
  // overlaps: cards you placed keep their spot first, the rest move beside them
  const wanted = cards.map((c) => ({ ...c, ...layout?.[c.id], h: 0 }))
  const order = [...wanted].sort((a, b) => Number(!layout?.[a.id]) - Number(!layout?.[b.id]))
  const settled = settle(
    order.map((c) => ({ ...c, h: tall(c) })),
    obstacles
  )
  const placed = wanted.map((c) => settled.find((s) => s.id === c.id)!)
  const rectOf = (c: (typeof placed)[number]): Rect => ({ x: c.x, y: c.y, w: c.w, h: c.h })
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
    const kept = layout?.[id]?.h
    const next = {
      x: c.x,
      y: c.y,
      w: c.w,
      ...(kept ? { h: kept } : {}),
      collapsed: c.collapsed,
      ...patch
    }
    // dropped on top of something: it moves to the nearest free spot beside it
    const others = [...placed.filter((p) => p.id !== id).map(rectOf), ...obstacles]
    const spot = freeSpot({ x: next.x, y: next.y, w: next.w, h: c.h }, others)
    save({ ...layout, [id]: { ...next, x: spot.x, y: spot.y } })
  }
  // the card you're working with: clicking a card selects it, clicking empty board or Escape
  // lets go; right-click on the board then offers what pertains to it
  const [selected, setSelected] = useState<string>()
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelected(undefined)
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])

  function tidy(): void {
    setTidying(true)
    save({})
    setTimeout(() => setTidying(false), 460)
  }

  return (
    <Canvas
      cam={cam}
      className={preview ? '' : 'animate-[area-in_550ms_var(--ease)_both]'}
      onPress={() => setSelected(undefined)}
      content={
        preview
          ? undefined
          : () => {
              const sel = placed.find((c) => c.id === selected)
              return { all: bounds(), selected: sel && rectOf(sel) }
            }
      }
      onContextMenu={
        addMenu &&
        ((e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const { x, y, z } = cam.camera
          const sel = placed.find((c) => c.id === selected)
          const items = addMenu(
            { x: snap(x + (e.clientX - box.left) / z), y: snap(y + (e.clientY - box.top) / z) },
            sel?.id
          )
          // the menu says what it's for: the selected card's name, greyed, on top
          if (sel) items.unshift({ label: sel.title }, { label: '', separator: true })
          const field = barInput()
          if (field)
            items.push(
              { label: '', separator: true },
              { label: 'Ask the Orchestrator…', run: () => field.focus() }
            )
          void popMenu(items)
        })
      }
      chrome={
        !preview && (
          <Shell
            crumbs={crumbs}
            right={
              <>
                {right}
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
      {layout && (
        <svg
          aria-hidden
          className="pointer-events-none absolute overflow-visible"
          style={{ left: 0, top: 0, width: 1, height: 1 }}
        >
          {placed.flatMap((c) => {
            const to = c.link && placed.find((p) => p.id === c.link)
            if (!to) return []
            return [
              <Wire
                key={c.id}
                x1={c.x + c.w / 2}
                y1={c.y + c.h / 2}
                x2={to.x + to.w / 2}
                y2={to.y + to.h / 2}
                tone={c.needsYou ? 'needs-you' : 'wire'}
              />
            ]
          })}
        </svg>
      )}
      {layout &&
        placed.map((c) => (
          <Card
            key={c.id}
            card={c}
            savedH={layout?.[c.id]?.h}
            onHeight={(hh) =>
              setHeights((all) => (all[c.id] === hh ? all : { ...all, [c.id]: hh }))
            }
            z={cam.camera.z}
            tidying={tidying}
            selected={selected === c.id}
            onSelect={() => setSelected(c.id)}
            onMove={(x, y) => change(c.id, { x, y })}
            onResize={(w, h) => change(c.id, h ? { w, h } : { w })}
            onCollapse={() => change(c.id, { collapsed: !c.collapsed })}
          />
        ))}
    </Canvas>
  )
}

export function Card({
  card,
  savedH,
  onHeight,
  z,
  tidying,
  selected,
  onSelect,
  onMove,
  onResize,
  onCollapse
}: {
  card: CardSpec & { collapsed?: boolean }
  savedH?: number // a tall card's body height, as the user last dragged it
  onHeight?: (h: number) => void // its rendered height in board px, so others can keep clear
  z: number
  tidying: boolean
  selected?: boolean // the card right-click on the board is about: a bold blue border
  onSelect?: () => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h?: number) => void
  onCollapse: () => void
}): React.JSX.Element {
  // while dragging, the card follows the pointer locally; it is saved once, on release
  const [live, setLive] = useState<{ x: number; y: number; w: number; h?: number } | null>(null)
  const x = live?.x ?? card.x
  const y = live?.y ?? card.y
  const w = live?.w ?? card.w
  // a tall card's body height: dragged now, else saved, else its starting height
  const bodyH = card.height ? (live?.h ?? savedH ?? card.height) : undefined

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

  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || !onHeight) return
    const ro = new ResizeObserver(() => onHeight(Math.ceil(el.offsetHeight / 24) * 24))
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])

  const blue = card.tone === 'blue'
  const dragging = live !== null
  const stop = (e: React.PointerEvent): void => e.stopPropagation()
  return (
    <section
      ref={box}
      data-card={card.id}
      aria-label={card.title}
      className={`absolute flex flex-col ${
        blue
          ? 'bg-poster-dots'
          : card.tone === 'paper'
            ? 'border-2 border-brand bg-card'
            : 'border border-card-line bg-card'
      } ${
        dragging
          ? 'z-10 shadow-lift outline-2 outline-brand'
          : card.needsYou
            ? // waiting on you: an orange dotted frame around it, with the tag on its edge
              'shadow-card outline-2 outline-offset-8 outline-needs-you outline-dashed'
            : 'shadow-card'
      } ${selected && !dragging ? 'ring-[3px] ring-brand' : ''}`}
      onPointerDownCapture={onSelect}
      style={{
        left: 0,
        top: 0,
        width: w,
        transform: `translate(${x}px, ${y}px)${dragging ? ' rotate(-0.6deg)' : ''}`,
        transition: tidying ? 'transform 450ms var(--ease), width 450ms var(--ease)' : undefined
      }}
    >
      <header
        onContextMenu={(e) => {
          if (!card.menu) return
          e.preventDefault()
          e.stopPropagation()
          void popMenu(card.menu)
        }}
        onPointerDown={(e) =>
          track(
            e,
            (dx, dy) => ({ x: card.x + dx, y: card.y + dy, w }),
            (r) => onMove(snap(r.x), snap(r.y))
          )
        }
        className={`flex shrink-0 cursor-grab items-center gap-3 px-4 active:cursor-grabbing ${
          blue ? 'text-on-brand' : 'border-b border-hair text-link'
        }`}
        style={{ height: HEADER }}
      >
        {card.needsYou && (
          <span className="absolute -top-[22px] right-2 bg-needs-you px-2 py-0.5 type-label-s text-on-needs-you">
            Needs you
          </span>
        )}
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
        <div className="flex flex-col select-text" style={bodyH ? { height: bodyH } : undefined}>
          {card.body}
        </div>
      )}
      {!card.collapsed && (
        <span
          aria-hidden
          onPointerDown={(e) =>
            track(
              e,
              (dx, dy) => ({
                x,
                y,
                w: Math.max(280, w + dx),
                ...(bodyH ? { h: Math.max(240, bodyH + dy) } : {})
              }),
              (r) => onResize(snap(r.w), r.h && snap(r.h))
            )
          }
          title={bodyH ? 'Drag to resize' : 'Drag to widen'}
          className={`absolute -right-1 -bottom-1 size-4 ${bodyH ? 'cursor-nwse-resize' : 'cursor-ew-resize'}`}
        >
          <span className="absolute right-1 bottom-1 size-2 border-r-2 border-b-2 border-current opacity-50" />
        </span>
      )}
    </section>
  )
}
