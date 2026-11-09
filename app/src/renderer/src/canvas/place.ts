// Nothing on an artboard overlaps. A card that would land on another moves to the nearest free
// spot beside what it hit, on the 24px grid. Pure, so it is tested in node.
import type { Rect } from './camera'

export const GAP = 24 // the grid windows snap to
export const CLEAR = 72 // the room every window keeps around it

const hits = (a: Rect, b: Rect, gap: number): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap

const snap = (v: number): number => Math.round(v / GAP) * GAP

/** Whether two rects touch at all: what a selection box picks up. */
export const touches = (a: Rect, b: Rect): boolean => hits(a, b, 0)

/** Where `r` can go without touching any of `taken` (keeping `gap` clear): itself if it is
 * already free, else the closest spot beside one of the things in the way. */
export function freeSpot(r: Rect, taken: Rect[], gap = CLEAR): Rect {
  if (!taken.some((t) => hits(r, t, gap))) return r
  const tried = new Set<string>()
  let ring: Rect[] = [r]
  // spread out from the things in the way, a few rounds deep, keeping the nearest free spot
  for (let round = 0; round < 6; round++) {
    const next: Rect[] = []
    for (const at of ring)
      for (const t of taken.filter((x) => hits(at, x, gap))) {
        const spots = [
          { x: t.x + t.w + gap, y: at.y }, // right of it
          { x: t.x - gap - at.w, y: at.y }, // left
          { x: at.x, y: t.y + t.h + gap }, // below
          { x: at.x, y: t.y - gap - at.h } // above
        ]
        for (const s of spots) {
          const c = { ...at, x: snap(s.x), y: snap(s.y) }
          const key = `${c.x},${c.y}`
          if (tried.has(key)) continue
          tried.add(key)
          next.push(c)
        }
      }
    const free = next
      .filter((c) => !taken.some((t) => hits(c, t, gap)))
      .sort((a, b) => Math.hypot(a.x - r.x, a.y - r.y) - Math.hypot(b.x - r.x, b.y - r.y))
    if (free.length) return free[0]
    ring = next
  }
  // boxed in: below everything
  return { ...r, y: snap(Math.max(...taken.map((t) => t.y + t.h)) + gap) }
}

export interface Block {
  ids: string[] // the windows that move together
  rect: Rect
  fixed?: boolean // others move out of its way; it doesn't move
}

/** Moves groups apart until no two touch (leaving `gap` for the label on top of each), and returns
 * how far each window has to go. A group always moves whole, so it stays intact. */
export function separate(blocks: Block[], gap = 48): Record<string, { dx: number; dy: number }> {
  const moves = blocks.map(() => ({ dx: 0, dy: 0 }))
  const at = (i: number): Rect => ({
    ...blocks[i].rect,
    x: blocks[i].rect.x + moves[i].dx,
    y: blocks[i].rect.y + moves[i].dy
  })
  for (let pass = 0; pass < 60; pass++) {
    let changed = false
    for (let i = 0; i < blocks.length; i++)
      for (let j = i + 1; j < blocks.length; j++) {
        if (blocks[i].fixed && blocks[j].fixed) continue
        if (!hits(at(i), at(j), gap)) continue
        const mover = blocks[j].fixed ? i : j
        const m = at(mover)
        const o = at(mover === i ? j : i)
        const ways = [
          { dx: o.x + o.w + gap - m.x, dy: 0 },
          { dx: o.x - gap - m.w - m.x, dy: 0 },
          { dx: 0, dy: o.y + o.h + gap - m.y },
          { dx: 0, dy: o.y - gap - m.h - m.y }
        ].sort((a, b) => Math.abs(a.dx + a.dy) - Math.abs(b.dx + b.dy))
        moves[mover].dx += snap(ways[0].dx + Math.sign(ways[0].dx) * (GAP - 1))
        moves[mover].dy += snap(ways[0].dy + Math.sign(ways[0].dy) * (GAP - 1))
        changed = true
      }
    if (!changed) break
  }
  const out: Record<string, { dx: number; dy: number }> = {}
  blocks.forEach((b, i) => {
    if (moves[i].dx || moves[i].dy) for (const id of b.ids) out[id] = moves[i]
  })
  return out
}

/** Places cards in order, each clear of what is already down (the fixed things first). */
export function settle<T extends Rect>(cards: T[], fixed: Rect[] = []): T[] {
  const down: Rect[] = [...fixed]
  return cards.map((c) => {
    const spot = freeSpot(c, down)
    down.push(spot)
    return { ...c, x: spot.x, y: spot.y }
  })
}
