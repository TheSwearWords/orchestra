// Pure layout for the Create stage. Top to bottom: the Prerequisites circle ringed by every
// foundation, one row of deliverable seats (grouped by category), the Deliverables circle
// where you confirm, and once confirmed, each chosen deliverable's window in a row below it.
// No DOM, so it is tested in node.

export const SEAT = { w: 208, h: 208 }
const SEAT_GAP = 32
export const PREREQS = { x: 0, y: -660, r: 110, ring: 290 }
export const PODIUM = { x: 0, y: 470, r: 150 } // the Deliverables circle
export const WINDOW_W = 520
const WINDOW_GAP = 48
export const WINDOWS_Y = PODIUM.y + PODIUM.r + 120

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

/** Every seat in one row, centred, category by category, then the Add seat. */
export function seatRow(musicians: { id: string; category: string; name: string }[]): Seated[] {
  const ordered = [...musicians].sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name)
  )
  const ids = [...ordered.map((m) => m.id), 'add']
  const step = SEAT.w + SEAT_GAP
  const start = -((ids.length - 1) * step) / 2
  return ids.map((id, i) => ({ id, x: start + i * step, y: 0 }))
}

/** Points evenly round a ring, starting at the top. */
export function ring(n: number, cx: number, cy: number, r: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

/** The left edge of the i-th of n windows, in a centred row under the Deliverables circle. */
export function windowX(i: number, n: number): number {
  const step = WINDOW_W + WINDOW_GAP
  return Math.round((-((n - 1) * step) / 2 - WINDOW_W / 2 + i * step) / 24) * 24
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
