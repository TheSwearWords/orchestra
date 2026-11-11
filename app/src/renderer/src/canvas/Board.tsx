// An area's artboard: floating section cards you drag by the header, resize from the corner,
// collapse and (when the board allows) close; anything else on the board, like the Create
// stage, sits under them. Each board keeps its arrangement in projects/<id>/boards/<board>.json;
// Tidy puts every card back (brand spec §5.3 Board/Section card, C4–C6).
// A window on the artboard never scrolls: the board has room, so a card grows to show all of
// its content, and resizing changes only its width.
import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import type { BoardLayout } from '../../../preload'
import { snap, fit, type Rect } from './camera'
import { Canvas } from './Canvas'
import { Minimap, Shell, ZoomChip, barButton } from './Chrome'
import { DOCK_GAP, DOCK_TOP, TOP_BAR, barInput, fitBelow, popMenu, type MenuItem } from './shared'
import { freeSpot, separate, settle, touches } from './place'
import { treeLayout } from './tree'
import { GroupLabel } from './GroupLabel'
import { Port } from './Port'
import { Rename } from './Rename'
import { KIND, KindMark, type CardKind } from './kinds'
import { Waveform } from './Waveform'
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
  // placed with what it's linked to until you move it: under it, or beside it (see tree.ts)
  auto?: true | 'left' | 'right'
  port?: number // instead of link: a wire to the dock's left edge, this far down the window
  solid?: boolean // its wire is solid: what it joins is connected
  pin?: boolean // anchored: always exactly at x and y, wherever it was once dragged to
  bottom?: number // anchored: stays at x, its bottom edge here however tall it grows
  gate?: React.ReactNode // sits on its wire, just outside its group: what has to be ready first
  needsYou?: boolean // waiting on the user: an orange tab on its top edge
  working?: boolean // an agent is working on it: a waveform over the frame
  kind?: CardKind // what this window is: its look and its tag (kinds.tsx)
  // the one exception to growing with its content: a chat, which could run forever. Its body
  // starts this tall and scrolls inside; dragging the corner makes it taller or shorter too.
  height?: number
  menu?: MenuItem[] // right-click on the card's header
  onRename?: (name: string) => void // double-click the header, or right-click, to rename
}

const HEADER = 44
const GUESS = 360 // a card's height before it has rendered, for fitting the view

interface Props {
  project: string
  board: string // file name, e.g. "research" or "create"
  label: string // the minimap's page label
  pages?: React.ReactNode // bottom left: the area switch
  cards: CardSpec[]
  // more on the board under the cards (the stage); in world px, with its extent for fitting
  world?: React.ReactNode
  worldRect?: Rect
  obstacles?: Rect[] // things on the board under the cards that cards must keep clear of
  top?: React.ReactNode // screen-space note under the top bar, e.g. an error
  focus?: string // a card to bring into view, e.g. one just opened
  onFocused?: () => void // it's on its way: clear focus so the same card can be asked for again
  preview?: boolean // the book's small live copy: no chrome, nothing saved
  right?: React.ReactNode // more controls in the top bar, before Tidy
  // right-click on empty board: what can be added here, at that spot in board px, for the
  // selected card if there is one (click a card to select it: its border goes bold). Every
  // board's menu ends with Ask the Orchestrator… when the screen has the bar.
  addMenu?: (at: { x: number; y: number }, selected?: string) => MenuItem[]
  dock?: { width: number; node: React.ReactNode } // a panel floating by the window's right edge
  // wires between things inside cards, by the data-port value on each end's element
  wires?: { from: string; to: string; solid?: boolean; onCut?: () => void }[]
  // drag from an element with data-out to one with data-in to connect them
  onPick?: (from: string, to: string) => void
  locked?: React.ReactNode // the board is shown greyed out and can't be used; this says why
  anchored?: React.ReactNode // held in place over the board, like the New card
  worldGroup?: { name: string; rect: Rect } // a frame and tag around what's under the cards
  worldWire?: { x: number; y: number; to: string } // a wire from the stage to a window
  worldFeeds?: { x: number; y: number; from: string[] } // wires from windows into the stage
  // named groups of windows: a blue frame around them, moved and renamed by its label
  frames?: {
    id: string
    name: string
    members: string[]
    port?: string // a dot on its right edge that wires can be pulled from
    fixed?: boolean // its windows are pinned, so its label doesn't drag them
    onRename?: (name: string) => void
    onMenu?: () => void
  }[]
  hidden?: string[] // windows not drawn, though they keep their place in the layout
  // new windows to put somewhere: at this board point, or the middle of the view
  spawn?: { at?: { x: number; y: number }; windows: { id: string; dx: number; dy: number }[] }
  onSpawned?: () => void
}

