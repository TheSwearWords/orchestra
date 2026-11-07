// Pure layout for the Create stage (canvas spec §6): the Deliverables podium at the bottom
// centre with every deliverable seated on the arc around it, grouped by category, and the
// Prerequisites circle at the top centre, ringed by the foundations. No DOM, so it is tested.

export const SEAT = { w: 208, h: 208 }
export const PODIUM = { x: 0, y: 0, r: 150 }
export const PREREQS = { x: 0, y: -1240, r: 110, ring: 270 }
const ARC = { rx: 1040, ry: 760 }

// Categories in the order a project usually needs them; unknown ones follow alphabetically.
const CATEGORY_ORDER = ['Brand', 'Web', 'Product', 'Motion', '3D', 'Code']
const rank = (c: string): number => {
  const i = CATEGORY_ORDER.indexOf(c)
  return i < 0 ? CATEGORY_ORDER.length : i
}

export interface Seated {
  id: string // a Musician id, or "add" for the dashed Add seat
  x: number // seat centre
  y: number
}

/** Seats on the arc over the podium, left to right, category by category, then the Add seat. */
export function seatArc(musicians: { id: string; category: string; name: string }[]): Seated[] {
  const ordered = [...musicians].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name)
  )
  const ids = [...ordered.map((m) => m.id), 'add']
  // from level with the podium on the left, over the top, to level on the right
  const from = Math.PI
  const to = 0
  return ids.map((id, i) => {
    const t = ids.length === 1 ? 0.5 : i / (ids.length - 1)
    const a = from + (to - from) * t
    return { id, x: PODIUM.x + ARC.rx * Math.cos(a), y: PODIUM.y - ARC.ry * Math.sin(a) }
  })
}

/** Points evenly round a ring, starting at the top. */
export function ring(n: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** Where a seat's card opens: beside the seat, on the side away from the podium. */
export function besideSeat(s: { x: number; y: number }, w: number): { x: number; y: number } {
  const gap = 48
  const x = s.x < PODIUM.x ? s.x - SEAT.w / 2 - gap - w : s.x + SEAT.w / 2 + gap
  return { x: Math.round(x / 24) * 24, y: Math.round((s.y - SEAT.h / 2) / 24) * 24 }
}

/** The project paths an Instrument's `output` names (prereqs/… or exports/), if any. */
export const outputPaths = (output: string): string[] =>
  output.match(/\b(?:prereqs|exports)\/[\w./-]*/g)?.map((p) => p.replace(/[.,]$/, '')) ?? []

/** The files a deliverable made: those under the paths its Instruments and foundations name.
 * shortcut: files are matched by path, so two deliverables sharing exports/ both list them;
 * upgrade when outputs are recorded per Musician. */
export function filesFor<T extends { path: string }>(
  musician: { instruments: string[]; prerequisites: string[] },
  instruments: { id: string; output: string }[],
  outputs: T[]
): T[] {
  const mine = new Set([...musician.instruments, ...musician.prerequisites])
  const paths = instruments.filter((i) => mine.has(i.id)).flatMap((i) => outputPaths(i.output))
  return outputs.filter((o) =>
    paths.some((p) =>
      p.endsWith('/') ? o.path.startsWith(p) : o.path === p || o.path.startsWith(p + '/')
    )
  )
}
