// Nothing on an artboard overlaps. A card that would land on another moves to the nearest free
// spot beside what it hit, on the 24px grid. Pure, so it is tested in node.
import type { Rect } from './camera'

export const GAP = 24

const hits = (a: Rect, b: Rect, gap: number): boolean =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap

const snap = (v: number): number => Math.round(v / GAP) * GAP

/** Where `r` can go without touching any of `taken` (keeping `gap` clear): itself if it is
 * already free, else the closest spot beside one of the things in the way. */
export function freeSpot(r: Rect, taken: Rect[], gap = GAP): Rect {
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

/** Places cards in order, each clear of what is already down (the fixed things first). */
export function settle<T extends Rect>(cards: T[], fixed: Rect[] = []): T[] {
  const down: Rect[] = [...fixed]
  return cards.map((c) => {
    const spot = freeSpot(c, down)
    down.push(spot)
    return { ...c, x: spot.x, y: spot.y }
  })
}