export function Board({
  project,
  board,
  label,
  pages,
  cards,
  world,
  worldRect,
  obstacles = [],
  top,
  focus,
  onFocused,
  preview,
  right,
  addMenu,
  dock,
  wires,
  onPick,
  locked,
  frames,
  anchored,
  worldGroup,
  worldFeeds,
  worldWire,
  hidden = [],
  spawn,
  onSpawned
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
  const tree = treeLayout(
    cards
      .filter((c) => c.auto)
      .map((c) => ({
        id: c.id,
        parent: c.link,
        side: c.auto === true ? undefined : c.auto,
        x: c.x,
        y: c.y,
        w: layout?.[c.id]?.w ?? c.w,
        h: tall({ ...c, collapsed: layout?.[c.id]?.collapsed })
      }))
  )
  const wanted = cards.map((c) => ({
    ...c,
    ...tree[c.id],
    ...layout?.[c.id],
    ...(c.pin ? { x: c.x, y: c.y } : {}),
    ...(c.bottom === undefined
      ? {}
      : { x: c.x, y: c.bottom - tall({ ...c, collapsed: layout?.[c.id]?.collapsed }) }),
    h: 0
  }))
  const order = [...wanted].sort(
    (a, b) => Number(!layout?.[a.id] && !a.pin) - Number(!layout?.[b.id] && !b.pin)
  )
  const settled = settle(
    order.map((c) => ({ ...c, h: tall(c) })),
    obstacles
  )
  const fitted = wanted.map((c) => settled.find((s) => s.id === c.id)!)
  // a group moves whole, so what's in one bounding box never lands in another's
  const framed = new Set(frames?.flatMap((f) => f.members))
  const pad = 28
  const shifts = frames?.length
    ? separate([
        ...frames.flatMap((f) => {
          const inside = fitted.filter((c) => f.members.includes(c.id))
          if (!inside.length) return []
          const x = Math.min(...inside.map((c) => c.x)) - pad
          const y = Math.min(...inside.map((c) => c.y)) - pad
          return [
            {
              ids: f.members,
              rect: {
                x,
                y,
                w: Math.max(...inside.map((c) => c.x + c.w)) + pad - x,
                h: Math.max(...inside.map((c) => c.y + c.h)) + pad - y
              }
            }
          ]
        }),
        ...fitted
          .filter((c) => !framed.has(c.id))
          .map((c) => ({ ids: [c.id], rect: { x: c.x, y: c.y, w: c.w, h: c.h }, fixed: true })),
        ...obstacles.map((rect) => ({ ids: [], rect, fixed: true }))
      ])
    : {}
  // settling snaps to the grid, so an anchored card is put back exactly
  const placed = fitted.map((c) => {
    const home = cards.find((s) => s.id === c.id)!
    if (home.bottom !== undefined) return { ...c, x: home.x, y: home.bottom - c.h }
    if (home.pin) return { ...c, x: home.x, y: home.y }
    return shifts[c.id] ? { ...c, x: c.x + shifts[c.id].dx, y: c.y + shifts[c.id].dy } : c
  })
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

  // where each data-port is, in board px, so a wire can end on a row inside a card
  const [ports, setPorts] = useState<Record<string, Rect>>({})
  useLayoutEffect(() => {
    const root = cam.ref.current
    if (!root || (!wires?.length && !onPick)) return
    const box = root.getBoundingClientRect()
    const { x, y, z } = cam.camera
    const near = (v: number): number => Math.round(v / 4) * 4 // ignores rounding mid-zoom
    const found: Record<string, Rect> = {}
    root.querySelectorAll<HTMLElement>('[data-port]').forEach((el) => {
      const r = el.getBoundingClientRect()
      found[el.dataset.port!] = {
        x: near(x + (r.left - box.left) / z),
        y: near(y + (r.top - box.top) / z),
        w: near(r.width / z),
        h: near(r.height / z)
      }
    })
    setPorts((old) => (JSON.stringify(old) === JSON.stringify(found) ? old : found))
  })

  const [opened, setOpened] = useState<string>()
  // new windows land where they were asked for, as soon as they exist
  useEffect(() => {
    if (!spawn || !layout) return
    const made = spawn.windows.map((w) => ({ ...w, c: placed.find((p) => p.id === w.id) }))
    if (made.some((m) => !m.c)) return
    const { x, y, z } = cam.camera
    const origin = spawn.at ?? {
      x: x + (cam.viewport.w / 2 - 240) / z,
      y: y + (cam.viewport.h / 2 - 200) / z
    }
    const next = { ...layout }
    for (const m of made)
      next[m.id] = { x: snap(origin.x + m.dx), y: snap(origin.y + m.dy), w: m.c!.w }
    save(next)
    setOpened(made[0].id) // the camera goes to it, so you see what you just opened
    onSpawned?.()
  })

  // the wire being pulled out of a data-out handle, ending at the pointer in board px
  const [pick, setPick] = useState<{ from: string; x: number; y: number } | null>(null)
  const latest = useRef({ onPick, camera: cam.camera })
  useEffect(() => {
    latest.current = { onPick, camera: cam.camera }
  })
  const pickable = !preview && !!onPick
  useEffect(() => {
    const root = cam.ref.current
    if (!root || !pickable) return
    const down = (e: PointerEvent): void => {
      const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-out]')
      if (!handle || e.button !== 0) return
      e.stopPropagation()
      e.preventDefault()
      root.setPointerCapture(e.pointerId)
      const from = handle.dataset.out!
      let over: HTMLElement | null = null
      // the nearest socket within reach: the wire jumps to it, so you needn't land exactly
      const REACH = 96
      const socketNear = (cx: number, cy: number): HTMLElement | null => {
        let best: HTMLElement | null = null
        let dist = REACH
        root.querySelectorAll<HTMLElement>('[data-in]').forEach((el) => {
          const r = el.getBoundingClientRect()
          const d = Math.hypot(
            Math.max(r.left - cx, 0, cx - r.right),
            Math.max(r.top - cy, 0, cy - r.bottom)
          )
          if (d < dist) {
            dist = d
            best = el
          }
        })
        return best
      }
      const move = (m: PointerEvent): void => {
        const box = root.getBoundingClientRect()
        const { x, y, z } = latest.current.camera
        const el = socketNear(m.clientX, m.clientY)
        const r = el?.getBoundingClientRect()
        setPick({
          from,
          x: x + ((r ? r.left : m.clientX) - box.left) / z,
          y: y + ((r ? r.top + r.height / 2 : m.clientY) - box.top) / z
        })
        if (el === over) return
        over?.classList.remove('pick-over')
        el?.classList.add('pick-over')
        over = el
      }
      const up = (u: PointerEvent): void => {
        root.removeEventListener('pointermove', move)
        root.removeEventListener('pointerup', up)
        root.removeEventListener('pointercancel', up)
        setPick(null)
        over?.classList.remove('pick-over')
        const end = socketNear(u.clientX, u.clientY)
        if (end && u.type === 'pointerup') latest.current.onPick?.(from, end.dataset.in!)
      }
      root.addEventListener('pointermove', move)
      root.addEventListener('pointerup', up)
      root.addEventListener('pointercancel', up)
    }
    root.addEventListener('pointerdown', down, true)
    return () => root.removeEventListener('pointerdown', down, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the root element is stable
  }, [pickable])

  // a card asked for (just opened) flies into view once it is on the board
  const shown = useRef<string | undefined>(undefined)
  // focus can also name a frame: the view takes in everything in it
  const camTarget = focus ?? opened
  const target = placed.find((c) => c.id === camTarget)
  const frameRects = placed
    .filter((c) => frames?.find((f) => f.id === camTarget)?.members.includes(c.id))
    .map(rectOf)
  const focusRect: Rect | undefined = target
    ? rectOf(target)
    : frameRects.length
      ? {
          x: Math.min(...frameRects.map((r) => r.x)) - 28,
          y: Math.min(...frameRects.map((r) => r.y)) - 28,
          w:
            Math.max(...frameRects.map((r) => r.x + r.w)) -
            Math.min(...frameRects.map((r) => r.x)) +
            56,
          h:
            Math.max(...frameRects.map((r) => r.y + r.h)) -
            Math.min(...frameRects.map((r) => r.y)) +
            56
        }
      : undefined
  useEffect(() => {
    if (!camTarget) shown.current = undefined
    if (preview || !focusRect || !layout || shown.current === camTarget) return
    shown.current = camTarget
    void cam.fly(fitBelow(focusRect, 1), 450)
    onFocused?.()
    setOpened(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fly once per focused card
  }, [camTarget, layout, !!focusRect])

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
  const [selected, setSelected] = useState<string[]>([])
  // the window being dragged, for those moving with it and any frame around it
  const [groupDrag, setGroupDrag] = useState<{ id: string; dx: number; dy: number } | null>(null)
  const [frameDrag, setFrameDrag] = useState<{ ids: string[]; dx: number; dy: number } | null>(null)
  const together = (id: string): boolean =>
    selected.length > 1 && selected.includes(id) && !!groupDrag && selected.includes(groupDrag.id)
  /** Where a window is right now, part-way through any drag. */
  const moved = (c: (typeof placed)[number]): Rect => {
    const d = frameDrag?.ids.includes(c.id)
      ? frameDrag
      : groupDrag?.id === c.id || together(c.id)
        ? groupDrag
        : null
    return { ...rectOf(c), x: c.x + (d?.dx ?? 0), y: c.y + (d?.dy ?? 0) }
  }
  function moveBy(ids: string[], dx: number, dy: number): void {
    const next = { ...layout }
    for (const c of placed.filter((p) => ids.includes(p.id)))
      next[c.id] = {
        ...layout?.[c.id],
        x: snap(c.x + dx),
        y: snap(c.y + dy),
        w: c.w,
        collapsed: c.collapsed
      }
    save(next)
  }
  /** Moves every selected window by what the one you dragged moved. */
  function moveTo(id: string, x: number, y: number): void {
    if (selected.length < 2 || !selected.includes(id)) return change(id, { x, y })
    const lead = placed.find((c) => c.id === id)!
    moveBy(selected, x - lead.x, y - lead.y)
  }
  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setSelected([])
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
      scrollable=".overflow-y-auto"
      className={preview ? '' : 'animate-[area-in_550ms_var(--ease)_both]'}
      onPress={() => setSelected([])}
      onMarquee={
        preview || locked
          ? undefined
          : (r) =>
              setSelected(
                placed
                  .filter((c) => !hidden.includes(c.id) && touches(rectOf(c), r))
                  .map((c) => c.id)
              )
      }
      content={
        preview
          ? undefined
          : () => {
              const sel = placed.filter((c) => selected.includes(c.id)).map(rectOf)
              if (!sel.length) return { all: bounds() }
              const x = Math.min(...sel.map((r) => r.x))
              const y = Math.min(...sel.map((r) => r.y))
              const w = Math.max(...sel.map((r) => r.x + r.w)) - x
              const h = Math.max(...sel.map((r) => r.y + r.h)) - y
              return { all: bounds(), selected: { x, y, w, h } }
            }
      }
      onContextMenu={
        addMenu &&
        ((e) => {
          if (locked) return
          const box = e.currentTarget.getBoundingClientRect()
          const { x, y, z } = cam.camera
          const sel = selected.length === 1 ? placed.find((c) => c.id === selected[0]) : undefined
          const items = addMenu(
            { x: snap(x + (e.clientX - box.left) / z), y: snap(y + (e.clientY - box.top) / z) },
            sel?.id
          )
          // the menu says what it's for: the selected card's name, greyed, on top
          if (sel) items.unshift({ label: sel.title }, { label: '', separator: true })
          else if (selected.length > 1)
            items.unshift({ label: `${selected.length} windows` }, { label: '', separator: true })
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
            {anchored}
            {locked && (
              <div
                className="absolute left-1/2 z-20 -translate-x-1/2"
                style={{ top: TOP_BAR + 54 }}
              >
                {locked}
              </div>
            )}
            {dock && (
              <aside
                className="absolute z-20"
                style={{ top: DOCK_TOP, right: DOCK_GAP, width: dock.width }}
              >
                {dock.node}
              </aside>
            )}
            {top && (
              <div
                className="absolute left-1/2 z-20 -translate-x-1/2"
                style={{ top: TOP_BAR + (pages ? 54 : 12) }} // below the pages when they're there
              >
                {top}
              </div>
            )}
          </Shell>
        )
      }
    >
      <div
        inert={!!locked}
        className={locked ? 'pointer-events-none opacity-40 grayscale' : 'contents'}
      >
        {worldGroup && (
          <div
            className="pointer-events-none absolute rounded-xl border border-dashed border-line-strong"
            style={{
              left: worldGroup.rect.x,
              top: worldGroup.rect.y,
              width: worldGroup.rect.w,
              height: worldGroup.rect.h
            }}
          >
            <GroupLabel name={worldGroup.name} z={cam.camera.z} />
          </div>
        )}
        {world}
        {layout && (
          <svg
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ left: 0, top: 0, width: 1, height: 1 }}
          >
            {pick && ports[pick.from] && (
              <Wire
                x1={ports[pick.from].x + ports[pick.from].w}
                y1={ports[pick.from].y + ports[pick.from].h / 2}
                x2={pick.x}
                y2={pick.y}
                solid
              />
            )}
            {worldWire &&
              (() => {
                const to = placed.find((p) => p.id === worldWire.to)
                return (
                  to && (
                    <Wire x1={worldWire.x} y1={worldWire.y} x2={to.x + to.w / 2} y2={to.y} solid />
                  )
                )
              })()}
            {worldFeeds &&
              placed
                .filter((c) => worldFeeds.from.includes(c.id))
                .map((c) => (
                  <Wire
                    key={`feed-${c.id}`}
                    x1={worldFeeds.x}
                    y1={worldFeeds.y}
                    x2={c.x}
                    y2={c.y + c.h / 2}
                    solid
                  />
                ))}
            {wires?.flatMap((w) => {
              const a = ports[w.from]
              const b = ports[w.to]
              if (!a || !b) return []
              return [
                // from whichever sides face each other
                <Wire
                  key={`${w.from}>${w.to}`}
                  x1={b.x + b.w < a.x ? a.x : a.x + a.w}
                  y1={a.y + a.h / 2}
                  x2={b.x + b.w < a.x ? b.x + b.w : b.x}
                  y2={b.y + b.h / 2}
                  solid={w.solid}
                  onCut={w.onCut}
                />
              ]
            })}
            {placed.flatMap((c) => {
              if (c.port !== undefined && dock) {
                // the dock stays put on screen, so this end moves with the camera
                const { x, y, z } = cam.camera
                return [
                  <Wire
                    key={c.id}
                    x1={c.x + c.w}
                    y1={c.y + c.h / 2}
                    x2={x + (cam.viewport.w - dock.width - DOCK_GAP) / z}
                    y2={y + c.port / z}
                    solid={c.solid}
                  />
                ]
              }
              const to = c.link && placed.find((p) => p.id === c.link)
              if (!to || hidden.includes(c.id) || hidden.includes(to.id)) return []
              return [
                <Wire
                  key={c.id}
                  x1={c.x + c.w / 2}
                  y1={c.y + c.h / 2}
                  x2={to.x + to.w / 2}
                  y2={to.y + to.h / 2}
                  tone={c.needsYou ? 'needs-you' : 'wire'}
                  solid={c.solid}
                />
              ]
            })}
          </svg>
        )}
        {layout &&
          placed.map((c) => {
            if (!c.gate || hidden.includes(c.id)) return null
            const r = moved(c)
            const mid = r.x + r.w / 2
            const from = placed.find((p) => p.id === c.link)
            const clear = r.y - 28 - Math.max(12, 36 / cam.camera.z)
            // never up into the window it's wired from
            const under = from && mid + 160 > from.x && mid - 160 < from.x + from.w
            return (
              <div
                key={c.id}
                data-gate={c.id}
                className="absolute -translate-x-1/2 -translate-y-full"
                // clear of the group's frame and its label, which keeps its size on screen
                style={{ left: mid, top: under ? Math.max(clear, from.y + from.h + 72) : clear }}
              >
                {c.gate}
              </div>
            )
          })}
        {layout &&
          frames?.map((f) => {
            const inside = placed
              .filter((c) => f.members.includes(c.id) && !hidden.includes(c.id))
              .map(moved)
            if (!inside.length) return null
            const pad = 28
            const x = Math.min(...inside.map((r) => r.x)) - pad
            const y = Math.min(...inside.map((r) => r.y)) - pad
            return (
              <div
                key={f.id}
                className="pointer-events-none absolute rounded-xl border border-dashed border-line-strong"
                style={{
                  left: x,
                  top: y,
                  width: Math.max(...inside.map((r) => r.x + r.w)) + pad - x,
                  height: Math.max(...inside.map((r) => r.y + r.h)) + pad - y
                }}
              >
                <GroupLabel
                  name={f.name}
                  z={cam.camera.z}
                  onRename={f.onRename}
                  onMenu={f.onMenu}
                  onDrag={
                    f.fixed ? undefined : (dx, dy) => setFrameDrag({ ids: f.members, dx, dy })
                  }
                  onDrop={
                    f.fixed
                      ? undefined
                      : (dx, dy) => {
                          setFrameDrag(null)
                          moveBy(f.members, dx, dy)
                        }
                  }
                />
                {f.port && (
                  <span className="pointer-events-auto">
                    <Port out={f.port} side="right" hint="Drag to an Interpret box to connect" />
                  </span>
                )}
              </div>
            )
          })}
        {layout &&
          placed
            .filter((c) => !hidden.includes(c.id))
            .map((c) => (
              <Card
                key={c.id}
                card={c}
                savedH={layout?.[c.id]?.h}
                onHeight={(hh) =>
                  setHeights((all) => (all[c.id] === hh ? all : { ...all, [c.id]: hh }))
                }
                z={cam.camera.z}
                tidying={tidying}
                selected={selected.includes(c.id)}
                onSelect={(shift) =>
                  setSelected((s) =>
                    shift
                      ? s.includes(c.id)
                        ? s.filter((x) => x !== c.id)
                        : [...s, c.id]
                      : s.includes(c.id)
                        ? s
                        : [c.id]
                  )
                }
                nudge={
                  frameDrag?.ids.includes(c.id)
                    ? frameDrag
                    : together(c.id)
                      ? (groupDrag ?? undefined)
                      : undefined
                }
                onDragBy={(d) => setGroupDrag(d && { ...d, id: c.id })}
                onMove={(x, y) => moveTo(c.id, x, y)}
                onResize={(w, h) => change(c.id, h ? { w, h } : { w })}
                onCollapse={() => change(c.id, { collapsed: !c.collapsed })}
              />
            ))}
      </div>
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
  nudge,
  onDragBy,
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
  onSelect?: (shift: boolean) => void
  nudge?: { dx: number; dy: number } // moved along with the selected window being dragged
  onDragBy?: (d: { dx: number; dy: number } | null) => void
  onMove: (x: number, y: number) => void
  onResize: (w: number, h?: number) => void
  onCollapse: () => void
}): React.JSX.Element {
  // while dragging, the card follows the pointer locally; it is saved once, on release
  const [live, setLive] = useState<{ x: number; y: number; w: number; h?: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const x = live?.x ?? card.x + (nudge?.dx ?? 0)
  const y = live?.y ?? card.y + (nudge?.dy ?? 0)
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
    const ro = new ResizeObserver(() => {
      const grid = card.bottom === undefined ? 24 : 1 // an anchored edge has to land exactly
      onHeight(Math.ceil(el.offsetHeight / grid) * grid)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [onHeight])

  const blue = card.tone === 'blue'
  const look = card.kind && KIND[card.kind]
  const dragging = live !== null
  const stop = (e: React.PointerEvent): void => e.stopPropagation()
  return (
    <section
      ref={box}
      data-card={card.id}
      aria-label={card.title}
      onContextMenu={(e) => {
        const items = [
          ...(card.onRename ? [{ label: 'Rename', run: () => setRenaming(true) }] : []),
          ...(card.menu ?? [])
        ]
        if (!items.length) return
        e.preventDefault()
        e.stopPropagation()
        void popMenu(items)
      }}
      className={`absolute flex flex-col rounded-lg ${
        look?.frame ??
        (blue
          ? 'indigo bg-poster-dots'
          : card.tone === 'paper'
            ? 'border-2 border-brand bg-card'
            : 'border border-card-line bg-card')
      } ${
        dragging
          ? 'z-10 shadow-lift outline-2 outline-brand'
          : card.needsYou
            ? // waiting on you: an orange dotted frame around it, with the tag on its edge
              'shadow-card outline-2 outline-offset-8 outline-needs-you outline-dashed'
            : 'shadow-card'
      } ${selected && !dragging ? 'ring-[3px] ring-brand' : ''}`}
      onPointerDownCapture={(e) => onSelect?.(e.shiftKey)}
      style={{
        left: 0,
        top: 0,
        width: w,
        transform: `translate(${x}px, ${y}px)${dragging ? ' rotate(-0.6deg)' : ''}`,
        transition: tidying ? 'transform 450ms var(--ease), width 450ms var(--ease)' : undefined
      }}
    >
      {card.working && <Waveform w={w} />}
      {card.kind && look?.rank && (
        <span
          aria-hidden
          className="absolute top-0 right-full flex w-7 items-center justify-center rounded-l-md bg-agent text-inverse"
          style={{ height: HEADER }}
        >
          <KindMark kind={card.kind} />
        </span>
      )}
      <header
        // on the header, not the title: dragging captures the pointer here, so clicks land here
        onDoubleClick={(e) => {
          if (card.onRename && !(e.target as HTMLElement).closest('button')) setRenaming(true)
        }}
        onPointerDown={(e) =>
          track(
            e,
            (dx, dy) => {
              if (dx || dy) onDragBy?.({ dx, dy })
              return { x: card.x + dx, y: card.y + dy, w }
            },
            (r) => {
              onDragBy?.(null)
              onMove(snap(r.x), snap(r.y))
            }
          )
        }
        className={`flex shrink-0 cursor-grab items-center gap-3 rounded-t-[inherit] px-4 active:cursor-grabbing ${
          look?.header ?? (blue ? 'text-on-brand' : 'border-b border-hair text-link')
        }`}
        style={{ height: HEADER }}
      >
        {card.needsYou && (
          <span className="absolute -top-[26px] right-2 rounded-full bg-needs-you px-2.5 py-0.5 type-label-s text-on-needs-you">
            Needs you
          </span>
        )}
        <span aria-hidden className="font-mono text-[11px] tracking-[-0.2em] opacity-50">
          ⋮⋮
        </span>
        {card.kind && !look?.rank && <KindMark kind={card.kind} />}
        {renaming ? (
          <Rename
            value={card.title}
            className="min-w-0 flex-1 px-1 type-body-m"
            onDone={(name) => {
              setRenaming(false)
              if (name) card.onRename?.(name)
            }}
          />
        ) : (
          <h2
            title={card.onRename ? 'Double-click to rename' : undefined}
            className={`min-w-0 flex-1 truncate ${look?.title ?? 'type-heading-m'}`}
          >
            {card.title}
          </h2>
        )}
        {look && (
          <span className="shrink-0 font-mono text-[10px] tracking-wide uppercase opacity-70">
            {look.tag}
          </span>
        )}
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
